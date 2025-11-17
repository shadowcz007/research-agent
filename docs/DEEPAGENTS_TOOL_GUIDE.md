# DeepAgents Tool 编写指南

本文档基于项目中的实际代码示例，详细说明如何为 DeepAgents 编写自定义工具（Tool）。

## 目录

1. [工具基础概念](#工具基础概念)
2. [工具编写步骤](#工具编写步骤)
3. [完整示例分析](#完整示例分析)
4. [工具集成方式](#工具集成方式)
5. [最佳实践](#最佳实践)

---

## 工具基础概念

### 什么是 Tool？

在 DeepAgents 中，Tool（工具）是 Agent 可以调用的函数，用于执行特定任务。工具扩展了 Agent 的能力，使其能够：

- 执行网络搜索
- 访问外部 API
- 操作文件系统
- 执行计算任务
- 调用其他服务

### 工具的核心组件

每个工具必须包含以下三个核心组件：

1. **name**: 工具的唯一标识符
2. **description**: 工具的功能描述（用于 LLM 理解何时使用该工具）
3. **schema**: 使用 Zod 定义的工具参数验证模式

---

## 工具编写步骤

### 步骤 1: 导入必要的依赖

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
```

### 步骤 2: 定义工具函数

工具函数是一个异步函数，接收参数对象并返回结果。

```typescript
const myTool = tool(
  async ({ param1, param2 }: { param1: string; param2?: number }) => {
    // 工具的实际执行逻辑
    // 可以是 API 调用、数据处理、文件操作等
    return result;
  },
  {
    // 工具配置
  }
);
```

### 步骤 3: 配置工具元数据

在第二个参数中配置工具的元数据：

```typescript
{
  name: "tool_name",  // 工具名称
  description: "工具的功能描述",  // 详细描述，帮助 LLM 理解何时使用
  schema: z.object({  // 使用 Zod 定义参数模式
    param1: z.string().describe("参数1的描述"),
    param2: z.number().optional().default(0).describe("参数2的描述"),
  }),
}
```

---

## 完整示例分析

### 示例：Internet Search Tool

以下是从项目代码 `lib/agent/research-agent.ts` 中提取的完整工具示例：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";

type Topic = "general" | "news" | "finance";

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
    // 工具执行逻辑
    const tavilySearch = new TavilySearch({
      maxResults,
      tavilyApiKey: process.env.TAVILY_API_KEY,
      includeRawContent,
      topic,
      searchDepth: 'advanced',
      chunksPerSource: 5
    });

    const tavilyResponse = await tavilySearch._call({ query });
    
    // 可选：在开发环境中保存结果
    if (process.env.NODE_ENV === 'development') {
      fs.writeFile(
        `temp/${query}_tavily_search_result.json`,
        JSON.stringify(tavilyResponse, null, 2)
      );
    }

    return tavilyResponse;
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
```

### 代码解析

#### 1. 函数签名

```typescript
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
})
```

- 使用解构参数，支持可选参数和默认值
- TypeScript 类型定义确保类型安全

#### 2. 工具执行逻辑

```typescript
const tavilySearch = new TavilySearch({...});
const tavilyResponse = await tavilySearch._call({ query });
return tavilyResponse;
```

- 创建外部服务实例
- 异步调用并返回结果
- 可以包含错误处理、日志记录等

#### 3. Schema 定义

```typescript
schema: z.object({
  query: z.string().describe("The search query"),
  maxResults: z.number().optional().default(5).describe("..."),
  topic: z.enum(["general", "news", "finance"]).optional().default("general"),
  includeRawContent: z.boolean().optional().default(false),
})
```

- 使用 Zod 进行参数验证
- `.describe()` 帮助 LLM 理解参数用途
- `.optional()` 和 `.default()` 定义可选参数和默认值
- `.enum()` 限制参数的可选值

---

## 工具集成方式

### 方式 1: 集成到主 Agent

将工具传递给 `createDeepAgent` 的 `tools` 参数：

```typescript
import { createDeepAgent } from "deepagents";

const agent = createDeepAgent({
  model: chatModel,
  tools: [internetSearch],  // 工具数组
  systemPrompt: researchInstructions,
  subagents: [critiqueSubAgent, researchSubAgent],
  backend: new FilesystemBackend({
    rootDir: reportDir,
    virtualMode: true
  }),
});
```

### 方式 2: 集成到子 Agent (SubAgent)

子 Agent 可以拥有自己独立的工具集：

```typescript
const researchSubAgent: SubAgent = {
  name: "research-agent",
  description: "Used to research more in depth questions...",
  systemPrompt: subResearchPrompt,
  tools: [internetSearch],  // 子 Agent 的工具
};
```

### 方式 3: 通过 Middleware 添加工具

```typescript
import type { AgentMiddleware } from "langchain";

class CustomMiddleware implements AgentMiddleware {
  tools = [customTool1, customTool2];
}

const agent = createDeepAgent({
  middleware: [new CustomMiddleware()],
});
```

---

## 最佳实践

### 1. 清晰的工具描述

工具的描述应该：

- 明确说明工具的用途
- 说明何时应该使用该工具
- 描述工具返回的数据格式

```typescript
description: "Run a web search to find relevant information on the internet. Use this when you need to gather current information, research topics, or find specific data that is not in your training data."
```

### 2. 详细的 Schema 描述

每个参数都应该有清晰的描述：

```typescript
schema: z.object({
  query: z.string().describe("The search query string. Be specific and include relevant keywords."),
  maxResults: z.number().optional().default(5).describe("Maximum number of search results to return. Default is 5."),
})
```

### 3. 错误处理

工具应该包含适当的错误处理：

```typescript
async ({ query }: { query: string }) => {
  try {
    const result = await someApiCall(query);
    return result;
  } catch (error) {
    // 记录错误
    console.error("Tool error:", error);
    // 返回有意义的错误信息
    throw new Error(`Failed to execute tool: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
```

### 4. 进度更新（可选）

对于长时间运行的工具，可以发送进度更新：

```typescript
async ({ query }: { query: string }) => {
  sendProgressUpdate("搜索资料", 20, `正在搜索: "${query}"...`);
  
  const result = await performSearch(query);
  
  sendProgressUpdate("搜索资料", 30, `搜索完成，找到 ${result.length} 条结果`);
  
  return result;
}
```

### 5. 开发环境调试

在开发环境中保存工具结果，便于调试：

```typescript
if (process.env.NODE_ENV === 'development') {
  fs.writeFile(
    `temp/${query}_result.json`,
    JSON.stringify(result, null, 2)
  );
}
```

### 6. 类型安全

使用 TypeScript 类型定义确保类型安全：

```typescript
type ToolParams = {
  query: string;
  maxResults?: number;
  topic?: "general" | "news" | "finance";
};

const myTool = tool(
  async (params: ToolParams) => {
    // 实现
  },
  {
    // 配置
  }
);
```

### 7. 返回值格式

工具应该返回结构化的数据，便于 Agent 理解和处理：

```typescript
// 好的返回值
return {
  results: [...],
  count: 5,
  query: query,
  timestamp: new Date().toISOString()
};

// 避免返回过于复杂或嵌套过深的对象
```

---

## 工具示例：保存搜索结果

参考项目中的实际使用场景，以下是一个保存搜索结果的工具示例：

```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fs from "fs/promises";

export const saveSearchResult = tool(
  async ({
    query,
    results,
    filePath,
  }: {
    query: string;
    results: any;
    filePath?: string;
  }) => {
    const fileName = filePath || `temp/${query}_tavily_search_result.json`;
    const data = {
      query,
      results,
      savedAt: new Date().toISOString(),
    };
    
    await fs.writeFile(fileName, JSON.stringify(data, null, 2));
    
    return {
      success: true,
      filePath: fileName,
      message: `Search results saved to ${fileName}`,
    };
  },
  {
    name: "save_search_result",
    description: "Save search results to a JSON file for later reference",
    schema: z.object({
      query: z.string().describe("The search query that was used"),
      results: z.any().describe("The search results to save"),
      filePath: z
        .string()
        .optional()
        .describe("Optional custom file path. Defaults to temp/{query}_result.json"),
    }),
  },
);
```

---

## 总结

编写 DeepAgents 工具的关键要点：

1. ✅ 使用 `tool` 函数从 `@langchain/core/tools` 创建工具
2. ✅ 定义清晰的 `name`、`description` 和 `schema`
3. ✅ 使用 Zod 进行参数验证和类型定义
4. ✅ 实现异步工具函数，包含错误处理
5. ✅ 提供详细的参数描述，帮助 LLM 理解工具用途
6. ✅ 返回结构化的、易于理解的数据
7. ✅ 在开发环境中添加调试支持

通过遵循这些指南，您可以创建功能强大、易于使用的工具，扩展 DeepAgents 的能力。

---

## 参考资料

- 项目代码：`lib/agent/research-agent.ts`
- DeepAgents 文档：`node_modules/deepagents/README.md`
- [LangChain 工具文档](https://js.langchain.com/docs/modules/tools/)
- [Zod 文档](https://zod.dev/)
