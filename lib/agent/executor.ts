import { HumanMessage } from "@langchain/core/messages";
import { fileStorage } from "../storage/file-storage";
import { agent } from "./research-agent";
import {
  progressCallbacks,
  setCurrentTaskId,
  activeTasks,
  type ProgressCallback,
} from "../storage/task-storage";

export class AgentExecutorService {
  constructor() {
    // Agent is created in research-agent.ts using deepagents
  }

  async execute(
    reportId: string,
    question: string,
    onProgress?: ProgressCallback
  ): Promise<void> {
    console.log(`[Executor] 开始执行任务 ${reportId}`);
    
    // Store progress callback for this task
    if (onProgress) {
      progressCallbacks.set(reportId, onProgress);
      console.log(`[Executor] 已注册进度回调`);
    }

    // Set current task ID so tools can access it
    setCurrentTaskId(reportId);

    try {
      // Save question first
      await fileStorage.saveQuestion(reportId, question);
      if (onProgress) {
        console.log(`[Executor] 发送进度: 记录问题 5%`);
        onProgress({ stage: "记录问题", progress: 5, log: "已记录研究问题" });
      }

      // Execute agent with deepagents
      if (onProgress) {
        console.log(`[Executor] 发送进度: 开始研究 15%`);
        onProgress({ stage: "开始研究", progress: 15, log: "正在搜索相关资料..." });
      }

      // Execute agent using deepagents with streamEvents
      console.log(`[Executor] 开始调用 agent.streamEvents`);
      
      let finalResult: any = null;
      let messageCount = 0;
      let currentProgress = 15;
      
      try {
        const stream = agent.streamEvents(
          {
            messages: [new HumanMessage(question)],
          },
          {
            version: "v2",
            recursionLimit: 100,
          }
        );

        for await (const event of stream) {
          const eventType = event.event;
          
          // Handle different event types
          if (eventType === "on_tool_start") {
            const toolName = event.name;
            console.log(`[Executor] Tool开始: ${toolName}`);
            
            if (onProgress) {
              onProgress({
                stage: `工具调用: ${toolName}`,
                progress: Math.min(currentProgress + 5, 80),
                log: `正在调用工具: ${toolName}...`,
              });
            }
            
            // Record tool call
            const task = activeTasks.get(reportId);
            if (task) {
              if (!task.toolCalls) task.toolCalls = [];
              task.toolCalls.push({
                name: toolName,
                timestamp: new Date().toISOString(),
                args: event.data?.input || {},
              });
            }
          } else if (eventType === "on_tool_end") {
            const toolName = event.name;
            const output = event.data?.output;
            console.log(`[Executor] Tool完成: ${toolName}`);
            
            currentProgress = Math.min(currentProgress + 5, 80);
            
            // Update tool call with output
            const task = activeTasks.get(reportId);
            if (task && task.toolCalls) {
              const lastCall = task.toolCalls[task.toolCalls.length - 1];
              if (lastCall && lastCall.name === toolName) {
                lastCall.output = output;
              }
            }
            
            // Handle specific tools
            if (toolName === "write_todos" && task) {
              try {
                // Parse todos from output
                const todosMatch = output?.match(/Updated todo list to (\[.*\])/);
                if (todosMatch) {
                  const todos = JSON.parse(todosMatch[1]);
                  task.todos = todos;
                  console.log(`[Executor] Todos更新:`, todos);
                  
                  if (onProgress) {
                    const inProgressTodo = todos.find((t: any) => t.status === "in_progress");
                    if (inProgressTodo) {
                      onProgress({
                        stage: inProgressTodo.content,
                        progress: currentProgress,
                        log: `正在执行: ${inProgressTodo.content}`,
                      });
                    }
                  }
                }
              } catch (e) {
                console.error(`[Executor] 解析todos失败:`, e);
              }
            } else if ((toolName === "write_file" || toolName === "edit_file") && task) {
              try {
                // Extract file info from output
                const filePathMatch = output?.match(/['"]([^'"]+)['"]/);
                if (filePathMatch) {
                  const filePath = filePathMatch[1];
                  if (!task.files) task.files = {};
                  task.files[filePath] = {
                    size: 0, // Will be updated later
                    modified_at: new Date().toISOString(),
                    path: filePath,
                  };
                  console.log(`[Executor] 文件${toolName === "write_file" ? "创建" : "编辑"}: ${filePath}`);
                  
                  if (onProgress) {
                    onProgress({
                      stage: "文件操作",
                      progress: currentProgress,
                      log: `${toolName === "write_file" ? "创建" : "编辑"}文件: ${filePath}`,
                    });
                  }
                }
              } catch (e) {
                console.error(`[Executor] 解析文件操作失败:`, e);
              }
            } else if (toolName === "internet_search" && onProgress) {
              onProgress({
                stage: "搜索资料",
                progress: currentProgress,
                log: "搜索完成，正在分析结果...",
              });
            } else if (toolName === "task" && onProgress) {
              onProgress({
                stage: "子任务执行",
                progress: currentProgress,
                log: "子agent执行完成",
              });
            }
          } else if (eventType === "on_chain_end") {
            // Capture the final result
            messageCount++;
            if (event.data?.output) {
              finalResult = event.data.output;
            }
          }
        }
      } catch (streamError) {
        console.error(`[Executor] StreamEvents错误:`, streamError);
        throw streamError;
      }
      
      console.log(`[Executor] agent.streamEvents 完成，消息数: ${messageCount}`);
      
      // Use finalResult as the result
      const result = finalResult || { messages: [] };
      
      // result 临时保存到 json文件，用于排查问题
      await fileStorage.saveAgentRawResult(reportId, result);
      // 从最后一条消息提取报告内容
      if (onProgress) {
        console.log(`[Executor] 发送进度: 提取报告 85%`);
        onProgress({ stage: "提取报告", progress: 85, log: "正在提取报告内容..." });
      }

      const lastMessage = result.messages?.[result.messages.length - 1];
      if (!lastMessage || !("content" in lastMessage) || typeof lastMessage.content !== "string") {
        throw new Error("Agent 未返回有效的报告内容：最后一条消息不存在或格式不正确");
      }

      const reportContent = lastMessage.content;
      if (!reportContent || reportContent.length < 100) {
        throw new Error(`报告内容太短 (${reportContent.length} 字符)，可能未正确生成`);
      }

      console.log(`[Executor] 从最后一条消息提取报告 (长度: ${reportContent.length} 字符)`);
      await fileStorage.saveReport(reportId, reportContent);
      
      if (onProgress) {
        console.log(`[Executor] 发送进度: 撰写报告 90%`);
        onProgress({ stage: "撰写报告", progress: 90, log: "报告已保存" });
      }

      if (onProgress) {
        console.log(`[Executor] 发送进度: 完成 100%`);
        onProgress({ stage: "完成", progress: 100, log: "研究任务已完成" });
      }
    } catch (error) {
      console.error(`[Executor] 任务执行失败:`, error);
      if (onProgress) {
        onProgress({
          stage: "错误",
          progress: 0,
          log: `执行失败: ${error instanceof Error ? error.message : "未知错误"}`,
        });
      }
      throw error;
    } finally {
      // Cleanup: remove progress callback and reset current task ID
      console.log(`[Executor] 清理任务 ${reportId}`);
      progressCallbacks.delete(reportId);
      setCurrentTaskId(null);
    }
  }
}

export const agentExecutorService = new AgentExecutorService();

