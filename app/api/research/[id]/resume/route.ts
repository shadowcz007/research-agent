import { NextRequest, NextResponse } from "next/server";
import { agentExecutorService } from "@/lib/agent/executor";
import { fileStorage } from "@/lib/storage/file-storage";
import { activeTasks, type Task } from "@/lib/storage/task-storage";
import { load } from "@langchain/core/load";
import { BaseMessage } from "@langchain/core/messages";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 检查任务是否已在 activeTasks 中
    if (activeTasks.has(id)) {
      const task = activeTasks.get(id);
      if (task && (task.status === "processing" || task.status === "pending")) {
        return NextResponse.json(
          { message: "任务已在执行中", status: task.status },
          { status: 200 }
        );
      }
    }

    // 尝试从 agent_raw_result.json 恢复状态
    const savedState = await fileStorage.getAgentRawResult(id);
    let initialMessages: BaseMessage[] | undefined;
    let restoredTask: Partial<Task> | null = null;

    if (savedState) {
      try {
        // 恢复消息历史
        if (savedState.messages && Array.isArray(savedState.messages)) {
          try {
            // 尝试使用 LangChain 的 load 函数反序列化每个消息
            // load 函数期望接收序列化对象的 JSON 字符串
            const loadedMessages: BaseMessage[] = [];
            for (const msgSerialized of savedState.messages) {
              try {
                const msgJson = JSON.stringify(msgSerialized);
                const loaded = await load<BaseMessage>(msgJson);
                loadedMessages.push(loaded);
              } catch (e) {
                console.warn(`[Resume] 无法反序列化消息，跳过:`, e);
                // 如果单个消息反序列化失败，继续处理下一个
              }
            }
            if (loadedMessages.length > 0) {
              initialMessages = loadedMessages;
              console.log(`[Resume] ✅ 恢复了 ${initialMessages.length} 条消息历史`);
            } else {
              console.warn(`[Resume] ⚠️ 无法恢复任何消息，将重新开始`);
            }
          } catch (error) {
            console.error(`[Resume] ⚠️ 恢复消息历史失败:`, error);
            // 降级：如果恢复失败，继续但不使用初始消息
          }
        }

        // 恢复任务状态
        if (savedState.task) {
          restoredTask = {
            status: savedState.task.status || "pending",
            progress: savedState.task.progress || 0,
            stage: savedState.task.stage || "恢复执行",
            logs: [],
            todos: savedState.task.todos || [],
            files: savedState.task.files || {},
            toolCalls: savedState.task.toolCalls || [],
          };
          console.log(`[Resume] ✅ 恢复了任务状态:`, restoredTask);
        }
      } catch (error) {
        console.error(`[Resume] ⚠️ 恢复状态失败，将重新开始:`, error);
        // 降级：如果恢复失败，继续使用 question.txt
      }
    }

    // 读取问题（从 question.txt 或保存的状态中）
    let question: string | null = null;
    if (savedState?.task?.question) {
      question = savedState.task.question;
    } else {
      question = await fileStorage.getQuestion(id);
    }

    if (!question) {
      return NextResponse.json(
        { error: "无法找到问题，请重新创建任务" },
        { status: 404 }
      );
    }

    // 创建或恢复任务
    const task: Task = restoredTask || {
      status: "pending",
      progress: 0,
      stage: "初始化",
      logs: [],
    };

    // 如果恢复了状态，添加恢复日志
    if (restoredTask) {
      task.logs.push({
        time: new Date().toLocaleTimeString("zh-CN"),
        message: "从保存的状态恢复执行",
      });
    }

    activeTasks.set(id, task);
    console.log(`[Resume] 创建/恢复任务 ${id}, 问题: ${question}`);

    // 开始执行（如果提供了初始消息，则继续执行；否则重新开始）
    agentExecutorService
      .execute(id, question, (progress) => {
        const currentTask = activeTasks.get(id);
        if (currentTask) {
          console.log(`[Resume] 任务 ${id} 进度更新: ${progress.progress}% - ${progress.stage} - ${progress.log}`);
          currentTask.progress = progress.progress;
          currentTask.stage = progress.stage;
          currentTask.logs.push({
            time: new Date().toLocaleTimeString("zh-CN"),
            message: progress.log,
          });
          if (progress.progress >= 100) {
            currentTask.status = "completed";
          } else {
            currentTask.status = "processing";
          }
        }
      }, initialMessages)
      .catch((error) => {
        const currentTask = activeTasks.get(id);
        if (currentTask) {
          console.error(`[Resume] 任务 ${id} 执行失败:`, error);
          currentTask.status = "failed";
          currentTask.logs.push({
            time: new Date().toLocaleTimeString("zh-CN"),
            message: `错误: ${error instanceof Error ? error.message : "未知错误"}`,
          });
        }
      });

    return NextResponse.json({
      id,
      message: initialMessages ? "已恢复执行" : "已开始执行",
      restored: !!initialMessages,
    });
  } catch (error) {
    console.error('[Resume] 恢复任务失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "恢复任务失败" },
      { status: 500 }
    );
  }
}

