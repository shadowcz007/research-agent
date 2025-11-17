"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Download, FileText } from "lucide-react";
import type { Components } from "react-markdown";

interface ReportData {
  id: string;
  question: string;
  content: string;
}

// 解析参考文献，提取每个引用的信息
const parseCitations = (content: string): Map<number, { title: string; url: string }> => {
  const citations = new Map<number, { title: string; url: string }>();
  const lines = content.split('\n');
  
  // 查找"资料来源"部分
  let inSourcesSection = false;
  for (const line of lines) {
    if (line.includes('资料来源') || line.includes('### 资料来源')) {
      inSourcesSection = true;
      continue;
    }
    
    if (inSourcesSection) {
      // 匹配格式: [数字] 标题: URL
      const match = line.match(/^\[(\d+)\]\s*(.+?):\s*(https?:\/\/.+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const title = match[2].trim();
        const url = match[3].trim();
        citations.set(num, { title, url });
      }
    }
  }
  
  return citations;
};

// 处理 Markdown 内容，将引用转换为链接
const processMarkdownWithCitations = (content: string) => {
  // 按行处理，避免在参考文献列表中转换
  const lines = content.split('\n');
  const processedLines = lines.map((line) => {
    // 检查是否是参考文献列表项（以 [数字] 开头，后面跟着空格和文本）
    const isCitationListItem = /^\[(\d+)\]\s/.test(line);
    
    if (isCitationListItem) {
      // 参考文献列表项，不转换
      return line;
    }
    
    // 普通文本行，转换其中的引用
    // 匹配 [数字] 格式，但排除已经是链接格式的 [文本](url)
    return line.replace(
      /\[(\d+)\](?!\()/g,
      (match, num) => `[${num}](#citation-${num})`
    );
  });
  
  return processedLines.join('\n');
};

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [citations, setCitations] = useState<Map<number, { title: string; url: string }>>(new Map());

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
        // 解析参考文献
        const parsedCitations = parseCitations(data.content);
        setCitations(parsedCitations);
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

  // 在内容渲染后，验证引用链接和参考文献的匹配
  useEffect(() => {
    if (reportData) {
      // 延迟执行，确保 DOM 已渲染
      const timer = setTimeout(() => {
        const citationLinks = document.querySelectorAll('a.citation-link');
        const citationItems = document.querySelectorAll('[id^="citation-"]');
        console.log('引用链接数量:', citationLinks.length);
        console.log('参考文献项数量:', citationItems.length);
        console.log('参考文献 ID 列表:', Array.from(citationItems).map(el => el.id));
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [reportData]);

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
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              title="回到首页"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">首页</span>
            </button>
            <div className="h-6 w-px bg-slate-300" />
            <span className="text-slate-600">研究报告</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Main Content */}
          <div>
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-3xl font-bold text-slate-900">
                  {reportData.question || "研究报告"}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-slate-600 mt-4">
                  <span>{new Date().toLocaleDateString("zh-CN")}</span>
                  <Separator orientation="vertical" className="h-4" /> 
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
                <TooltipProvider delayDuration={200}>
                  <div className="prose prose-slate max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSlug]}
                      components={{
                        // 自定义链接组件，美化引用链接
                        a: ({ node, href, children, ...props }) => {
                          const isCitation = href?.startsWith('#citation-');
                          if (isCitation) {
                            const citationId = href.replace('#', '');
                            const citationNum = parseInt(citationId.replace('citation-', ''), 10);
                            const citationInfo = citations.get(citationNum);
                            
                            const linkElement = (
                              <a
                                href={href}
                                className="citation-link"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  
                                  // 使用 getElementById 查找目标元素
                                  const target = document.getElementById(citationId);
                                  if (target) {
                                    // 平滑滚动到目标位置
                                    target.scrollIntoView({ 
                                      behavior: 'smooth', 
                                      block: 'center',
                                      inline: 'nearest'
                                    });
                                    
                                    // 高亮效果
                                    target.classList.add('citation-highlight');
                                    setTimeout(() => {
                                      target.classList.remove('citation-highlight');
                                    }, 2000);
                                  } else {
                                    // 如果找不到，尝试等待一下再查找（可能 DOM 还没完全渲染）
                                    setTimeout(() => {
                                      const retryTarget = document.getElementById(citationId);
                                      if (retryTarget) {
                                        retryTarget.scrollIntoView({ 
                                          behavior: 'smooth', 
                                          block: 'center' 
                                        });
                                        retryTarget.classList.add('citation-highlight');
                                        setTimeout(() => {
                                          retryTarget.classList.remove('citation-highlight');
                                        }, 2000);
                                      } else {
                                        console.warn('找不到引用目标:', citationId, '所有可用的 citation-* ID:', 
                                          Array.from(document.querySelectorAll('[id^="citation-"]')).map(el => el.id)
                                        );
                                      }
                                    }, 100);
                                  }
                                }}
                                {...props}
                              >
                                [{children}]
                              </a>
                            );
                            
                            // 如果有引用信息，显示 tooltip
                            if (citationInfo) {
                              return (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    {linkElement}
                                  </TooltipTrigger>
                                  <TooltipContent 
                                    side="top" 
                                    className="max-w-md p-3"
                                  >
                                    <div className="space-y-2">
                                      <div className="font-semibold text-sm leading-tight">
                                        [{citationNum}] {citationInfo.title}
                                      </div>
                                      <a
                                        href={citationInfo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-400 hover:text-blue-300 break-all leading-relaxed underline cursor-pointer block"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                        }}
                                      >
                                        {citationInfo.url}
                                      </a>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            }
                            
                            return linkElement;
                          }
                          return <a href={href} {...props}>{children}</a>;
                        },
                      // 处理资料来源部分，添加 id 锚点
                      h2: ({ node, children, ...props }) => {
                        if (typeof children === 'string' && children.includes('资料来源')) {
                          return <h2 id="sources" className="scroll-mt-20" {...props}>{children}</h2>;
                        }
                        // 处理 children 可能是数组的情况
                        const childrenText = Array.isArray(children) 
                          ? children.map(c => typeof c === 'string' ? c : '').join('')
                          : String(children);
                        if (childrenText.includes('资料来源')) {
                          return <h2 id="sources" className="scroll-mt-20" {...props}>{children}</h2>;
                        }
                        return <h2 {...props}>{children}</h2>;
                      },
                      // 为参考文献列表项添加 id
                      li: ({ node, children, ...props }) => {
                        // 提取文本内容（递归处理 React 元素）
                        const extractText = (children: any): string => {
                          if (typeof children === 'string') return children;
                          if (typeof children === 'number') return String(children);
                          if (Array.isArray(children)) {
                            return children.map(c => extractText(c)).join('');
                          }
                          if (children && typeof children === 'object') {
                            // 处理 React 元素
                            if (children.props?.children) {
                              return extractText(children.props.children);
                            }
                            // 处理其他对象类型
                            if (children.children) {
                              return extractText(children.children);
                            }
                          }
                          return '';
                        };
                        
                        const text = extractText(children);
                        // 匹配以 [数字] 开头的列表项（参考文献格式）
                        const citationMatch = text.match(/^\[(\d+)\]/);
                        if (citationMatch) {
                          const num = citationMatch[1];
                          return (
                            <li
                              id={`citation-${num}`}
                              className="citation-item scroll-mt-20"
                              {...props}
                            >
                              {children}
                            </li>
                          );
                        }
                        return <li {...props}>{children}</li>;
                      },
                      // 处理段落，检查是否是参考文献（以 [数字] 开头）或包含引用链接
                      p: ({ node, children, ...props }) => {
                        // 提取文本内容
                        const extractText = (children: any): string => {
                          if (typeof children === 'string') return children;
                          if (typeof children === 'number') return String(children);
                          if (Array.isArray(children)) {
                            return children.map(c => extractText(c)).join('');
                          }
                          if (children && typeof children === 'object') {
                            if (children.props?.children) {
                              return extractText(children.props.children);
                            }
                            if (children.children) {
                              return extractText(children.children);
                            }
                          }
                          return '';
                        };
                        
                        // 检查是否包含引用链接（Tooltip 组件或引用链接）
                        const hasCitationLink = (children: any): boolean => {
                          if (Array.isArray(children)) {
                            return children.some(c => hasCitationLink(c));
                          }
                          if (children && typeof children === 'object') {
                            // 检查是否是 Tooltip 组件
                            if (children.type?.displayName === 'Tooltip' || 
                                children.type?.name === 'Tooltip') {
                              return true;
                            }
                            // 检查是否是引用链接（href 以 #citation- 开头）
                            if (children.props?.href?.startsWith('#citation-')) {
                              return true;
                            }
                            // 递归检查子元素
                            if (children.props?.children) {
                              return hasCitationLink(children.props.children);
                            }
                            if (children.children) {
                              return hasCitationLink(children.children);
                            }
                          }
                          return false;
                        };
                        
                        const text = extractText(children);
                        // 检查是否是参考文献格式（以 [数字] 开头）
                        const citationMatch = text.match(/^\[(\d+)\]/);
                        if (citationMatch) {
                          const num = citationMatch[1];
                          return (
                            <p
                              id={`citation-${num}`}
                              className="citation-item scroll-mt-20 mb-2 pb-2 border-b border-slate-100 last:border-0"
                              {...props}
                            >
                              {children}
                            </p>
                          );
                        }
                        
                        // 如果包含引用链接，使用 div 而不是 p 以避免 div 在 p 内的问题
                        if (hasCitationLink(children)) {
                          return (
                            <div className="mb-4 leading-7" {...props}>
                              {children}
                            </div>
                          );
                        }
                        
                        return <p {...props}>{children}</p>;
                      },
                    } as Components}
                    >
                      {processMarkdownWithCitations(reportData.content)}
                    </ReactMarkdown>
                  </div>
                </TooltipProvider>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

