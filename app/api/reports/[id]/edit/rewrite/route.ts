import { NextRequest, NextResponse } from "next/server";
import { createRetryableChatOpenAI } from "@/lib/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { selectedText, instruction } = await request.json();

    if (!selectedText || !instruction) {
      return NextResponse.json(
        { error: "selectedText 和 instruction 是必需的" },
        { status: 400 }
      );
    }

    const llm = createRetryableChatOpenAI({
      model: process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V3.2-Exp",
    });

    const systemPrompt = `You are an expert writing assistant. The user has selected a piece of text and wants to modify it. Rewrite the selected text based on the user's instruction. Return ONLY the rewritten text, without any preamble, explanations, or markdown formatting.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(`User's instruction: "${instruction}"\n\nSelected text: "${selectedText}"`),
    ];

    const response = await llm.invoke(messages);
    const rewrittenText = response.content as string;

    return NextResponse.json({ rewrittenText });
  } catch (error) {
    console.error("Error rewriting text:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "改写失败" },
      { status: 500 }
    );
  }
}

