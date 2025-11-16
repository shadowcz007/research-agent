"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Mic, Clock, FileText } from "lucide-react";

interface ReportMetadata {
  id: string;
  question: string;
  createdAt: string;
  updatedAt: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  stage?: string;
}

export default function HomePage() {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState<ReportMetadata[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const router = useRouter();

  const exampleQuestions = [
    "气候变化对珊瑚礁有什么影响？",
    "人工智能在医疗保健领域的历史",
    "可再生能源技术的最新发展？",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) throw new Error("创建研究任务失败");

      const { id } = await response.json();
      router.push(`/research/${id}`);
    } catch (error) {
      console.error("Error:", error);
      alert("创建研究任务失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExampleClick = (example: string) => {
    setQuestion(example);
  };

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetch("/api/reports");
        if (!response.ok) throw new Error("获取报告列表失败");
        const data = await response.json();
        // 按更新时间倒序排列（最新的在前）
        const sortedReports = (data.reports || []).sort(
          (a: ReportMetadata, b: ReportMetadata) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
        setReports(sortedReports);
      } catch (error) {
        console.error("Error fetching reports:", error);
      } finally {
        setReportsLoading(false);
      }
    };

    fetchReports();
  }, []);

  const getStatusColor = (status: ReportMetadata["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "processing":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: ReportMetadata["status"]) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "processing":
        return "处理中";
      case "pending":
        return "待处理";
      case "failed":
        return "失败";
      default:
        return status;
    }
  };

  const handleReportClick = async (report: ReportMetadata) => {
    // 根据报告状态决定行为
    if (report.status === "pending") {
      // 待处理：调用恢复执行 API，然后跳转到进度页面
      try {
        const response = await fetch(`/api/research/${report.id}/resume`, {
          method: "POST",
        });
        if (!response.ok) {
          const error = await response.json();
          alert(`恢复执行失败: ${error.error || "未知错误"}`);
          return;
        }
        router.push(`/research/${report.id}`);
      } catch (error) {
        console.error("恢复执行失败:", error);
        alert("恢复执行失败，请重试");
      }
    } else if (report.status === "completed") {
      // 已完成：跳转到报告详情页
      router.push(`/research/${report.id}/report`);
    } else if (report.status === "processing") {
      // 处理中：跳转到进度页面
      router.push(`/research/${report.id}`);
    } else if (report.status === "failed") {
      // 失败：跳转到进度页面（可以查看错误信息）
      router.push(`/research/${report.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-white/95 backdrop-blur-sm shadow-2xl">
        <CardHeader className="text-center pb-8">
          <CardTitle className="text-4xl font-bold text-blue-900 mb-2">
            RESEARCH AGENT
          </CardTitle>
          <CardDescription className="text-lg text-slate-600">
            您的AI驱动研究助手
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-8">
          {/* Search Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="输入您的研究问题..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="pl-10 pr-20 h-12 text-lg"
                disabled={isLoading}
              />
              <Mic className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 cursor-pointer hover:text-blue-600" />
            </div>
            <div className="flex items-center gap-4">
              <Button
                type="submit"
                size="lg"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                disabled={isLoading}
              >
                {isLoading ? "提交中..." : "提交"}
              </Button>
              <Mic className="text-slate-400 w-6 h-6 cursor-pointer hover:text-blue-600" />
            </div>
          </form>

          {/* Tips and Examples */}
          <div className="grid md:grid-cols-2 gap-6 mt-8">
            {/* Tips */}
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle className="text-xl text-blue-900">
                  有效查询提示：
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-slate-700">
                <p>• 具体明确：缩小主题范围</p>
                <p>• 使用关键词：突出关键术语</p>
                <p>• 提供背景：添加背景信息</p>
              </CardContent>
            </Card>

            {/* Examples */}
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle className="text-xl text-blue-900">
                  示例问题
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {exampleQuestions.map((example, index) => (
                  <button
                    key={index}
                    onClick={() => handleExampleClick(example)}
                    className="block w-full text-left text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* History Reports */}
          <div className="mt-8">
            <Card className="bg-slate-50">
              <CardHeader>
                <CardTitle className="text-xl text-blue-900 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  历史报告
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reportsLoading ? (
                  <div className="text-center py-8 text-slate-600">
                    加载中...
                  </div>
                ) : reports.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    暂无历史报告
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map((report) => (
                      <Card
                        key={report.id}
                        className="bg-white hover:shadow-md transition-shadow cursor-pointer border border-slate-200"
                        onClick={() => handleReportClick(report)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2">
                                {report.question}
                              </h3>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    更新:{" "}
                                    {new Date(report.updatedAt).toLocaleString(
                                      "zh-CN"
                                    )}
                                  </span>
                                </div>
                                <span className="text-slate-400">•</span>
                                <span>
                                  创建:{" "}
                                  {new Date(report.createdAt).toLocaleString(
                                    "zh-CN"
                                  )}
                                </span>
                              </div>
                            </div>
                            <div className="flex-shrink-0">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                  report.status
                                )}`}
                              >
                                {getStatusText(report.status)}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-6 border-t border-slate-200">
            <div className="flex gap-6 text-sm text-blue-900">
              <a href="#" className="hover:underline">About</a>
              <a href="#" className="hover:underline">Pricing</a>
              <a href="#" className="hover:underline">FAQ</a>
              <a href="#" className="hover:underline">Contact</a>
            </div>
            <div className="text-sm text-slate-600">
              © 2024 Research Agent
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


