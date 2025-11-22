import { NextRequest, NextResponse } from "next/server";
import { dictionaryMatch, preprocessText } from "@/lib/detection/ad-detector";
import { createRetryableChatOpenAI } from "@/lib/llm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import fs from "fs";
import path from "path";

export interface ViolationResult {
  is_violation: boolean;
  violation_type: string;
  confidence: number;
  reason: string;
  matched_keywords: string[];
  related_articles: string[];
}

export interface DetectionResponse {
  dictionaryMatches: {
    hasViolations: boolean;
    matchedKeywords: Array<{
      keyword: string;
      position: number;
      type: "explicit" | "fuzzy" | "high-risk";
      relatedArticles: string[];
    }>;
    needsLLMReview: boolean;
  };
  llmResult?: ViolationResult;
  finalDecision: {
    isViolation: boolean;
    confidence: number;
    summary: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "内容不能为空" },
        { status: 400 }
      );
    }

    // 文本预处理
    const processedText = preprocessText(content);

    // 第一步：词典匹配
    const dictResult = dictionaryMatch(content);

    let llmResult: ViolationResult | undefined;

    // 第二步：如果命中模糊关键词或需要LLM审核，调用LLM
    if (dictResult.needsLLMReview || dictResult.matchedKeywords.length > 0) {
      try {
        const llm = createRetryableChatOpenAI({
          temperature: 0.3, // 降低温度以提高准确性
        });

        // 读取广告法条例
        const adLawPath = path.join(process.cwd(), "docs", "ad.json");
        const adLawContent = fs.readFileSync(adLawPath, "utf-8");
        const adLawArticles = JSON.parse(adLawContent);

        // 构建广告法相关规则摘要
        const keyArticles = adLawArticles
          .slice(0, 30)
          .map((article: { id: string; content: string }) => `${article.id}: ${article.content}`)
          .join("\n\n");

        const systemPrompt = `你是一个专业的广告法内容审核员。请根据《中华人民共和国广告法》判断用户输入的内容是否违反广告法相关规定。

【核心审核规则】
1. 禁止使用绝对化用语：如"国家级"、"最高级"、"最佳"、"第一"等（第九条）
2. 禁止虚假或引人误解的内容，不得欺骗、误导消费者（第四条）
3. 医疗、药品、医疗器械广告不得表示功效、安全性的断言或保证，不得说明治愈率或有效率（第十六条）
4. 保健食品广告不得涉及疾病预防、治疗功能（第十八条）
5. 招商等有投资回报预期的广告不得对未来效果、收益作出保证性承诺，不得明示或暗示保本、无风险或保收益（第二十五条）
6. 房地产广告不得含有升值或投资回报的承诺（第二十六条）
7. 广告内容应当真实、准确、清楚、明白（第八条）
8. 中性词在合理语境下不视为违规（如"这篇文章很敏感"是正常描述）

【广告法相关条款（部分）】
${keyArticles}

【输出格式】
请严格按以下JSON格式回答，不要包含其他内容：
{
  "is_violation": true/false,
  "violation_type": "绝对化用语/虚假宣传/医疗违规/投资承诺/房地产违规/其他/无",
  "confidence": 0.0-1.0之间的数字,
  "reason": "简要说明判断依据",
  "matched_keywords": ["匹配到的关键词数组"],
  "related_articles": ["相关法条ID，如'第九条'"]
}`;

        const userPrompt = `请审核以下内容是否违反广告法：

${processedText}

请仔细分析内容，判断是否存在违反广告法的情形。如果内容在合理语境下使用某些词汇（如"这篇文章很敏感"），不应视为违规。`;

        const response = await llm.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ]);

        const contentStr = response.content as string;

        // 尝试解析JSON响应
        try {
          // 尝试直接解析
          let parsed = JSON.parse(contentStr);
          llmResult = {
            is_violation: parsed.is_violation || false,
            violation_type: parsed.violation_type || "无",
            confidence: parsed.confidence || 0.0,
            reason: parsed.reason || "",
            matched_keywords: parsed.matched_keywords || [],
            related_articles: parsed.related_articles || [],
          };
        } catch (parseError) {
          // 如果直接解析失败，尝试提取JSON部分
          const jsonMatch = contentStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            llmResult = {
              is_violation: parsed.is_violation || false,
              violation_type: parsed.violation_type || "无",
              confidence: parsed.confidence || 0.0,
              reason: parsed.reason || "",
              matched_keywords: parsed.matched_keywords || [],
              related_articles: parsed.related_articles || [],
            };
          } else {
            // 如果无法解析，使用词典匹配结果
            console.warn("LLM响应无法解析为JSON，使用词典匹配结果");
            llmResult = {
              is_violation: dictResult.hasViolations,
              violation_type: dictResult.hasViolations ? "词典匹配违规" : "无",
              confidence: dictResult.hasViolations ? 0.8 : 0.2,
              reason: "LLM响应解析失败，基于词典匹配结果",
              matched_keywords: dictResult.matchedKeywords.map((m) => m.keyword),
              related_articles: dictResult.matchedKeywords
                .flatMap((m) => m.relatedArticles)
                .filter((v, i, a) => a.indexOf(v) === i),
            };
          }
        }
      } catch (llmError) {
        console.error("LLM调用失败:", llmError);
        // LLM调用失败时，使用词典匹配结果
        llmResult = {
          is_violation: dictResult.hasViolations,
          violation_type: dictResult.hasViolations ? "词典匹配违规" : "无",
          confidence: dictResult.hasViolations ? 0.8 : 0.2,
          reason: "LLM调用失败，基于词典匹配结果",
          matched_keywords: dictResult.matchedKeywords.map((m) => m.keyword),
          related_articles: dictResult.matchedKeywords
            .flatMap((m) => m.relatedArticles)
            .filter((v, i, a) => a.indexOf(v) === i),
        };
      }
    } else {
      // 如果没有需要LLM审核的内容，直接使用词典匹配结果
      llmResult = {
        is_violation: dictResult.hasViolations,
        violation_type: dictResult.hasViolations ? "词典匹配违规" : "无",
        confidence: dictResult.hasViolations ? 0.9 : 0.1,
        reason: dictResult.hasViolations
          ? "检测到明确违禁词"
          : "未检测到违规内容",
        matched_keywords: dictResult.matchedKeywords.map((m) => m.keyword),
        related_articles: dictResult.matchedKeywords
          .flatMap((m) => m.relatedArticles)
          .filter((v, i, a) => a.indexOf(v) === i),
      };
    }

    // 最终决策
    const finalDecision = {
      isViolation: llmResult.is_violation,
      confidence: llmResult.confidence,
      summary: llmResult.reason || "检测完成",
    };

    const response: DetectionResponse = {
      dictionaryMatches: dictResult,
      llmResult,
      finalDecision,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("检测失败:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "检测失败",
      },
      { status: 500 }
    );
  }
}

