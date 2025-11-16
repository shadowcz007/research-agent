"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Cloud, Edit, Send, Download, User, FileText } from "lucide-react";

interface ReportData {
  id: string;
  question: string;
  content: string;
  versions: Array<{ version: string; date: string }>;
}

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 2000; // 2 seconds

    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/reports/${id}`);
        const data = await res.json();
        
        if (data.error) {
          console.error(data.error);
          
          // If report doesn't exist and we haven't exceeded retries, retry
          if (res.status === 404 && retryCount < maxRetries) {
            retryCount++;
            console.log(`报告尚未准备好，${retryDelay / 1000}秒后重试 (${retryCount}/${maxRetries})...`);
            setTimeout(fetchReport, retryDelay);
            return;
          }
          
          // If we've exhausted retries or it's a different error, stop loading
          setLoading(false);
          return;
        }
        
        // Successfully fetched report
        setReportData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching report:", error);
        
        // Retry on network errors
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`获取报告失败，${retryDelay / 1000}秒后重试 (${retryCount}/${maxRetries})...`);
          setTimeout(fetchReport, retryDelay);
        } else {
          setLoading(false);
        }
      }
    };

    fetchReport();
  }, [id]);

  const handleDownload = () => {
    window.open(`/api/reports/${id}?download=true`, "_blank");
  };

  const handleViewLogs = () => {
    router.push(`/research/${id}?mode=history`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-2">加载中...</p>
          <p className="text-slate-400 text-sm">正在等待报告生成完成</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-2">报告不存在</p>
          <p className="text-slate-400 text-sm mb-4">
            报告可能仍在生成中，或生成过程中出现错误
          </p>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            刷新页面
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-600">New Research</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Cloud className="w-5 h-5" />
            </Button>
            <Button variant="outline" className="gap-2">
              <Edit className="w-4 h-4" />
              Edit
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Send className="w-4 h-4" />
              Send for Review
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-slate-900">
                  {reportData.question || "研究报告"}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-slate-600 mt-4">
                  <span>{new Date().toLocaleDateString("zh-CN")}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>Authored by: Research Agent v2.1</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDownload}
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    下载报告
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleViewLogs}
                    className="gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    查看执行日志
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {reportData.content}
                  </ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* History & Feedback */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg">History & Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="versions" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="versions">Versions</TabsTrigger>
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                  </TabsList>
                  <TabsContent value="versions" className="mt-4">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {reportData.versions.map((version, index) => (
                          <div
                            key={index}
                            className="p-2 hover:bg-slate-50 rounded cursor-pointer"
                          >
                            <div className="font-medium">{version.version}</div>
                            <div className="text-sm text-slate-500">
                              {new Date(version.date).toLocaleDateString("zh-CN")}
                            </div>
                          </div>
                        ))}
                        {reportData.versions.length === 0 && (
                          <p className="text-slate-500 text-sm">暂无版本历史</p>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="feedback" className="mt-4">
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-4">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm">
                            <User className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm text-slate-700">
                              Suggest expanding on error correction techniques
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm">
                            DC
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">Dr. Ben Carter</span>
                            </div>
                            <p className="text-sm text-slate-700">
                              Check recent breakthroughs in quantum computing
                            </p>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

