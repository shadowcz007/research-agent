import { NextRequest, NextResponse } from "next/server";
import { createRetryableChatOpenAI } from "@/lib/llm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function POST(request: NextRequest) {
  try {
    const { problem, smartGoal } = await request.json();

    if (!problem || typeof problem !== "string") {
      return NextResponse.json(
        { error: "问题不能为空" },
        { status: 400 }
      );
    }

    if (!smartGoal || typeof smartGoal !== "object") {
      return NextResponse.json(
        { error: "S.M.A.R.T.目标不能为空" },
        { status: 400 }
      );
    }

    const llm = createRetryableChatOpenAI({ temperature: 0.7 });

    const systemPrompt = `你是一个专业的研究分析师。针对给定的研究问题和S.M.A.R.T.目标，建议关键分析维度。`;

    const userPrompt = `针对一个关于"${problem}"的研究项目，其S.M.A.R.T.目标为：${JSON.stringify(smartGoal)}，应调查哪些关键分析维度？请列出最多8个相关维度。例如："客户细分"、"产品使用模式"、"市场趋势"、"竞品分析"等。

请以JSON数组格式返回，例如：["维度1", "维度2", "维度3"]`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    // 解析JSON响应
    const content = response.content as string;
    let dimensions: string[] = [];

    try {
      // 尝试直接解析JSON
      dimensions = JSON.parse(content);
    } catch {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        dimensions = JSON.parse(jsonMatch[0]);
      } else {
        // 如果还是失败，尝试按行分割
        const lines = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && (line.startsWith('"') || line.startsWith("-") || /^\d+\./.test(line)));
        dimensions = lines.map((line) =>
          line.replace(/^["'\-\d+\.\s]+|["']$/g, "").trim()
        ).filter((d) => d.length > 0);
      }
    }

    // 确保返回的是数组
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
      // 如果解析失败，返回默认维度
      dimensions = [
        "趋势分析",
        "驱动因素",
        "用户画像",
        "市场环境",
        "竞品分析",
      ];
    }

    // 限制最多8个维度
    dimensions = dimensions.slice(0, 8);

    return NextResponse.json({ dimensions });
  } catch (error) {
    console.error("[Dimensions API] 错误:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "获取分析维度失败",
      },
      { status: 500 }
    );
  }
}

