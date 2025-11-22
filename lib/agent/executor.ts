import { HumanMessage, BaseMessage } from "@langchain/core/messages";

import { fileStorage } from "../storage/file-storage";
import { createAgentForReport } from "./research-agent";
import {
  progressCallbacks,
  setCurrentTaskId,
  activeTasks,
  type ProgressCallback,
  type Task,
  type Todo,
} from "../storage/task-storage";
import fs from "fs/promises";
import path from "path";

export class AgentExecutorService {
  constructor() {
    // Agent is created in research-agent.ts using deepagents
  }

  // 防抖保存状态
  private saveStateDebounce: Map<string, NodeJS.Timeout> = new Map();
  private readonly SAVE_DEBOUNCE_MS = 2000; // 2秒防抖

  // 保存当前执行状态到 agent_raw_result.json
  private async saveAgentState(
    reportId: string,
    messages?: BaseMessage[]
  ): Promise<void> {
    const task = activeTasks.get(reportId);
    if (!task) return;

    // 清除之前的防抖定时器
    const existingTimer = this.saveStateDebounce.get(reportId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的防抖定时器
    const timer = setTimeout(async () => {
      try {
        const state: any = {
          task: {
            status: task.status,
            progress: task.progress,
            stage: task.stage,
            todos: task.todos || [],
            files: task.files || {},
            toolCalls: task.toolCalls || [],
          },
          timestamp: new Date().toISOString(),
        };

        // 如果提供了消息历史，则保存
        if (messages && messages.length > 0) {
          // 序列化消息为 JSON 格式
          state.messages = messages.map((msg) => {
            // 使用 toJSON 方法序列化消息
            try {
              return (msg as any).toJSON();
            } catch (e) {
              // 如果 toJSON 失败，尝试手动构建
              return {
                lc: 1,
                type: "constructor",
                id: (msg as any).lc_namespace || ["langchain_core", "messages", "BaseMessage"],
                kwargs: {
                  content: (msg as any).content,
                  additional_kwargs: (msg as any).additional_kwargs || {},
                  response_metadata: (msg as any).response_metadata || {},
                  id: (msg as any).id,
                },
              };
            }
          });
        }

        await fileStorage.saveAgentRawResult(reportId, state);
        console.log(`[Executor] ✅ 已保存状态到 agent_raw_result.json${messages ? ` (包含 ${messages.length} 条消息)` : ""}`);
      } catch (error) {
        console.error(`[Executor] 保存状态失败:`, error);
      } finally {
        this.saveStateDebounce.delete(reportId);
      }
    }, this.SAVE_DEBOUNCE_MS);

    this.saveStateDebounce.set(reportId, timer);
  }

  // 记录进度事件到 progress_log.json 并调用 onProgress 回调
  private async logProgressEvent(
    reportId: string,
    progressData: { stage: string; progress: number; log: string; message?: any },
    rawData?: any
  ): Promise<void> {
    try {
      // 处理 rawData，确保包含 event 字段
      let processedRawData = rawData;
      if (rawData && !rawData.event && rawData.name) {
        // 如果 rawData 有 name 但没有 event，尝试从上下文推断
        // 通常 on_tool_start 事件会有 name 字段
        processedRawData = {
          ...rawData,
          event: "on_tool_start", // 默认值，如果确实没有则保持原样
        };
      }

      // 创建带时间戳的日志条目
      const logEntry = {
        timestamp: new Date().toISOString(),
        payload: progressData,
        ...(processedRawData && { rawData: processedRawData }),
      };

      // 立即追加到文件
      await fileStorage.appendProgressLog(reportId, logEntry);

      // 调用原始的 onProgress 回调（如果存在），确保实时推送不受影响
      const onProgress = progressCallbacks.get(reportId);
      if (onProgress) {
        onProgress(progressData);
      }
    } catch (error) {
      console.error(`[Executor] 记录进度事件失败:`, error);
      // 即使记录失败，也尝试调用 onProgress 回调，确保实时视图不受影响
      const onProgress = progressCallbacks.get(reportId);
      if (onProgress) {
        onProgress(progressData);
      }
    }
  }

  async execute(
    reportId: string,
    question: string,
    onProgress?: ProgressCallback,
    initialMessages?: BaseMessage[]
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
      // 确保报告目录存在
      await fileStorage.createReportDir(reportId);

      // 清空进度日志，确保每次执行都从干净的状态开始
      await fileStorage.clearProgressLog(reportId);

      // 不再需要手动保存问题，agent 会自动通过 write_file 保存到 /question.txt
      console.log(`[Executor] Agent 将自动保存问题到 question.txt`);
      console.log(`[Executor] 发送进度: 初始化`);
      await this.logProgressEvent(reportId, { stage: "初始化", progress: 0, log: "准备研究环境" });

      // 检查是否存在意图澄清数据
      const intentData = await fileStorage.getIntentData(reportId);
      if (intentData) {
        console.log(`[Executor] 检测到意图澄清数据，将作为研究上下文使用`);
        // 将研究卡片信息整合到问题中
        if (intentData.researchCard) {
          const researchContext = `研究目标：${intentData.researchCard.goal}\n\n关键问题：\n${intentData.researchCard.questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}\n\n研究范围：${intentData.researchCard.scope}\n\n核心假设：${intentData.researchCard.hypothesis}\n\n---\n\n基于以上研究计划，请开始研究：${question}`;
          question = researchContext;
          console.log(`[Executor] 已整合研究卡片信息到研究问题中`);
        }
      }

      // Execute agent with deepagents
      console.log(`[Executor] 发送进度: 开始研究`);
      await this.logProgressEvent(reportId, { stage: "开始研究", progress: 0, log: "正在搜索相关资料..." });

      // 为此报告创建独立文件系统的 agent
      const agentInstance = createAgentForReport(reportId);

      // 创建 AbortController 用于取消 LLM 请求
      const abortController = new AbortController();
      let task = activeTasks.get(reportId);
      if (task) {
        task.abortController = abortController;
        console.log(`[Executor] 已创建 AbortController 并保存到任务中`);
      }

      // Execute agent using deepagents with streamEvents
      console.log(`[Executor] 开始调用 agent.streamEvents`);
      
      // 使用初始消息历史（如果提供）或创建新的消息
      const initialMessagesArray = initialMessages || [new HumanMessage(question)];
      console.log(`[Executor] 使用 ${initialMessagesArray.length} 条初始消息`);
      
      let finalResult: any = null;
      let messageCount = 0;
      let currentProgress = 15;
      let accumulatedMessages: BaseMessage[] = [...initialMessagesArray];
      
      try {
        const stream = agentInstance.streamEvents(
          {
            messages: initialMessagesArray,
          },
          {
            version: "v2",
            recursionLimit: 100,
            signal: abortController.signal,  // 传递 signal 以支持取消
          }
        );

        for await (const event of stream) {
          // 检查任务是否被取消（检查 cancelled 标志或 signal 是否已中止）
          const currentTask = activeTasks.get(reportId);
          if (currentTask?.cancelled || abortController.signal.aborted) {
            console.log(`[Executor] 任务 ${reportId} 已被取消，停止执行`);
            await this.logProgressEvent(reportId, {
              stage: "已停止",
              progress: currentTask?.progress || 0,
              log: "任务已被用户停止",
            });
            break;
          }

          const eventType = event.event;
          
          // Handle different event types
          if (eventType === "on_tool_start") {
            const toolName = event.name;
            console.log(`[Executor] Tool开始: ${toolName}`);
            
            // 解析工具输入，提取 message 信息
            let message: any = undefined;
            const toolInput = event.data?.input?.input;
            
            if (toolInput && typeof toolInput === 'string') {
              try {
                const parsedInput = JSON.parse(toolInput);
                
                // 根据工具类型提取不同的信息
                if (toolName === "task") {
                  message = {
                    subagent_type: parsedInput.subagent_type,
                    description: parsedInput.description,
                  };
                } else if (toolName === "write_todos") {
                  message = {
                    todos: parsedInput.todos || [],
                  };
                } else if (toolName === "internet_search") {
                  message = {
                    query: parsedInput.query,
                  };
                } else if (toolName === "write_file") {
                  message = {
                    file_path: parsedInput.file_path,
                    content: parsedInput.content,
                  };
                }
              } catch (parseError) {
                console.warn(`[Executor] 解析工具输入失败 (${toolName}):`, parseError);
              }
            } else if (toolInput && typeof toolInput === 'object') {
              // 如果已经是对象，直接使用
              if (toolName === "task") {
                message = {
                  subagent_type: toolInput.subagent_type,
                  description: toolInput.description,
                };
              } else if (toolName === "write_todos") {
                message = {
                  todos: toolInput.todos || [],
                };
              } else if (toolName === "internet_search") {
                message = {
                  query: toolInput.query,
                };
              } else if (toolName === "write_file") {
                message = {
                  file_path: toolInput.file_path,
                  content: toolInput.content,
                };
              }
            }
            
            // 确保 event 对象包含 event 字段
            const eventWithType = {
              ...event,
              event: event.event || "on_tool_start",
            };
            
            await this.logProgressEvent(reportId, {
              stage: `工具调用: ${toolName}`,
              progress: 0,
              log: `正在调用工具: ${toolName}...`,
              ...(message && { message }),
            }, eventWithType);
            
            // Record tool call
            task = activeTasks.get(reportId);
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
            task = activeTasks.get(reportId);
            if (task && task.toolCalls) {
              const lastCall = task.toolCalls[task.toolCalls.length - 1];
              if (lastCall && lastCall.name === toolName) {
                lastCall.output = output;
              }
            }
            
            // Handle specific tools
            if (toolName === "write_todos" && task) {
              try {
                let todos = null;
                
                // 优先从 output.update.todos 提取
                if (output?.update?.todos && Array.isArray(output.update.todos)) {
                  todos = output.update.todos;
                  console.log(`[Executor] 从 output.update.todos 提取 todos (${todos.length} 项):`, JSON.stringify(todos, null, 2));
                }
                // 降级：从 output.update.messages 的字符串中提取
                else if (output?.update?.messages?.[0]?.kwargs?.content) {
                  const content = output.update.messages[0].kwargs.content;
                  const todosMatch = content.match(/Updated todo list to (\[[\s\S]*\])/);
                  if (todosMatch) {
                    try {
                      todos = JSON.parse(todosMatch[1]);
                      console.log(`[Executor] 从 messages 字符串提取 todos (${todos.length} 项):`, JSON.stringify(todos, null, 2));
                    } catch (parseError) {
                      console.warn(`[Executor] ⚠️ 解析 JSON 失败，尝试简单匹配:`, parseError);
                      // 降级：尝试简单匹配
                      const simpleMatch = content.match(/Updated todo list to (\[.*\])/);
                      if (simpleMatch) {
                        todos = JSON.parse(simpleMatch[1]);
                        console.log(`[Executor] 从 messages 字符串提取 todos (简单模式, ${todos.length} 项)`);
                      }
                    }
                  }
                }
                // 最后降级：尝试从字符串格式的 output 提取
                else if (typeof output === 'string') {
                  const todosMatch = output.match(/Updated todo list to (\[[\s\S]*\])/);
                  if (todosMatch) {
                    try {
                      todos = JSON.parse(todosMatch[1]);
                      console.log(`[Executor] 从字符串 output 提取 todos (${todos.length} 项):`, JSON.stringify(todos, null, 2));
                    } catch (parseError) {
                      console.warn(`[Executor] ⚠️ 解析 JSON 失败，尝试简单匹配:`, parseError);
                      // 降级：尝试简单匹配
                      const simpleMatch = output.match(/Updated todo list to (\[.*\])/);
                      if (simpleMatch) {
                        todos = JSON.parse(simpleMatch[1]);
                        console.log(`[Executor] 从字符串 output 提取 todos (简单模式, ${todos.length} 项)`);
                      }
                    }
                  }
                }
                
                if (todos && Array.isArray(todos)) {
                  // 直接更新顶层任务列表（忽略任何可能的 sub_todos 字段）
                  task.todos = todos as Todo[];
                  console.log(`[Executor] ✅ 顶层 Todos 已更新 (${todos.length} 项):`, JSON.stringify(todos, null, 2));
                  
                  const inProgressTodo = todos.find((t: any) => t.status === "in_progress");
                  if (inProgressTodo) {
                    await this.logProgressEvent(reportId, {
                      stage: inProgressTodo.content,
                      progress: 0,
                      log: `正在执行: ${inProgressTodo.content}`,
                    });
                  }
                } else {
                  console.warn(`[Executor] ⚠️ 无法提取 todos，output 结构:`, JSON.stringify(output, null, 2));
                }
              } catch (e) {
                console.error(`[Executor] 解析 todos 失败:`, e, `\nOutput:`, output);
              }
            }
            
            // 监听所有文件系统工具调用（write_file, read_file, edit_file 等）
            const fileTools = ['write_file', 'read_file', 'edit_file', 'ls','glob','grep'];
            if (fileTools.includes(toolName) && task) {
              try {
                // 从工具调用历史中获取参数，而不是从 event.data.input
                const lastToolCall = task.toolCalls?.[task.toolCalls.length - 1];
                const args = lastToolCall?.args;
                let filePath: string | null = null;
                let fileContent: string | null = null;
                let operation = toolName; // 操作类型
                
                // 解析 args（可能是 JSON 字符串或对象）
                if (typeof args === 'string') {
                  try {
                    const parsed = JSON.parse(args);
                    filePath = parsed.file_path || parsed.path;
                    fileContent = parsed.content || parsed.new_content;
                  } catch (e) {
                    console.warn(`[Executor] 无法解析 ${toolName} args:`, args);
                  }
                } else if (args?.file_path || args?.path) {
                  filePath = args.file_path || args.path;
                  fileContent = args.content || args.new_content;
                }
                
                // 检查 output 是否成功
                const outputStatus = output?.kwargs?.status || output?.status;
                const outputContent = output?.kwargs?.content || output?.content;
                const isSuccess = outputStatus === 'success' || 
                                 (typeof outputContent === 'string' && 
                                  (outputContent.includes('Successfully') || 
                                   outputContent.includes('success')));
                
                if (filePath && isSuccess) {
                  // 归一化文件路径（移除开头的 /）
                  const normalizedPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
                  
                  // 初始化 task.files
                  if (!task.files) {
                    task.files = {};
                  }
                  
                  // 根据操作类型处理
                  switch (toolName) {
                    case 'write_file':
                    case 'edit_file':
                      // 写入或编辑文件
                      task.files[normalizedPath] = {
                        path: normalizedPath,
                        content: fileContent || '',
                        size: fileContent ? fileContent.length : 0,
                        modified_at: new Date().toISOString(),
                        operation: toolName,
                      };
                      console.log(`[Executor] ✅ 文件已${toolName === 'write_file' ? '写入' : '编辑'}: ${normalizedPath} (${fileContent?.length || 0} 字符)`);
                      break;
                      
                    case 'read_file':
                      // 读取文件（如果已存在，更新访问时间；否则添加）
                      if (task.files[normalizedPath]) {
                        task.files[normalizedPath].lastAccessed = new Date().toISOString();
                        task.files[normalizedPath].modified_at = new Date().toISOString();
                      } else {
                        // 从 output 提取内容（read_file 的返回内容）
                        const readContent = outputContent || '';
                        task.files[normalizedPath] = {
                          path: normalizedPath,
                          content: readContent,
                          size: readContent.length,
                          modified_at: new Date().toISOString(),
                          operation: 'read_file',
                          lastAccessed: new Date().toISOString(),
                        };
                      }
                      console.log(`[Executor] ✅ 文件已读取: ${normalizedPath}`);
                      break;
                      
                    case 'delete_file':
                      // 删除文件
                      if (task.files[normalizedPath]) {
                        delete task.files[normalizedPath];
                        console.log(`[Executor] ✅ 文件已删除: ${normalizedPath}`);
                      }
                      break;
                      
                    case 'list_files':
                      // 列出文件（记录操作但不修改 files）
                      console.log(`[Executor] ✅ 列出文件: ${filePath || '/'}`);
                      break;
                  }
                } else {
                  console.warn(`[Executor] ⚠️ ${toolName} 未成功或缺少文件路径`, { 
                    filePath, 
                    outputStatus, 
                    toolName,
                    hasLastToolCall: !!lastToolCall,
                    lastToolCallArgs: lastToolCall?.args
                  });
                }
              } catch (e) {
                console.error(`[Executor] 处理 ${toolName} 失败:`, e);
              }
            } else if (toolName === "internet_search") {
              await this.logProgressEvent(reportId, {
                stage: "搜索资料",
                progress: 0,
                log: "搜索完成，正在分析结果...",
              });
            } else if (toolName === "task") {
              await this.logProgressEvent(reportId, {
                stage: "子任务执行",
                progress: 0,
                log: "子agent执行完成",
              });
            }

            // 保存中间状态（防抖，不包含消息历史）
            await this.saveAgentState(reportId);
          } else if (eventType === "on_chain_end") {
            // Capture the final result
            messageCount++;
            if (event.data?.output) {
              finalResult = event.data.output;
              
              // 提取 todos 到 task（仅在 task.todos 为空时更新，避免覆盖）
              task = activeTasks.get(reportId);
              if (finalResult.todos && task) {
                // 只在 task.todos 为空或未定义时更新
                if (!task.todos || task.todos.length === 0) {
                  task.todos = finalResult.todos;
                  console.log(`[Executor] 从 chain_end 提取 todos (初始):`, finalResult.todos);
                } else {
                  console.log(`[Executor] chain_end 包含 todos，但 task.todos 已有数据，跳过覆盖`);
                }
              }

              // 累积消息历史
              if (finalResult.messages && Array.isArray(finalResult.messages)) {
                accumulatedMessages = finalResult.messages;
              }
            }

            // 保存完整状态（包含消息历史）
            await this.saveAgentState(reportId, accumulatedMessages);
          }
        }
      } catch (streamError: any) {
        // 如果是取消操作导致的错误，不抛出异常
        if (streamError?.name === 'AbortError' || abortController.signal.aborted) {
          console.log(`[Executor] 任务 ${reportId} 已被取消（AbortError）`);
          const currentTask = activeTasks.get(reportId);
          if (currentTask) {
            await this.logProgressEvent(reportId, {
              stage: "已停止",
              progress: currentTask.progress,
              log: "任务已被用户停止",
            });
          }
          return; // 优雅退出，不抛出错误
        }
        console.error(`[Executor] StreamEvents错误:`, streamError);
        throw streamError;
      }
      
      console.log(`[Executor] agent.streamEvents 完成，消息数: ${messageCount}`);
      
      // Use finalResult as the result
      const result = finalResult || { messages: accumulatedMessages };
      
      // 确保消息历史被保存
      if (!result.messages || result.messages.length === 0) {
        result.messages = accumulatedMessages;
      }

      // 添加任务状态到结果中
      task = activeTasks.get(reportId);
      if (task) {
        // 标记最终状态
        task.progress = 100;
        task.status = "completed";
        task.stage = "完成";
        
        result.task = {
          status: task.status,
          progress: task.progress,
          stage: task.stage,
          finalProgress: 100,  // 新增：明确的最终进度
          finalStatus: "completed",  // 新增：明确的最终状态
          finalStage: "已完成",  // 新增：明确的最终阶段
          todos: task.todos || [],
          files: task.files || {},
          toolCalls: task.toolCalls || [],
        };
      }

      // 保存最终完整状态到 json文件
      await fileStorage.saveAgentRawResult(reportId, result);
      
      // 清除防抖定时器
      const timer = this.saveStateDebounce.get(reportId);
      if (timer) {
        clearTimeout(timer);
        this.saveStateDebounce.delete(reportId);
      }
      
      // 提取报告内容
      console.log(`[Executor] 发送进度: 提取报告`);
      await this.logProgressEvent(reportId, { stage: "提取报告", progress: 0, log: "正在检查报告文件..." });

      // 检查报告文件是否已通过 FilesystemBackend 创建
      const reportPath = path.join(process.cwd(), "reports", reportId, "final_report.md");

      try {
        const stats = await fs.stat(reportPath);
        console.log(`[Executor] ✅ 报告已通过 FilesystemBackend 直接写入 (大小: ${stats.size} 字节)`);
        
        await this.logProgressEvent(reportId, { stage: "撰写报告", progress: 0, log: "报告已保存到文件系统" });
      } catch (error) {
        // 降级方案：从 result.files 提取
        console.warn(`[Executor] ⚠️ 报告文件不存在，尝试降级方案`, error);
        
        if (result.files && result.files['/final_report.md']) {
          const fileData = result.files['/final_report.md'];
          const reportContent = Array.isArray(fileData.content) 
            ? fileData.content.join('\n') 
            : (typeof fileData.content === 'string' ? fileData.content : String(fileData.content));
          
          console.log(`[Executor] 从 result.files 提取报告 (长度: ${reportContent.length} 字符)`);
          await fileStorage.saveReport(reportId, reportContent);
          
          await this.logProgressEvent(reportId, { stage: "撰写报告", progress: 0, log: "报告已保存" });
        } else {
          throw new Error("Agent 未生成报告文件，FilesystemBackend 可能配置失败");
        }
      }

      console.log(`[Executor] 发送进度: 完成`);
      await this.logProgressEvent(reportId, { stage: "完成", progress: 0, log: "研究任务已完成" });
    } catch (error) {
      console.error(`[Executor] 任务执行失败:`, error);
      
      // 关键修复：更新内存中的任务状态为 failed，否则 SSE 会一直发送 processing
      const task = activeTasks.get(reportId);
      if (task) {
        task.status = "failed";
      }

      await this.logProgressEvent(reportId, {
        stage: "错误",
        progress: 0,
        log: `执行失败: ${error instanceof Error ? error.message : "未知错误"}`,
      });
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

