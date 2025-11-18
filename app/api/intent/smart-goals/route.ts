import { NextRequest, NextResponse } from "next/server";
import { createRetryableChatOpenAI } from "@/lib/llm";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

export async function POST(request: NextRequest) {
  try {
    const { problem, intent } = await request.json();

    if (!problem || typeof problem !== "string") {
      return NextResponse.json(
        { error: "问题不能为空" },
        { status: 400 }
      );
    }

    if (!intent || typeof intent !== "string") {
      return NextResponse.json(
        { error: "意图不能为空" },
        { status: 400 }
      );
    }

    const llm = createRetryableChatOpenAI({ temperature: 0.7 });

    const systemPrompt = `你是一个专业的项目管理专家。基于研究问题和用户澄清后的意图，为S.M.A.R.T.目标的每个维度提供简洁、面向业务的建议。`;

    const userPrompt = `基于研究问题："${problem}"和用户澄清后的意图："${intent}"，请为S.M.A.R.T.目标的每个维度提供简洁、面向业务的建议。包括：具体（Specific）、可衡量（Measurable）、可实现（Achievable）、相关（Relevant）、有时限（Time-bound）。

请以JSON格式返回，包含以下字段：
{
  "specific": "具体目标描述",
  "measurable": "可衡量的指标",
  "achievable": "如何实现",
  "relevant": "相关性说明",
  "timeBound": "时间限制"
}`;

    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    // 解析JSON响应
    const content = response.content as string;
    let smartGoal: any = {};

    try {
      // 尝试直接解析JSON
      smartGoal = JSON.parse(content);
    } catch {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        smartGoal = JSON.parse(jsonMatch[0]);
      }
    }

    // 确保所有字段都存在
    const result = {
      specific: smartGoal.specific || `研究"${problem}"的具体方面`,
      measurable: smartGoal.measurable || "通过数据分析和报告来衡量",
      achievable: smartGoal.achievable || "通过系统化的研究方法实现",
      relevant: smartGoal.relevant || `与"${intent}"直接相关`,
      timeBound: smartGoal.timeBound || "在合理的时间范围内完成",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Smart Goals API] 错误:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "生成S.M.A.R.T.目标失败",
      },
      { status: 500 }
    );
  }
}

