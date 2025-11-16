import { NextRequest, NextResponse } from "next/server";
import { fileStorage } from "@/lib/storage/file-storage";
import { countTodos } from "@/lib/storage/task-storage";

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
    
    // 方案 C: 尝试获取最终状态（如果 task 有 finalProgress/finalStatus）
    let progress = task.finalProgress ?? task.progress ?? 0;
    let status = task.finalStatus ?? task.status ?? "processing";
    let stage = task.finalStage ?? task.stage ?? "处理中";
    
    // 提取 todos：优先从 task.todos 提取（如果包含嵌套结构则直接使用）
    let todos = task.todos || [];
    
    console.log(`[API] 📋 初始提取的 todos: ${todos.length} 个任务`);
    
    // 如果 task.todos 是平铺的，尝试从 messages 中重建嵌套结构
    if (todos.length > 0) {
      const hasNestedTodos = todos.some((todo: any) => todo.sub_todos && Array.isArray(todo.sub_todos) && todo.sub_todos.length > 0);
      console.log(`[API] 🔍 检查嵌套结构: ${hasNestedTodos ? '有' : '无'}嵌套结构`);
      
      if (!hasNestedTodos) {
        console.log(`[API] 🔄 task.todos 是平铺结构，尝试从 messages 重建嵌套结构`);
        // 尝试从 messages 中查找 write_todos 调用，重建嵌套结构
        const messages = rawResult.messages || [];
        const writeTodosCalls: Array<{ todos: any[]; timestamp: number }> = [];
        
        messages.forEach((msg: any, index: number) => {
          // 查找 write_todos 工具调用
          // 尝试多个可能的路径
          const toolCalls = msg.kwargs?.tool_calls || 
                           msg.kwargs?.additional_kwargs?.tool_calls || 
                           msg.tool_calls || 
                           [];
          
          if (!Array.isArray(toolCalls)) {
            return; // 跳过无效的 toolCalls
          }
          
          toolCalls.forEach((toolCall: any) => {
            const toolName = toolCall.function?.name || 
                           toolCall.name || 
                           toolCall.function?.name ||
                           "";
            
            if (toolName === "write_todos") {
              try {
                const args = toolCall.function?.arguments || 
                           toolCall.args || 
                           toolCall.function?.args ||
                           null;
                
                if (!args) {
                  return; // 跳过没有参数的调用
                }
                
                let parsedArgs: any = null;
                
                if (typeof args === 'string') {
                  try {
                    parsedArgs = JSON.parse(args);
                  } catch (parseError) {
                    console.warn(`[API] 解析 write_todos 参数 JSON 失败 (索引 ${index}):`, parseError);
                    return;
                  }
                } else if (args) {
                  parsedArgs = args;
                } else {
                  return;
                }
                
                if (parsedArgs?.todos && Array.isArray(parsedArgs.todos)) {
                  const hasNested = parsedArgs.todos.some((todo: any) => 
                    todo.sub_todos && Array.isArray(todo.sub_todos) && todo.sub_todos.length > 0
                  );
                  
                  if (hasNested) {
                    writeTodosCalls.push({
                      todos: parsedArgs.todos,
                      timestamp: index,
                    });
                    console.log(`[API] ✅ 找到包含嵌套结构的 write_todos 调用 (索引 ${index}):`, JSON.stringify(parsedArgs.todos, null, 2));
                  } else {
                    // 记录所有 write_todos 调用，即使没有嵌套结构（用于调试）
                    console.log(`[API] 📝 找到 write_todos 调用 (索引 ${index})，但无嵌套结构，包含 ${parsedArgs.todos.length} 个任务`);
                  }
                }
              } catch (e) {
                console.warn(`[API] ⚠️ 解析 write_todos 参数失败 (索引 ${index}):`, e);
              }
            }
          });
        });
        
        // 如果找到包含嵌套结构的调用，使用最新的一个
        if (writeTodosCalls.length > 0) {
          const latestCall = writeTodosCalls[writeTodosCalls.length - 1];
          todos = latestCall.todos;
          console.log(`[API] ✅ 从 messages 重建嵌套结构: ${todos.length} 个顶层任务`);
        } else {
          console.log(`[API] 未找到包含嵌套结构的 write_todos 调用，使用平铺结构`);
        }
      } else {
        const nestedCount = todos.reduce((count: number, todo: any) => {
          return count + (todo.sub_todos?.length || 0);
        }, 0);
        console.log(`[API] ✅ task.todos 已包含嵌套结构: ${todos.length} 个顶层任务，${nestedCount} 个子任务`);
      }
    }
    
    const files = task.files || {};
    const toolCalls = task.toolCalls || [];
    
    // 方案 B: 基于 todos 计算进度
    let calculatedProgress = 0;
    if (todos.length > 0) {
      const { total, completed } = countTodos(todos);
      if (total > 0) {
        calculatedProgress = Math.round((completed / total) * 90);
        // 如果没有最终进度，使用计算值
        if (!task.finalProgress) {
          progress = Math.max(progress, calculatedProgress);
        }
      }
    }
    
    // 方案 A: 检查报告是否存在（最高优先级）
    const reportExists = await fileStorage.getReport(id);
    if (reportExists) {
      progress = 100;
      status = "completed";
      stage = "已完成";
    } else if (calculatedProgress >= 90 && !reportExists) {
      // todos 已完成但报告不存在，可能生成失败
      status = "processing";
      stage = "生成报告中";
    }

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

