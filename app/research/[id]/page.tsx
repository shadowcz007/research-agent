"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { User, Settings, FileText, ArrowLeft } from "lucide-react";
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
}

export default function ResearchProgressPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [estimatedTime, setEstimatedTime] = useState("00:07:35");
  
  // 检测是否为历史模式
  const isHistoryMode = searchParams.get("mode") === "history";
  const [loading, setLoading] = useState(isHistoryMode);

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
        setLoading(false);
      } catch (error) {
        console.error("[前端] 获取历史数据出错:", error);
        setLoading(false);
      }
    };

    fetchHistoryData();
  }, [id, isHistoryMode]);

  // 实时模式：建立 SSE 连接
  useEffect(() => {
    if (!id || isHistoryMode) return;

    console.log(`[前端] 建立 SSE 连接，任务 ID: ${id}`);
    const eventSource = new EventSource(`/api/research/${id}/stream`);

    eventSource.onopen = () => {
      console.log('[前端] SSE 连接已建立');
    };

    eventSource.onmessage = (event) => {
      try {
        console.log('[前端] 收到 SSE 消息:', event.data);
        const data = JSON.parse(event.data);
        console.log('[前端] 解析后的数据:', data);
        
        if (data.error) {
          console.error('[前端] 收到错误:', data.error);
          eventSource.close();
          return;
        }
        
        setProgressData(data);

        if (data.status === "completed") {
          console.log('[前端] 任务完成，准备跳转到报告页面');
          eventSource.close();
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
          eventSource.close();
        }
      } catch (error) {
        console.error("[前端] 解析 SSE 数据出错:", error, "原始数据:", event.data);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[前端] SSE 连接错误:', error);
      console.error('[前端] EventSource readyState:', eventSource.readyState);
      eventSource.close();
    };

    return () => {
      console.log('[前端] 清理 SSE 连接');
      eventSource.close();
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

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4 flex justify-between items-center">
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
          {isHistoryMode && (
            <Button
              variant="outline"
              onClick={() => router.push(`/research/${id}/report`)}
              className="gap-2 bg-slate-800/50 text-slate-200 border-slate-600 hover:bg-slate-700 hover:text-white hover:border-slate-500"
            >
              <FileText className="w-4 h-4" />
              查看报告
            </Button>
          )}
    
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {loading && isHistoryMode ? (
          <div className="text-center py-12">
            <p className="text-slate-400">加载历史记录中...</p>
          </div>
        ) : (
          <>
            {/* Progress Overview */}
            <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400 uppercase">
              进度总览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

        {/* Todos and Files Panels */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <TodosPanel todos={progressData?.todos || []} researchId={id} />
          <FilesPanel files={progressData?.files || {}} />
        </div>

        {/* Activity Log */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400 uppercase">
              活动日志
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
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
          </>
        )}
      </div>
    </div>
  );
}

