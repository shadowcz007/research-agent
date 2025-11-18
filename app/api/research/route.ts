import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { agentExecutorService } from "@/lib/agent/executor";
import { fileStorage } from "@/lib/storage/file-storage";
import { activeTasks, type Task, calculateProgress } from "@/lib/storage/task-storage";

export async function POST(request: NextRequest) {
  try {
    const { question, intentData } = await request.json();

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

    // 如果提供了意图澄清数据，保存到报告目录
    if (intentData) {
      try {
        await fileStorage.saveIntentData(id, intentData);
        console.log(`[API] 已保存意图澄清数据到任务 ${id}`);
      } catch (error) {
        console.error(`[API] 保存意图澄清数据失败:`, error);
        // 不阻止任务创建，继续执行
      }
    }

    // Start agent execution in background
    agentExecutorService
      .execute(id, question, (progressUpdate) => {
        const task = activeTasks.get(id);
        if (task) {
          // 更新 stage 和 log
          task.stage = progressUpdate.stage;
          task.logs.push({
            time: new Date().toLocaleTimeString("zh-CN"),
            message: progressUpdate.log,
          });
          
          // 动态计算进度（基于 todos 完成度）
          task.progress = calculateProgress(task);
          
          console.log(`[API] 任务 ${id} 进度更新: ${task.progress}% - ${task.stage} - ${progressUpdate.log}`);
          
          // 更新状态
          if (task.progress >= 100) {
            task.status = "completed";
          } else if (task.progress > 0) {
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

