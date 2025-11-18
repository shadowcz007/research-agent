import { NextRequest, NextResponse } from "next/server";
import { createRetryableChatOpenAI } from "@/lib/llm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function POST(request: NextRequest) {
  try {
    const {
      initialProblem,
      clarifiedIntent,
      smartGoal,
      selectedDimensions,
      hypothesis,
    } = await request.json();

    if (!initialProblem || typeof initialProblem !== "string") {
      return NextResponse.json(
        { error: "初始问题不能为空" },
        { status: 400 }
      );
    }

    const llm = createRetryableChatOpenAI({ temperature: 0.7 });

    const systemPrompt = `你是一位资深研究分析师。将用户提供的研究计划信息整合成一份简洁的"研究需求卡片"。仅使用纯业务语言，避免一切技术术语。`;

    const userPrompt = `你是一位资深研究分析师。用户为研究计划提供了以下信息：
初始问题："${initialProblem}"
澄清后的意图："${clarifiedIntent}"
S.M.A.R.T. 目标：${JSON.stringify(smartGoal)}
选定的分析维度："${selectedDimensions.join(", ")}"
核心假设："${hypothesis || "无"}"

请将以上信息整合成一份简洁的"研究需求卡片"。**仅使用纯业务语言，避免一切技术术语**。输出必须是一个结构清晰的 JSON 对象，包含以下字段：
- \`goal\`：一句话概括研究目标。
- \`questions\`：3-5 个需回答的关键研究问题（数组）。
- \`scope\`：一段简短文字，界定本研究的范围（包括什么、不包括什么）。
- \`hypothesis\`：将用户的核心假设重述为一条清晰、可验证的业务陈述（如果用户没有提供假设，则基于研究目标生成一个合理的假设）。

请以JSON格式返回：
{
  "goal": "研究目标",
  "questions": ["问题1", "问题2", "问题3"],
  "scope": "研究范围说明",
  "hypothesis": "核心假设"
}`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    // 解析JSON响应
    const content = response.content as string;
    let researchCard: any = {};

    try {
      // 尝试直接解析JSON
      researchCard = JSON.parse(content);
    } catch {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        researchCard = JSON.parse(jsonMatch[0]);
      }
    }

    // 确保所有字段都存在
    const result = {
      goal:
        researchCard.goal ||
        `研究"${initialProblem}"，以理解"${clarifiedIntent}"`,
      questions: Array.isArray(researchCard.questions)
        ? researchCard.questions
        : [
            `"${initialProblem}"的主要原因是什么？`,
            `如何解决"${clarifiedIntent}"？`,
            `有哪些关键因素需要考虑？`,
          ],
      scope:
        researchCard.scope ||
        `本研究将聚焦于"${selectedDimensions.join(", ")}"等维度，深入分析"${initialProblem}"的相关方面。`,
      hypothesis:
        researchCard.hypothesis ||
        (hypothesis
          ? hypothesis
          : `基于初步分析，"${initialProblem}"可能与多个因素相关，需要系统化研究来验证。`),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Research Card API] 错误:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "生成研究卡片失败",
      },
      { status: 500 }
    );
  }
}

