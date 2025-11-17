import { NextRequest, NextResponse } from "next/server";
import { activeTasks } from "@/lib/storage/task-storage";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const task = activeTasks.get(id);

    if (!task) {
      return NextResponse.json(
        { error: "任务不存在" },
        { status: 404 }
      );
    }

    // 如果任务已经完成或失败，不能停止
    if (task.status === "completed" || task.status === "failed") {
      return NextResponse.json(
        { error: "任务已经完成或失败，无法停止" },
        { status: 400 }
      );
    }

    // 设置取消标志
    task.cancelled = true;
    task.status = "failed";
    task.logs.push({
      time: new Date().toLocaleTimeString("zh-CN"),
      message: "任务已被用户停止",
    });

    // 调用 AbortController 来真正取消 LLM 请求
    if (task.abortController) {
      task.abortController.abort();
      console.log(`[Stop] 已调用 AbortController.abort() 取消 LLM 请求`);
    } else {
      console.log(`[Stop] 警告: 任务 ${id} 没有 AbortController，可能任务尚未开始执行`);
    }

    console.log(`[Stop] 任务 ${id} 已被停止`);

    return NextResponse.json({
      message: "任务已停止",
      id,
    });
  } catch (error) {
    console.error('[Stop] 停止任务失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "停止任务失败" },
      { status: 500 }
    );
  }
}


