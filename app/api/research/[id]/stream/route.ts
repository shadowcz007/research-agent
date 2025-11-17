import { NextRequest } from "next/server";
import { activeTasks, type Task } from "@/lib/storage/task-storage";
import { fileStorage } from "@/lib/storage/file-storage";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  console.log(`[SSE] 客户端连接，任务 ID: ${id}`);
  console.log(`[SSE] activeTasks 大小: ${activeTasks.size}`);
  console.log(`[SSE] activeTasks 包含的任务 ID:`, Array.from(activeTasks.keys()));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let task = activeTasks.get(id);

      // 如果任务不在 activeTasks 中，尝试从 agent_raw_result.json 恢复
      if (!task) {
        console.log(`[SSE] 任务不在 activeTasks 中，尝试从 agent_raw_result.json 恢复`);
        try {
          const savedState = await fileStorage.getAgentRawResult(id);
          if (savedState && savedState.task) {
            // 恢复任务状态
            task = {
              status: savedState.task.status || "completed",
              progress: savedState.task.progress ?? (savedState.task.status === "completed" ? 100 : 0),
              stage: savedState.task.stage || (savedState.task.status === "completed" ? "完成" : "初始化"),
              logs: savedState.task.logs || [],
              todos: savedState.task.todos || [],
              files: savedState.task.files || {},
              toolCalls: savedState.task.toolCalls || [],
            };
            
            // 如果任务还在进行中，添加到 activeTasks 以便继续监控
            if (task.status === "processing" || task.status === "pending") {
              activeTasks.set(id, task);
              console.log(`[SSE] ✅ 已恢复进行中的任务状态到 activeTasks`);
            } else {
              console.log(`[SSE] ✅ 已恢复已完成/失败的任务状态（只读模式）`);
            }
          }
        } catch (error) {
          console.warn(`[SSE] 恢复任务状态失败:`, error);
        }
      }

      console.log(`[SSE] 任务存在: ${!!task}`, task ? { status: task.status, progress: task.progress } : null);

      if (!task) {
        console.log(`[SSE] 任务不存在，发送错误`);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "任务不存在" })}\n\n`)
        );
        controller.close();
        return;
      }

      // 获取question
      let question: string | null = null;
      try {
        question = await fileStorage.getQuestion(id);
      } catch (error) {
        console.warn(`[SSE] 获取question失败:`, error);
      }

      // Send initial state
      const initialData = {
        status: task.status,
        progress: task.progress,
        stage: task.stage,
        logs: task.logs,
        todos: task.todos || [],
        files: task.files || {},
        toolCalls: task.toolCalls || [],
        question: question || undefined,
      };
      
      // 检查初始状态是否包含嵌套结构
      if (initialData.todos.length > 0) {
        const hasNestedTodos = initialData.todos.some((todo: any) => todo.sub_todos && Array.isArray(todo.sub_todos) && todo.sub_todos.length > 0);
        if (hasNestedTodos) {
          const nestedCount = initialData.todos.reduce((count: number, todo: any) => {
            return count + (todo.sub_todos?.length || 0);
          }, 0);
          console.log(`[SSE] 📊 初始状态包含嵌套结构: ${initialData.todos.length} 个顶层任务，${nestedCount} 个子任务`);
        }
      }
      
      console.log(`[SSE] 发送初始状态:`, initialData);
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify(initialData)}\n\n`
        )
      );

      // 如果任务已完成或失败，发送状态后延迟关闭连接
      if (task.status === "completed" || task.status === "failed" || task.stage === "完成") {
        const isCompleted = task.status === "completed" || task.stage === "完成";
        console.log(`[SSE] 任务${isCompleted ? "完成" : "失败"}，发送最终状态后延迟关闭连接`);
        
        // 确保发送最终状态（可能包含最新的日志）
        const finalData = {
          ...initialData,
          status: isCompleted ? "completed" : task.status,
          stage: task.stage,
        };
        
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`)
        );
        
        // 等待 2000ms，确保前端收到完成状态并处理
        setTimeout(() => {
          console.log(`[SSE] 延迟关闭连接`);
          controller.close();
        }, 2000);
        return;
      }

      // Poll for updates (仅当任务还在进行中时)
      const interval = setInterval(async () => {
        const currentTask = activeTasks.get(id);
        if (!currentTask) {
          console.log(`[SSE] 任务已不存在，关闭连接`);
          clearInterval(interval);
          controller.close();
          return;
        }

        try {
          // 每次轮询时重新读取question，确保能获取到agent写入的question.txt
          let currentQuestion: string | null = null;
          try {
            currentQuestion = await fileStorage.getQuestion(id);
          } catch (error) {
            console.warn(`[SSE] 轮询时获取question失败:`, error);
          }

          const updateData = {
            status: currentTask.status,
            progress: currentTask.progress,
            stage: currentTask.stage,
            logs: currentTask.logs,
            todos: currentTask.todos || [],
            files: currentTask.files || {},
            toolCalls: currentTask.toolCalls || [],
            question: currentQuestion || undefined,
          };
          console.log(`[SSE] 发送更新 [${updateData.status}] ${updateData.progress}% - ${updateData.stage} - 日志数: ${updateData.logs.length} - Todos: ${updateData.todos.length} - 文件: ${Object.keys(updateData.files).length}`);
          
          // 当 todos 或 files 有变化时，输出详细信息（包括嵌套结构）
          if (updateData.todos.length > 0) {
            const hasNestedTodos = updateData.todos.some((todo: any) => todo.sub_todos && Array.isArray(todo.sub_todos) && todo.sub_todos.length > 0);
            if (hasNestedTodos) {
              const nestedCount = updateData.todos.reduce((count: number, todo: any) => {
                return count + (todo.sub_todos?.length || 0);
              }, 0);
              console.log(`[SSE] 📊 Todos 包含嵌套结构: ${updateData.todos.length} 个顶层任务，${nestedCount} 个子任务`);
            }
            console.log(`[SSE] Todos 详情:`, JSON.stringify(updateData.todos, null, 2));
          }
          if (Object.keys(updateData.files).length > 0) {
            console.log(`[SSE] Files 详情:`, JSON.stringify(Object.keys(updateData.files), null, 2));
          }
          
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify(updateData)}\n\n`
            )
          );

          // 检测到完成状态时，延迟关闭连接
          if (currentTask.status === "completed" || currentTask.status === "failed" || currentTask.stage === "完成") {
            const isCompleted = currentTask.status === "completed" || currentTask.stage === "完成";
            console.log(`[SSE] 检测到任务${isCompleted ? "完成" : "失败"}，发送状态后延迟关闭连接`);
            clearInterval(interval);
            
            // 等待 2000ms，确保前端收到完成状态并处理
            setTimeout(() => {
              console.log(`[SSE] 延迟关闭连接`);
              controller.close();
            }, 2000);
          }
        } catch (error) {
          console.error(`[SSE] 发送更新时出错:`, error);
          clearInterval(interval);
          controller.close();
        }
      }, 1000); // Poll every second

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", () => {
        console.log(`[SSE] 客户端断开连接`);
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

