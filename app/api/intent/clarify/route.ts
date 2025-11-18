import { NextRequest, NextResponse } from "next/server";
import { createRetryableChatOpenAI } from "@/lib/llm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function POST(request: NextRequest) {
  try {
    const { problem } = await request.json();

    if (!problem || typeof problem !== "string") {
      return NextResponse.json(
        { error: "问题不能为空" },
        { status: 400 }
      );
    }

    const llm = createRetryableChatOpenAI({ temperature: 0.7 });

    const systemPrompt = `你是一个专业的业务分析师。根据用户的问题，生成2-3个澄清性问题，帮助理解用户的具体意图。每个问题应该是完整的、用户可以直接选择的问句。`;

    const userPrompt = `给定用户的问题："${problem}"，请生成2-3个澄清性问题（表述为完整的、用户可直接选择的问句），帮助理解其具体意图。\n\n请以JSON数组格式返回，例如：["问题1", "问题2", "问题3"]`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    // 解析JSON响应
    const content = response.content as string;
    let questions: string[] = [];

    try {
      // 尝试直接解析JSON
      questions = JSON.parse(content);
    } catch {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\[.*\]/s);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        // 如果还是失败，尝试按行分割
        const lines = content
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && line.startsWith('"'));
        questions = lines.map((line) => line.replace(/^["']|["']$/g, ""));
      }
    }

    // 确保返回的是数组
    if (!Array.isArray(questions) || questions.length === 0) {
      // 如果解析失败，返回默认问题
      questions = [
        `您希望深入了解"${problem}"的哪个方面？`,
        `您希望通过研究"${problem}"解决什么具体问题？`,
        `您对"${problem}"最关心的是什么？`,
      ];
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("[Clarify API] 错误:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "生成澄清问题失败",
      },
      { status: 500 }
    );
  }
}

