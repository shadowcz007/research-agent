import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { agentExecutorService } from "@/lib/agent/executor";
import { fileStorage } from "@/lib/storage/file-storage";
import { activeTasks, type Task } from "@/lib/storage/task-storage";

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "问题不能为空" },
        { status: 400 }
      );
    }

    const id = uuidv4();
    const task: Task = {
      status: "pending",
      progress: 0,
      stage: "初始化",
      logs: [],
    };

    activeTasks.set(id, task);
    console.log(`[API] 创建任务 ${id}, 问题: ${question}, activeTasks 大小: ${activeTasks.size}`);

    // Start agent execution in background
    agentExecutorService
      .execute(id, question, (progress) => {
        const task = activeTasks.get(id);
        if (task) {
          console.log(`[API] 任务 ${id} 进度更新: ${progress.progress}% - ${progress.stage} - ${progress.log}`);
          task.progress = progress.progress;
          task.stage = progress.stage;
          task.logs.push({
            time: new Date().toLocaleTimeString("zh-CN"),
            message: progress.log,
          });
          if (progress.progress >= 100) {
            task.status = "completed";
          } else {
            task.status = "processing";
          }
        }
      })
      .catch((error) => {
        const task = activeTasks.get(id);
        if (task) {
          console.error(`[API] 任务 ${id} 执行失败:`, error);
          task.status = "failed";
          task.logs.push({
            time: new Date().toLocaleTimeString("zh-CN"),
            message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
          });
        }
      });

    return NextResponse.json({ id });
  } catch (error) {
    console.error('[API] 创建任务失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "创建研究任务失败" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const tasks = Array.from(activeTasks.entries()).map(([id, task]) => ({
    id,
    ...task,
  }));
  return NextResponse.json({ tasks });
}

