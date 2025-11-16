import { NextRequest } from "next/server";
import { activeTasks } from "@/lib/storage/task-storage";

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
      const task = activeTasks.get(id);

      console.log(`[SSE] 任务存在: ${!!task}`, task ? { status: task.status, progress: task.progress } : null);

      if (!task) {
        console.log(`[SSE] 任务不存在，发送错误`);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "任务不存在" })}\n\n`)
        );
        controller.close();
        return;
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

      // Poll for updates
      const interval = setInterval(() => {
        const currentTask = activeTasks.get(id);
        if (!currentTask) {
          console.log(`[SSE] 任务已不存在，关闭连接`);
          clearInterval(interval);
          controller.close();
          return;
        }

        try {
          const updateData = {
            status: currentTask.status,
            progress: currentTask.progress,
            stage: currentTask.stage,
            logs: currentTask.logs,
            todos: currentTask.todos || [],
            files: currentTask.files || {},
            toolCalls: currentTask.toolCalls || [],
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

          if (currentTask.status === "completed" || currentTask.status === "failed") {
            console.log(`[SSE] 任务${currentTask.status === "completed" ? "完成" : "失败"}，关闭连接`);
            clearInterval(interval);
            controller.close();
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

