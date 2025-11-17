import "dotenv/config";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";
import { HumanMessage } from "@langchain/core/messages";
import { createDeepAgent, type SubAgent, FilesystemBackend } from "deepagents";
import { progressCallbacks, getCurrentTaskId } from "../storage/task-storage";
import { createRetryableChatOpenAI } from "../llm";
import path from "path";
import fs from "fs/promises";

type Topic = "general" | "news" | "finance";

// 统一的结果格式
interface UnifiedSearchResult {
  content: string;
  title: string;
  url: string;
  from: "tavily" | "newsagent" | "dify";
}

interface UnifiedSearchResponse {
  query: string;
  results: UnifiedSearchResult[];
}

// Helper function to send progress update
function sendProgressUpdate(
  stage: string,
  progress: number,
  log: string
): void {
  const taskId = getCurrentTaskId();
  if (taskId) {
    const callback = progressCallbacks.get(taskId);
    if (callback) {
      callback({ stage, progress, log });
    }
  }
}

// 调用 Tavily API
async function callTavilyAPI(
  query: string,
  maxResults: number,
  topic: Topic,
  includeRawContent: boolean
): Promise<UnifiedSearchResult[]> {
  try {
    const tavilySearch = new TavilySearch({
      maxResults,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      includeRawContent,
      topic,
      searchDepth: 'advanced',
      chunksPerSource: 5
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Type instantiation is excessively deep and possibly infinite.
    const tavilyResponse = await tavilySearch._call({ query });

    // 解析 Tavily 响应
    const results: UnifiedSearchResult[] = [];
    let tavilyResults: any[] = [];

    if (Array.isArray(tavilyResponse)) {
      tavilyResults = tavilyResponse;
    } else if (tavilyResponse && 'results' in tavilyResponse && Array.isArray(tavilyResponse.results)) {
      tavilyResults = tavilyResponse.results;
    }

    for (const item of tavilyResults) {
      if (item.url && item.title && item.content) {
        results.push({
          content: item.content || '',
          title: item.title || '',
          url: item.url || '',
          from: 'tavily'
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Tavily API 调用失败:', error);
    return [];
  }
}

// 调用 NewsAgent API
async function callNewsAgentAPI(query: string): Promise<UnifiedSearchResult[]> {
  const newsAgentUrl = process.env.NEWSAGENT_API_URL || 'http://localhost:3000/api/chat';
  const newsAgentApiKey = process.env.NEWSAGENT_API_KEY || 'news_0764aef10d524d4a05b1cd7ad968b2a4';
  const timeout = 30000; // 30秒超时

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(newsAgentUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': newsAgentApiKey
      },
      body: JSON.stringify({ message: query }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NewsAgent API 返回错误: ${response.status}`);
    }

    const data = await response.json();

    // 解析 NewsAgent 响应
    const results: UnifiedSearchResult[] = [];
    if (data.sources && Array.isArray(data.sources)) {
      for (const source of data.sources) {
        if (source.url && source.title) {
          results.push({
            content: source.content || '',
            title: source.title || '',
            url: source.url || '',
            from: 'newsagent'
          });
        }
      }
    }

    return results;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('NewsAgent API 请求超时');
    } else {
      console.error('NewsAgent API 调用失败:', error);
    }
    return [];
  }
}

// 调用 Dify API
async function callDifyAPI(query: string): Promise<UnifiedSearchResult[]> {
  const difyDatasetId = process.env.DIFY_DATASET_ID || '8cd43f69-8d10-4187-a6f6-3371f5067a0d';
  const difyToken = process.env.DIFY_TOKEN || 'dataset-kQrj2zG3jiMJfRKqu2rYCVzn';
  const difyUrl = `https://api.dify.ai/v1/datasets/${difyDatasetId}/retrieve`;
  const timeout = 30000; // 30秒超时

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(difyUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${difyToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        retrieval_model: {}
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Dify API 返回错误: ${response.status}`);
    }

    const data = await response.json();

    // 解析 Dify 响应，只保留 tokens > 200 的 segments
    const results: UnifiedSearchResult[] = [];
    if (data.records && Array.isArray(data.records)) {
      for (const record of data.records) {
        if (record.segment) {
          const segment = record.segment;
          // 只保留 tokens > 200 的 segments
          if (segment.tokens && segment.tokens > 200 && segment.content) {
            results.push({
              content: segment.content || '',
              title: segment.document?.name || '',
              url: segment.document_id || '',
              from: 'dify'
            });
          }
        }
      }
    }

    return results;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Dify API 请求超时');
    } else {
      console.error('Dify API 调用失败:', error);
    }
    return [];
  }
}

// Search tool to use to do research
export const internetSearch = tool(
  async ({
    query,
    maxResults = 5,
    topic = "general" as Topic,
    includeRawContent = false,
  }: {
    query: string;
    maxResults?: number;
    topic?: Topic;
    includeRawContent?: boolean;
  }) => {
    // Send progress: 搜索开始
    sendProgressUpdate(
      "搜索资料",
      20,
      `正在并发搜索: "${query}"...`
    );

    try {
      // 并发调用三个 API
      sendProgressUpdate(
        "搜索资料",
        25,
        `并发请求已发送，等待 API 响应...`
      );

      const [tavilyResults, newsAgentResults, difyResults] = await Promise.allSettled([
        callTavilyAPI(query, maxResults, topic, includeRawContent),
        callNewsAgentAPI(query),
        callDifyAPI(query)
      ]);

      // 收集所有结果
      const allResults: UnifiedSearchResult[] = [];

      if (tavilyResults.status === 'fulfilled') {
        allResults.push(...tavilyResults.value);
        // sendProgressUpdate(
        //   "搜索资料",
        //   30,
        //   `Tavily 完成: ${tavilyResults.value.length} 条结果`
        // );
      } else {
        console.error('Tavily 搜索失败:', tavilyResults.reason);
      }

      if (newsAgentResults.status === 'fulfilled') {
        allResults.push(...newsAgentResults.value);
        // sendProgressUpdate(
        //   "搜索资料",
        //   35,
        //   `NewsAgent 完成: ${newsAgentResults.value.length} 条结果`
        // );
      } else {
        console.error('NewsAgent 搜索失败:', newsAgentResults.reason);
      }

      if (difyResults.status === 'fulfilled') {
        allResults.push(...difyResults.value);
        // sendProgressUpdate(
        //   "搜索资料",
        //   40,
        //   `Dify 完成: ${difyResults.value.length} 条结果`
        // );
      } else {
        console.error('Dify 搜索失败:', difyResults.reason);
      }

      // 构建统一响应格式
      const unifiedResponse: UnifiedSearchResponse = {
        query: query,
        results: allResults
      };

      // Send progress: 搜索完成
      sendProgressUpdate(
        "搜索资料",
        50,
        `搜索完成，共找到 ${allResults.length} 条结果`
      );

      // 开发环境下保存结果
      if (process.env.NODE_ENV === 'development') {
        const safeQuery = query.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
        await fs.writeFile(
          `temp/${safeQuery}_unified_search_result.json`,
          JSON.stringify(unifiedResponse, null, 2)
        );
      }

      return unifiedResponse;
    } catch (error) {
      // Send progress: 搜索失败
      sendProgressUpdate(
        "搜索资料",
        20,
        `搜索失败: ${error instanceof Error ? error.message : "未知错误"}`
      );
      // 即使出错也返回空结果，而不是抛出异常
      return {
        query: query,
        results: []
      };
    }
  },
  {
    name: "internet_search",
    description: "Run a web search",
    schema: z.object({
      query: z.string().describe("The search query"),
      maxResults: z
        .number()
        .optional()
        .default(5)
        .describe("Maximum number of results to return"),
      topic: z
        .enum(["general", "news", "finance"])
        .optional()
        .default("general")
        .describe("Search topic category"),
      includeRawContent: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to include raw content"),
    }),
  },
);

const subResearchPrompt = `You are a dedicated researcher. Your job is to conduct research based on the users questions.

Conduct thorough research and then reply to the user with a detailed answer to their question

only your FINAL answer will be passed on to the user. They will have NO knowledge of anything except your final message, so your final report should be your final message!`;

const researchSubAgent: SubAgent = {
  name: "research-agent",
  description:
    "Used to research more in depth questions. Only give this researcher one topic at a time. Do not pass multiple sub questions to this researcher. Instead, you should break down a large topic into the necessary components, and then call multiple research agents in parallel, one for each sub question.",
  systemPrompt: subResearchPrompt,
  // @ts-ignore - Type compatibility issue between langchain versions
  tools: [internetSearch],
};

const subCritiquePrompt = `You are a dedicated editor. You are being tasked to critique a report.

You can find the report at \`final_report.md\`.

You can find the question/topic for this report at \`question.txt\`.

The user may ask for specific areas to critique the report in. Respond to the user with a detailed critique of the report. Things that could be improved.

You can use the search tool to search for information, if that will help you critique the report

Do not write to the \`final_report.md\` yourself.

Things to check:
- Check that each section is appropriately named
- Check that the report is written as you would find in an essay or a textbook - it should be text heavy, do not let it just be a list of bullet points!
- Check that the report is comprehensive. If any paragraphs or sections are short, or missing important details, point it out.
- Check that the article covers key areas of the industry, ensures overall understanding, and does not omit important parts.
- Check that the article deeply analyzes causes, impacts, and trends, providing valuable insights
- Check that the article closely follows the research topic and directly answers questions
- Check that the article has a clear structure, fluent language, and is easy to understand.
`;

const critiqueSubAgent: SubAgent = {
  name: "critique-agent",
  description:
    "Used to critique the final report. Give this agent some information about how you want it to critique the report.",
  systemPrompt: subCritiquePrompt,
};

// Prompt prefix to steer the agent to be an expert researcher
const researchInstructions = `You are an expert researcher. Your job is to conduct thorough research, and then write a polished report.

The first thing you should do is to write the original user question to \`question.txt\` so you have a record of it.

Use the research-agent to conduct deep research. It will respond to your questions/topics with a detailed answer.

When you think you enough information to write a final report, write it to \`final_report.md\`

You can call the critique-agent to get a critique of the final report. After that (if needed) you can do more research and edit the \`final_report.md\`
You can do this however many times you want until are you satisfied with the result.

Only edit the file once at a time (if you call this tool in parallel, there may be conflicts).

Here are instructions for writing the final report:

<report_instructions>

CRITICAL: Make sure the answer is written in the same language as the human messages! If you make a todo plan - you should note in the plan what language the report should be in so you dont forget!
Note: the language the report should be in is the language the QUESTION is in, not the language/country that the question is ABOUT.

Please create a detailed answer to the overall research brief that:
1. Is well-organized with proper headings (# for title, ## for sections, ### for subsections)
2. Includes specific facts and insights from the research
3. References relevant sources using [Title](URL) format
4. Provides a balanced, thorough analysis. Be as comprehensive as possible, and include all information that is relevant to the overall research question. People are using you for deep research and will expect detailed, comprehensive answers.
5. Includes a "Sources" section at the end with all referenced links

You can structure your report in a number of different ways. Here are some examples:

To answer a question that asks you to compare two things, you might structure your report like this:
1/ intro
2/ overview of topic A
3/ overview of topic B
4/ comparison between A and B
5/ conclusion

To answer a question that asks you to return a list of things, you might only need a single section which is the entire list.
1/ list of things or table of things
Or, you could choose to make each item in the list a separate section in the report. When asked for lists, you don't need an introduction or conclusion.
1/ item 1
2/ item 2
3/ item 3

To answer a question that asks you to summarize a topic, give a report, or give an overview, you might structure your report like this:
1/ overview of topic
2/ concept 1
3/ concept 2
4/ concept 3
5/ conclusion

If you think you can answer the question with a single section, you can do that too!
1/ answer

REMEMBER: Section is a VERY fluid and loose concept. You can structure your report however you think is best, including in ways that are not listed above!
Make sure that your sections are cohesive, and make sense for the reader.

For each section of the report, do the following:
- Use simple, clear language
- Use ## for section title (Markdown format) for each section of the report
- Do NOT ever refer to yourself as the writer of the report. This should be a professional report without any self-referential language. 
- Do not say what you are doing in the report. Just write the report without any commentary from yourself.
- Each section should be as long as necessary to deeply answer the question with the information you have gathered. It is expected that sections will be fairly long and verbose. You are writing a deep research report, and users will expect a thorough answer.
- Use bullet points to list out information when appropriate, but by default, write in paragraph form.

REMEMBER:
The brief and research may be in English, but you need to translate this information to the right language when writing the final answer.
Make sure the final answer report is in the SAME language as the human messages in the message history.

Format the report in clear markdown with proper structure and include source references where appropriate.

<Citation Rules>
- CRITICAL URL RULES - MUST FOLLOW:
  * You MUST use the exact URL from the \`internet_search\` tool's response. The URL is in the \`url\` field of each result in the \`results\` array.
  * NEVER modify, simplify, shorten, or fabricate URLs. You must copy the URL exactly as it appears in the search tool's response.
  * NEVER construct URLs yourself or guess URLs based on titles or content. Only use URLs that come directly from the \`internet_search\` tool.
  * The URL in your citation must be character-for-character identical to the URL in the search tool's response.
  * If you reference a source, you must have obtained its URL from a search result. Do not create citations for sources you did not find through the search tool.

- Assign each unique URL a single citation number in your text
- End with ### Sources (or ### 资料来源 if writing in Chinese) that lists each source with corresponding numbers
- IMPORTANT: Number sources sequentially without gaps (1,2,3,4...) in the final list regardless of which sources you choose
- CRITICAL: Each source MUST be on a separate line. Each source entry must be followed by a line break.
- Use markdown list format with each source as a separate list item
- Example format (note that each source is on its own line with a line break after it):
  [1] Source Title: URL

  [2] Source Title: URL

  [3] Source Title: URL
- Citations are extremely important. Make sure to include these, and pay a lot of attention to getting these right. Users will often use these citations to look into more information.
</Citation Rules>
</report_instructions>

You have access to a few tools.

## \`internet_search\`

Use this to run an internet search for a given query. You can specify the number of results, the topic, and whether raw content should be included.
`;

// Create the agent using deepagents with retryable ChatOpenAI
// 使用带指数退避重试机制的 ChatOpenAI 来处理速率限制
const chatModel = createRetryableChatOpenAI({
  model: process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V3.2-Exp",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL || "https://api.siliconflow.cn/v1",
  },
  temperature: 0,
  retryConfig: {
    maxRetries: parseInt(process.env.OPENAI_MAX_RETRIES || "5", 10),
    baseDelay: parseInt(process.env.OPENAI_RETRY_BASE_DELAY || "1000", 10),
    maxDelay: parseInt(process.env.OPENAI_RETRY_MAX_DELAY || "60000", 10),
  },
});

// 为每个报告创建独立文件系统的 agent
export function createAgentForReport(reportId: string) {
  const reportDir = path.join(process.cwd(), "reports", reportId);

  return createDeepAgent({
    model: chatModel,
    tools: [internetSearch],
    systemPrompt: researchInstructions,
    subagents: [critiqueSubAgent, researchSubAgent],
    backend: new FilesystemBackend({
      rootDir: reportDir,
      virtualMode: true
    }),
  });
}

