"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { User, Settings, FileText, ArrowLeft, RotateCcw, Square, Play } from "lucide-react";
import { TodosPanel } from "@/components/research/todos-panel";
import { FilesPanel } from "@/components/research/files-panel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Todo {
  content: string;
  status: string;
  id?: string;
  sub_todos?: Todo[];  // 支持嵌套子任务
}

interface ProgressData {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  logs: Array<{ time: string; message: string }>;
  todos?: Todo[];
  files?: Record<string, { size: number; modified_at: string; path: string }>;
  toolCalls?: Array<{ name: string; timestamp: string; args: any; output?: any }>;
  question?: string;
}

export default function ResearchProgressPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [estimatedTime, setEstimatedTime] = useState("00:07:35");
  const [question, setQuestion] = useState<string>("");
  const [isRestarting, setIsRestarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // 检测是否为历史模式
  const isHistoryMode = searchParams.get("mode") === "history";
  const [loading, setLoading] = useState(isHistoryMode);

  // 获取question
  useEffect(() => {
    if (!id) return;

    const fetchQuestion = async () => {
      try {
        const res = await fetch(`/api/reports/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.question) {
            setQuestion(data.question);
          }
        }
      } catch (error) {
        console.error("[前端] 获取question失败:", error);
      }
    };

    fetchQuestion();
  }, [id]);

  // 历史模式：从 API 加载数据
  useEffect(() => {
    if (!id || !isHistoryMode) return;

    const fetchHistoryData = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reports/${id}/logs`);
        const data = await res.json();

        if (data.error) {
          console.error("[前端] 获取历史数据失败:", data.error);
          setLoading(false);
          return;
        }

        console.log("[前端] 历史模式数据接收:", {
          todosCount: data.todos?.length || 0,
          hasNestedTodos: data.todos?.some((t: Todo) => t.sub_todos && t.sub_todos.length > 0) || false,
          todos: data.todos,
        });
        setProgressData(data);
        // 如果历史数据中包含question，更新question状态
        if (data.question) {
          setQuestion(data.question);
        }
        setLoading(false);
      } catch (error) {
        console.error("[前端] 获取历史数据出错:", error);
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, [id, isHistoryMode]);

  // 实时模式：建立 SSE 连接
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!id || isHistoryMode) return;

    // 清理旧的连接（如果存在）
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 在建立 SSE 连接前，先检查任务是否已完成且报告是否存在
    const checkTaskStatus = async () => {
      try {
        // 先检查任务状态（通过 logs API）
        const logsRes = await fetch(`/api/reports/${id}/logs`);
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          if (logsData.status === "completed") {
            // 任务已完成，检查报告是否存在
            const reportRes = await fetch(`/api/reports/${id}`);
            if (reportRes.ok) {
              const reportData = await reportRes.json();
              if (!reportData.error && reportData.content) {
                // 报告已存在，直接跳转
                console.log('[前端] 刷新检测：任务已完成且报告已存在，跳转到报告页面');
                router.push(`/research/${id}/report`);
                return true; // 返回 true 表示已跳转，不需要建立 SSE 连接
              }
            }
          }
        }
      } catch (error) {
        console.error('[前端] 检查任务状态失败:', error);
      }
      return false; // 返回 false 表示需要建立 SSE 连接
    };

    // 检查任务状态，如果已完成则跳转，否则建立 SSE 连接
    checkTaskStatus().then((shouldSkip) => {
      if (shouldSkip) {
        return; // 已跳转，不需要建立 SSE 连接
      }

      console.log(`[前端] 建立 SSE 连接，任务 ID: ${id}`);
      eventSourceRef.current = new EventSource(`/api/research/${id}/stream`);
      const eventSource = eventSourceRef.current;

      eventSource.onopen = () => {
        console.log('[前端] SSE 连接已建立');
      };

      eventSource.onmessage = (event) => {
        try {
          // console.log('[前端] 收到 SSE 消息:', event.data);
          const data = JSON.parse(event.data);
          console.log('[前端] 解析后的数据:', data);

          if (data.error) {
            console.error('[前端] 收到错误:', data.error);
            eventSource?.close();
            return;
          }

          setProgressData(data);
          // 如果SSE数据中包含question，更新question状态
          if (data.question) {
            setQuestion(data.question);
          }

          if (data.status === "completed") {
            console.log('[前端] 任务完成，准备跳转到报告页面');
            eventSource?.close();
            // Wait for report to be available before redirecting
            const checkReport = async () => {
              let attempts = 0;
              const maxAttempts = 15;
              const delay = 1000; // 1 second

              while (attempts < maxAttempts) {
                try {
                  const res = await fetch(`/api/reports/${id}`);
                  if (res.ok) {
                    const reportData = await res.json();
                    if (!reportData.error && reportData.content) {
                      // Report is ready, redirect
                      console.log('[前端] 报告已就绪，跳转');
                      router.push(`/research/${id}/report`);
                      return;
                    }
                  }
                } catch (error) {
                  console.error("Error checking report:", error);
                }

                attempts++;
                if (attempts < maxAttempts) {
                  await new Promise((resolve) => setTimeout(resolve, delay));
                }
              }

              // If report still not available after max attempts, redirect anyway
              // The report page will handle retrying
              console.log('[前端] 报告检查超时，仍然跳转');
              router.push(`/research/${id}/report`);
            };

            checkReport();
          } else if (data.status === "failed") {
            console.log('[前端] 任务失败');
            eventSource?.close();
          }
        } catch (error) {
          console.error("[前端] 解析 SSE 数据出错:", error, "原始数据:", event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[前端] SSE 连接错误:', error);
        console.error('[前端] EventSource readyState:', eventSource?.readyState);
        eventSource?.close();
      };
    });

    return () => {
      console.log('[前端] 清理 SSE 连接');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [id, router, isHistoryMode]);

  // Calculate estimated time remaining based on progress
  useEffect(() => {
    if (progressData && progressData.progress > 0 && progressData.progress < 100) {
      const elapsed = 60; // Assume 60 seconds elapsed for demo
      const total = (elapsed / progressData.progress) * 100;
      const remaining = total - elapsed;
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      setEstimatedTime(
        `00:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }
  }, [progressData]);

  // 处理继续任务
  const handleResume = async () => {
    if (isRestarting) return;

    setIsRestarting(true);
    try {
      const res = await fetch(`/api/research/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: false }), // 继续执行，不重新开始
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "继续任务失败");
      }

      // 重新加载页面以刷新状态
      window.location.reload();
    } catch (error) {
      console.error("继续任务失败:", error);
      alert(error instanceof Error ? error.message : "继续任务失败，请重试");
    } finally {
      setIsRestarting(false);
    }
  };

  // 处理重新开始（实时模式）
  const handleRestart = async () => {
    if (isRestarting) return;

    // 先检查任务是否正在运行，如果是，先停止
    const isTaskRunning = progressData?.status === "processing" || progressData?.status === "pending";
    
    if (isTaskRunning) {
      if (!confirm("任务正在运行中，需要先停止任务才能重新开始。确定要继续吗？")) {
        return;
      }
      
      // 先停止任务
      try {
        const stopRes = await fetch(`/api/research/${id}/stop`, {
          method: "POST",
        });
        
        if (!stopRes.ok) {
          const data = await stopRes.json();
          throw new Error(data.error || "停止任务失败");
        }
        
        // 等待一下确保任务已停止
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error("停止任务失败:", error);
        alert(error instanceof Error ? error.message : "停止任务失败，请重试");
        return;
      }
    }

    if (!confirm("确定要重新开始吗？这将删除所有进度数据并从头开始执行任务。")) {
      return;
    }

    setIsRestarting(true);
    try {
      const res = await fetch(`/api/research/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: true }), // 传递restart标志，让后端知道要重新开始并删除数据
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "重新开始失败");
      }

      // 重新加载页面以刷新状态
      window.location.reload();
    } catch (error) {
      console.error("重新开始失败:", error);
      alert(error instanceof Error ? error.message : "重新开始失败，请重试");
    } finally {
      setIsRestarting(false);
    }
  };

  // 处理重新开始（历史模式）
  const handleRestartFromHistory = async () => {
    if (isRestarting) return;

    if (!confirm("确定要重新开始吗？这将删除已生成的最终报告，然后从头开始执行任务。")) {
      return;
    }

    setIsRestarting(true);
    try {
      const res = await fetch(`/api/research/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restart: true }), // 传递restart标志，让后端知道要重新开始并删除final_report.md
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "重新开始失败");
      }

      // 使用 replace 跳转到实时模式（去掉 mode=history 参数），替换当前历史记录
      // 这样用户点击返回按钮时不会回到历史模式页面
      router.replace(`/research/${id}`);
    } catch (error) {
      console.error("重新开始失败:", error);
      alert(error instanceof Error ? error.message : "重新开始失败，请重试");
    } finally {
      setIsRestarting(false);
    }
  };

  // 处理停止任务
  const handleStop = async () => {
    if (isStopping) return;

    if (!confirm("确定要停止当前任务吗？")) {
      return;
    }

    setIsStopping(true);
    try {
      const res = await fetch(`/api/research/${id}/stop`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "停止任务失败");
      }

      // 刷新页面以更新状态
      window.location.reload();
    } catch (error) {
      console.error("停止任务失败:", error);
      alert(error instanceof Error ? error.message : "停止任务失败，请重试");
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">

      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
            title="回到首页"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">首页</span>
          </button>
          <div className="h-6 w-px bg-slate-700" />
          <div>
            <h1 className="text-2xl font-bold">RESEARCH AGENT</h1>
            <p className="text-slate-400 text-sm">
              {isHistoryMode ? "历史记录" : "REAL-TIME PROGRESS"}
            </p>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          {!isHistoryMode && (
            <>
              {/* 如果任务被停止（failed 状态），显示继续按钮 */}
              {progressData?.status === "failed" && (
                <Button
                  variant="outline"
                  onClick={handleResume}
                  disabled={isRestarting || isStopping}
                  className="gap-2 bg-green-900/50 text-green-200 border-green-600 hover:bg-green-800 hover:text-white hover:border-green-500"
                >
                  <Play className="w-4 h-4" />
                  {isRestarting ? "继续中..." : "继续"}
                </Button>
              )}
              {/* 如果任务正在运行或已完成，显示重新开始按钮 */}
              {progressData?.status !== "failed" && (
                <Button
                  variant="outline"
                  onClick={handleRestart}
                  disabled={isRestarting || isStopping}
                  className="gap-2 bg-slate-800/50 text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white hover:border-slate-500"
                >
                  <RotateCcw className="w-4 h-4" />
                  {isRestarting ? "重新开始中..." : "重新开始"}
                </Button>
              )}
              {/* 停止按钮：只在任务正在运行时显示 */}
              {progressData?.status === "processing" || progressData?.status === "pending" ? (
                <Button
                  variant="outline"
                  onClick={handleStop}
                  disabled={isStopping}
                  className="gap-2 bg-red-900/50 text-red-200 border-red-600 hover:bg-red-800 hover:text-white hover:border-red-500"
                >
                  <Square className="w-4 h-4" />
                  {isStopping ? "停止中..." : "停止任务"}
                </Button>
              ) : null}
            </>
          )}
          {isHistoryMode && (
            <>
              <Button
                variant="outline"
                onClick={handleRestartFromHistory}
                disabled={isRestarting}
                className="gap-2 bg-slate-800/50 text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white hover:border-slate-500"
              >
                <RotateCcw className="w-4 h-4" />
                {isRestarting ? "重新开始中..." : "重新开始"}
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(`/research/${id}/report`)}
                className="gap-2 bg-slate-800/50 text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white hover:border-slate-500"
              >
                <FileText className="w-4 h-4" />
                查看报告
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 bg-slate-900 overflow-hidden">
        <div className="container mx-auto px-6 py-6 h-full flex flex-col">
          {loading && isHistoryMode ? (
            <div className="text-center py-12">
              <p className="text-slate-400">加载历史记录中...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6 flex-1 min-h-0">
            {/* 左上：Question Display */}
            <Card className="bg-slate-800 border-slate-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-sm text-slate-400 uppercase">
                  研究问题
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {question ? (
                  <p className="text-xl text-white font-semibold leading-relaxed">{question}</p>
                ) : (
                  <p className="text-slate-500 text-sm">等待问题加载...</p>
                )}
              </CardContent>
            </Card>

            {/* 右上：Progress Overview */}
            <Card className="bg-slate-800 border-slate-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-sm text-slate-400 uppercase">
                  进度总览
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 overflow-auto">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-white">
                    {progressData?.stage || "初始化中..."}
                  </h2>
                  <Progress
                    value={progressData?.progress || 0}
                    className="h-3"
                  />
                  <p className="text-slate-400 mt-2">
                    {progressData?.progress || 0}% 完成
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-400">
                      {progressData?.todos?.length || 0}
                    </p>
                    <p className="text-sm text-slate-400">任务</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">
                      {Object.keys(progressData?.files || {}).length}
                    </p>
                    <p className="text-sm text-slate-400">文件</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-400">
                      {progressData?.toolCalls?.length || 0}
                    </p>
                    <p className="text-sm text-slate-400">工具调用</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 左下：Todos Panel */}
            <div className="flex flex-col min-h-0 h-full">
              <TodosPanel todos={progressData?.todos || []} researchId={id} />
            </div>

            {/* 右下：Activity Log */}
            <Card className="bg-slate-800 border-slate-700 flex flex-col overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <CardTitle className="text-sm text-slate-400 uppercase">
                  活动日志
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 p-6 pt-0">
                <ScrollArea className="h-full">
                  <div className="space-y-4 pr-4">
                    {progressData?.logs?.map((log, index) => (
                      <div key={index} className="flex gap-4 text-sm">
                        <span className="text-slate-500 font-mono min-w-[80px] flex-shrink-0">
                          {log.time}
                        </span>
                        <div className="flex-1 min-w-0 prose prose-sm prose-invert max-w-none overflow-x-auto">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {log.message}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {(!progressData?.logs || progressData.logs.length === 0) && (
                      <p className="text-slate-500">
                        {isHistoryMode ? "暂无日志记录" : "等待活动日志..."}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

