import { NextRequest } from "next/server";
import { createRetryableChatOpenAI } from "@/lib/llm";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { content, style } = await request.json();

    if (!content || !style) {
      return new Response(
        JSON.stringify({ error: "content 和 style 是必需的" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const llm = createRetryableChatOpenAI({
      model: process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V3.2-Exp",
    });

    const systemPrompt = `You are an expert writing assistant. Your task is to rewrite an entire document based on a specific style instruction provided by the user. It is crucial that you maintain the original markdown structure, including all headings, subheadings, code blocks, bold/italic text, and paragraph breaks. Only change the tone and wording of the text itself as requested.`;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(`Style instruction: "${style}"\n\nDocument to rewrite:\n\n${content}`),
    ];

    const stream = await llm.stream(messages);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const chunkContent = chunk.content;
            if (chunkContent && typeof chunkContent === "string") {
              const data = JSON.stringify({ content: chunkContent });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error rewriting full document:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "改写失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

