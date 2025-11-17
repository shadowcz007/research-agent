import { NextRequest, NextResponse } from "next/server";
import { agentExecutorService } from "@/lib/agent/executor";
import { fileStorage } from "@/lib/storage/file-storage";
import { activeTasks, type Task, calculateProgress } from "@/lib/storage/task-storage";
import { load } from "@langchain/core/load";
import { BaseMessage } from "@langchain/core/messages";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const restart = body.restart === true; // 检查是否要重新开始

    // 检查任务是否已在 activeTasks 中
    if (activeTasks.has(id)) {
      const task = activeTasks.get(id);
      if (task && (task.status === "processing" || task.status === "pending")) {
        // 如果是重新开始，允许继续
        if (!restart) {
          return NextResponse.json(
            { message: "任务已在执行中", status: task.status },
            { status: 200 }
          );
        }
      }
    }

    // 如果重新开始，清除现有任务状态并删除 final_report.md 和 agent_raw_result.json
    if (restart) {
      activeTasks.delete(id);
      console.log(`[Resume] 重新开始任务 ${id}，清除现有状态`);
      // 删除 final_report.md
      try {
        await fileStorage.deleteReport(id);
        console.log(`[Resume] ✅ 已删除 final_report.md`);
      } catch (error) {
        console.warn(`[Resume] ⚠️ 删除 final_report.md 失败:`, error instanceof Error ? error.message : error);
        // 不阻止重新开始，继续执行
      }
      // 删除 agent_raw_result.json
      try {
        await fileStorage.deleteAgentRawResult(id);
        console.log(`[Resume] ✅ 已删除 agent_raw_result.json`);
      } catch (error) {
        console.warn(`[Resume] ⚠️ 删除 agent_raw_result.json 失败:`, error instanceof Error ? error.message : error);
        // 不阻止重新开始，继续执行
      }
    }

    // 尝试从 agent_raw_result.json 恢复状态（仅在非重新开始模式下）
    const savedState = restart ? null : await fileStorage.getAgentRawResult(id);
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
    const task: Task = restoredTask ? {
      status: restoredTask.status || "pending",
      progress: restoredTask.progress ?? 0,
      stage: restoredTask.stage || "初始化",
      logs: restoredTask.logs || [],
      todos: restoredTask.todos,
      files: restoredTask.files,
      toolCalls: restoredTask.toolCalls,
      cancelled: false, // 重置取消标志
      abortController: undefined, // 重置 AbortController，执行时会创建新的
    } : {
      status: "pending",
      progress: 0,
      stage: "初始化",
      logs: [],
      cancelled: false, // 重置取消标志
      abortController: undefined, // 重置 AbortController，执行时会创建新的
    };

    // 如果恢复了状态，添加恢复日志
    if (restoredTask && !restart) {
      task.logs.push({
        time: new Date().toLocaleTimeString("zh-CN"),
        message: "从保存的状态恢复执行",
      });
    } else if (restart) {
      task.logs.push({
        time: new Date().toLocaleTimeString("zh-CN"),
        message: "重新开始执行任务",
      });
    }

    activeTasks.set(id, task);
    console.log(`[Resume] 创建/恢复任务 ${id}, 问题: ${question}`);

    // 开始执行（如果提供了初始消息，则继续执行；否则重新开始）
    agentExecutorService
      .execute(id, question, (progressUpdate) => {
        const currentTask = activeTasks.get(id);
        if (currentTask) {
          // 更新 stage 和 log
          currentTask.stage = progressUpdate.stage;
          currentTask.logs.push({
            time: new Date().toLocaleTimeString("zh-CN"),
            message: progressUpdate.log,
          });
          
          // 动态计算进度（基于 todos 完成度）
          currentTask.progress = calculateProgress(currentTask);
          
          console.log(`[Resume] 任务 ${id} 进度更新: ${currentTask.progress}% - ${currentTask.stage} - ${progressUpdate.log}`);
          
          // 更新状态
          if (currentTask.progress >= 100) {
            currentTask.status = "completed";
          } else if (currentTask.progress > 0) {
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

