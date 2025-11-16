import { NextRequest, NextResponse } from "next/server";
import { fileStorage } from "@/lib/storage/file-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 获取 agent_raw_result.json
    const rawResult = await fileStorage.getAgentRawResult(id);

    if (!rawResult) {
      return NextResponse.json(
        { error: "执行日志不存在" },
        { status: 404 }
      );
    }

    // 从 task 字段提取基本信息
    const task = rawResult.task || {};
    const status = task.status || "completed";
    const progress = task.progress || 100;
    const stage = task.stage || "已完成";
    const todos = task.todos || [];
    const files = task.files || {};
    const toolCalls = task.toolCalls || [];

    // 从 messages 字段生成 logs 数组
    const logs: Array<{ time: string; message: string }> = [];
    const messages = rawResult.messages || [];

    messages.forEach((msg: any, index: number) => {
      const msgType = msg.id?.[2] || msg.kwargs?.name || "Unknown";
      let message = "";
      let timestamp = "";

      // 尝试从消息中提取时间戳
      if (msg.kwargs?.response_metadata?.timestamp) {
        timestamp = new Date(msg.kwargs.response_metadata.timestamp).toLocaleTimeString("zh-CN");
      } else if (msg.kwargs?.id) {
        // 如果没有时间戳，使用索引生成一个相对时间
        const baseTime = new Date();
        baseTime.setSeconds(baseTime.getSeconds() - (messages.length - index) * 2);
        timestamp = baseTime.toLocaleTimeString("zh-CN");
      } else {
        timestamp = new Date().toLocaleTimeString("zh-CN");
      }

      // 根据消息类型提取内容
      if (msgType === "HumanMessage") {
        const content = msg.kwargs?.content || "";
        if (content) {
          message = `用户: ${content}`;
          logs.push({ time: timestamp, message });
        }
      } else if (msgType === "AIMessage" || msgType === "AIMessageChunk") {
        const content = msg.kwargs?.content || "";
        const toolCalls = msg.kwargs?.tool_calls || msg.kwargs?.additional_kwargs?.tool_calls || [];
        
        if (content) {
          message = `AI: ${content}`;
          logs.push({ time: timestamp, message });
        }
        
        // 如果有工具调用，也记录
        if (toolCalls.length > 0) {
          toolCalls.forEach((toolCall: any) => {
            const toolName = toolCall.function?.name || toolCall.name || "unknown";
            const toolArgs = toolCall.function?.arguments || toolCall.args || "{}";
            let argsStr = "";
            try {
              const args = typeof toolArgs === "string" ? JSON.parse(toolArgs) : toolArgs;
              argsStr = JSON.stringify(args, null, 2);
            } catch {
              argsStr = String(toolArgs);
            }
            message = `工具调用: ${toolName}(${argsStr.substring(0, 100)}${argsStr.length > 100 ? "..." : ""})`;
            logs.push({ time: timestamp, message });
          });
        }
      } else if (msgType === "ToolMessage") {
        const toolName = msg.kwargs?.name || "unknown";
        const content = msg.kwargs?.content || "";
        const status = msg.kwargs?.status || "success";
        
        // 截断过长的内容
        let contentStr = content;
        if (contentStr.length > 200) {
          contentStr = contentStr.substring(0, 200) + "...";
        }
        
        message = `工具结果 [${toolName}]: ${status === "success" ? "✓" : "✗"} ${contentStr}`;
        logs.push({ time: timestamp, message });
      }
    });

    // 如果 logs 为空，至少添加一个提示
    if (logs.length === 0) {
      logs.push({
        time: new Date().toLocaleTimeString("zh-CN"),
        message: "暂无日志记录",
      });
    }

    return NextResponse.json({
      status,
      progress,
      stage,
      logs,
      todos,
      files,
      toolCalls,
    });
  } catch (error) {
    console.error("[API] 获取执行日志失败:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "获取执行日志失败",
      },
      { status: 500 }
    );
  }
}

