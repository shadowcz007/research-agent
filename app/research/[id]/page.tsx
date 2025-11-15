"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { User, Settings } from "lucide-react";
import { TodosPanel } from "@/components/research/todos-panel";
import { FilesPanel } from "@/components/research/files-panel";

interface ProgressData {
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  logs: Array<{ time: string; message: string }>;
  todos?: Array<{ content: string; status: string; id?: string }>;
  files?: Record<string, { size: number; modified_at: string; path: string }>;
  toolCalls?: Array<{ name: string; timestamp: string; args: any; output?: any }>;
}

export default function ResearchProgressPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [progressData, setProgressData] = useState<ProgressData | null>(null);
  const [estimatedTime, setEstimatedTime] = useState("00:07:35");

  useEffect(() => {
    if (!id) return;

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
  }, [id, router]);

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
        <div>
          <h1 className="text-2xl font-bold">RESEARCH AGENT</h1>
          <p className="text-slate-400 text-sm">REAL-TIME PROGRESS</p>
        </div>
        <div className="flex gap-4">
          <User className="w-6 h-6 cursor-pointer hover:text-blue-400" />
          <Settings className="w-6 h-6 cursor-pointer hover:text-blue-400" />
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Progress Overview */}
        <Card className="bg-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-sm text-slate-400 uppercase">
              进度总览
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h2 className="text-2xl font-bold mb-2">
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
          <TodosPanel todos={progressData?.todos || []} />
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
                    <span className="text-slate-500 font-mono min-w-[80px]">
                      {log.time}
                    </span>
                    <span className="text-slate-300">{log.message}</span>
                  </div>
                ))}
                {(!progressData?.logs || progressData.logs.length === 0) && (
                  <p className="text-slate-500">等待活动日志...</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

