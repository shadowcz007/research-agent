"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Save, Sparkles, Shield } from "lucide-react";
import { AiToolbar } from "@/components/editor/ai-toolbar";
import { SettingsModal } from "@/components/editor/settings-modal";
import { VersionSidebar, ReportVersion } from "@/components/editor/version-sidebar";
import { DetectionSidebar, DetectionResult } from "@/components/editor/detection-sidebar";
import { cn } from "@/lib/utils";

interface ReportData {
  id: string;
  question: string;
  content: string;
}

interface Style {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
}

export default function EditPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>("original");
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [styles, setStyles] = useState<Style[]>([]);
  const [originalContent, setOriginalContent] = useState<string>(""); // 保存当前版本的原始内容
  const [versionListKey, setVersionListKey] = useState(0); // 用于触发侧边栏刷新
  const [hasChanges, setHasChanges] = useState(false); // 跟踪内容是否有修改
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null); // 检测结果
  const [isDetecting, setIsDetecting] = useState(false); // 是否正在检测
  const [showDetectionSidebar, setShowDetectionSidebar] = useState(false); // 是否显示检测侧边栏

  // 获取版本列表
  useEffect(() => {
    if (!id) return;

    const fetchVersions = async () => {
      try {
        const res = await fetch(`/api/reports/${id}/edit/versions`);
        const data = await res.json();
        if (data.versions) {
          setVersions(data.versions);
        }
      } catch (error) {
        console.error("Error fetching versions:", error);
      }
    };

    fetchVersions();
  }, [id]);

  // 获取配置（风格列表）- 使用全局配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`/api/edit-config`);
        const data = await res.json();
        if (data.styles) {
          setStyles(data.styles);
        } else {
          // 使用默认风格
          setStyles([
            { id: "1", name: "专业正式", prompt: "将文档改写为专业正式的风格" },
            { id: "2", name: "风趣幽默", prompt: "将文档改写为风趣幽默的风格" },
            { id: "3", name: "简洁有力", prompt: "将文档改写为简洁有力的风格" },
          ]);
        }
      } catch (error) {
        console.error("Error fetching config:", error);
        // 使用默认风格
        setStyles([
          { id: "1", name: "专业正式", prompt: "将文档改写为专业正式的风格" },
          { id: "2", name: "风趣幽默", prompt: "将文档改写为风趣幽默的风格" },
          { id: "3", name: "简洁有力", prompt: "将文档改写为简洁有力的风格" },
        ]);
      }
    };

    fetchConfig();
  }, []);

  // 加载报告内容
  useEffect(() => {
    if (!id) return;

    const fetchReport = async () => {
      try {
        const res = await fetch(`/api/reports/${id}/edit/version?version=${currentVersion}`);
        const data = await res.json();
        
        if (data.error) {
          // 如果当前版本不存在，尝试加载原报告
          if (currentVersion !== "original") {
            const originalRes = await fetch(`/api/reports/${id}/edit/version?version=original`);
            const originalData = await originalRes.json();
            if (originalData.content) {
              setContent(originalData.content);
              setOriginalContent(originalData.content); // 保存原始内容
              setCurrentVersion("original");
              setHasChanges(false); // 加载内容时重置修改状态
            }
          } else {
            console.error(data.error);
            setLoading(false);
            return;
          }
        } else {
          setContent(data.content);
          setOriginalContent(data.content); // 保存原始内容用于比较
          setHasChanges(false); // 加载内容时重置修改状态
        }
        
        // 获取报告基本信息（question）
        const reportRes = await fetch(`/api/reports/${id}`);
        const reportData = await reportRes.json();
        if (!reportData.error) {
          setReportData(reportData);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching report:", error);
        setLoading(false);
      }
    };

    fetchReport();
  }, [id, currentVersion]);

  // 当内容加载后，设置编辑器内容
  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.textContent || "";
      if (currentContent !== content) {
        editorRef.current.textContent = content;
      }
    }
  }, [content, loading]);

  // 监听内容变化，检查是否有修改
  useEffect(() => {
    const checkChanges = () => {
      if (!editorRef.current || !originalContent) return;
      const currentContent = editorRef.current.textContent || "";
      const hasModifications = currentContent.trim() !== originalContent.trim();
      setHasChanges(hasModifications);
    };

    // 使用定时器来防抖，避免频繁检查
    const timer = setTimeout(checkChanges, 300);
    return () => clearTimeout(timer);
  }, [content, originalContent]);

  // 监听文本选择
  useEffect(() => {
    const handleSelection = () => {
      const selection = window.getSelection();
      const activeElement = document.activeElement;
      const toolbarElement = document.querySelector("[data-ai-toolbar='true']");
      const isInteractingWithToolbar =
        activeElement instanceof HTMLElement &&
        toolbarElement instanceof HTMLElement &&
        toolbarElement.contains(activeElement);

      if (selection && selection.toString().trim().length > 0) {
        setSelectedText(selection.toString().trim());
        setSelectionRange(selection.getRangeAt(0).cloneRange());
      } else if (isInteractingWithToolbar) {
        // 与工具栏交互时不要立即清除选区，避免自定义输入框被卸载
        return;
      } else {
        setSelectedText("");
        setSelectionRange(null);
      }
    };

    document.addEventListener("selectionchange", handleSelection);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
    };
  }, []);

  const handleSave = async () => {
    if (!editorRef.current) return;
    
    const currentContent = editorRef.current.textContent || content;
    
    // 检查内容是否有改动
    if (currentContent.trim() === originalContent.trim()) {
      alert("内容未修改，无需保存。");
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/reports/${id}/edit/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: currentContent,
          currentVersionId: currentVersion,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "保存失败");
      }

      const result = await response.json();
      const newVersionId = result.version?.id;

      // 刷新版本列表
      const versionsRes = await fetch(`/api/reports/${id}/edit/versions`);
      const versionsData = await versionsRes.json();
      if (versionsData.versions) {
        setVersions(versionsData.versions);
        setVersionListKey(prev => prev + 1); // 触发侧边栏刷新
      }

      // 切换到新创建的版本
      if (newVersionId) {
        setCurrentVersion(newVersionId);
        // 重新加载新版本内容（虽然内容相同，但确保状态一致）
        const versionRes = await fetch(`/api/reports/${id}/edit/version?version=${newVersionId}`);
        const versionData = await versionRes.json();
        if (versionData.content) {
          setContent(versionData.content);
          setOriginalContent(versionData.content); // 更新原始内容
          if (editorRef.current) {
            editorRef.current.textContent = versionData.content;
          }
        }
      }

      // 根据当前版本显示不同的提示
      const isOriginal = currentVersion === "original";
      alert(isOriginal 
        ? "保存成功！已创建新版本（原报告保持不变）。" 
        : "保存成功！已创建新版本。");
      
      // 保存成功后重置修改状态
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving report:", error);
      alert("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFullRewrite = async (stylePrompt: string) => {
    if (!editorRef.current) return;
    
    setIsRewriting(true);
    try {
      const response = await fetch(`/api/reports/${id}/edit/rewrite-full`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: editorRef.current.textContent || content,
          style: stylePrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("改写失败");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let newContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");
          
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  newContent += parsed.content;
                  if (editorRef.current) {
                    editorRef.current.textContent = newContent;
                    setContent(newContent);
                  }
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }

      // 改写完成后，自动保存为新版本
      if (newContent && newContent.trim() !== originalContent.trim()) {
        const saveResponse = await fetch(`/api/reports/${id}/edit/save`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: newContent,
            currentVersionId: currentVersion,
          }),
        });
        
        if (saveResponse.ok) {
          const saveResult = await saveResponse.json();
          const newVersionId = saveResult.version?.id;
          
          // 刷新版本列表
          const versionsRes = await fetch(`/api/reports/${id}/edit/versions`);
          const versionsData = await versionsRes.json();
          if (versionsData.versions) {
            setVersions(versionsData.versions);
            setVersionListKey(prev => prev + 1); // 触发侧边栏刷新
          }
          
          // 切换到新创建的版本
          if (newVersionId) {
            setCurrentVersion(newVersionId);
            setOriginalContent(newContent); // 更新原始内容
            setHasChanges(false); // 保存后重置修改状态
          }
        }
      } else if (newContent && newContent.trim() === originalContent.trim()) {
        // 如果改写后内容没有变化，不保存
        alert("改写后内容未发生变化，未创建新版本。");
        setHasChanges(false); // 内容未变化，重置修改状态
      } else if (newContent) {
        // 如果改写后内容有变化但未保存，标记为已修改
        setHasChanges(true);
      }
    } catch (error) {
      console.error("Error rewriting report:", error);
      alert("改写失败，请重试");
    } finally {
      setIsRewriting(false);
    }
  };

  const handleVersionChange = async (versionId: string) => {
    if (versionId === currentVersion) return;
    
    setLoadingVersion(true);
    try {
      const res = await fetch(`/api/reports/${id}/edit/version?version=${versionId}`);
      const data = await res.json();
      
      if (data.error) {
        alert("加载版本失败：" + data.error);
        return;
      }
      
      setContent(data.content);
      setOriginalContent(data.content); // 更新原始内容
      setCurrentVersion(versionId);
      setHasChanges(false); // 切换版本时重置修改状态
      
      // 更新编辑器内容
      if (editorRef.current) {
        editorRef.current.textContent = data.content;
      }
      
      // 刷新版本列表（确保显示最新状态）
      const versionsRes = await fetch(`/api/reports/${id}/edit/versions`);
      const versionsData = await versionsRes.json();
      if (versionsData.versions) {
        setVersions(versionsData.versions);
        setVersionListKey(prev => prev + 1); // 触发侧边栏刷新
      }
    } catch (error) {
      console.error("Error loading version:", error);
      alert("加载版本失败，请重试");
    } finally {
      setLoadingVersion(false);
    }
  };

  const handleRestoreSelection = () => {
    if (!selectionRange || !editorRef.current) return;

    try {
      const selection = window.getSelection();
      if (selection && selectionRange) {
        // 确保 range 在编辑器内
        let range = selectionRange;
        try {
          // 检查 range 是否仍然有效
          if (!editorRef.current.contains(range.commonAncestorContainer)) {
            // 如果 range 无效，尝试从当前选择获取
            if (selection.rangeCount > 0) {
              range = selection.getRangeAt(0).cloneRange();
            } else {
              console.warn("Selection range is invalid");
              return;
            }
          }
        } catch (e) {
          // 如果检查失败，尝试从当前选择获取
          if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0).cloneRange();
          } else {
            console.warn("Failed to get valid range");
            return;
          }
        }
        
        // 恢复选区显示
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } catch (error) {
      console.error("Error restoring selection:", error);
    }
  };

  const handleReplaceSelection = (newText: string) => {
    if (!selectionRange || !editorRef.current) return;

    try {
      const selection = window.getSelection();
      if (selection && selectionRange) {
        // 确保 range 在编辑器内
        let range = selectionRange;
        try {
          // 检查 range 是否仍然有效
          if (!editorRef.current.contains(range.commonAncestorContainer)) {
            // 如果 range 无效，尝试从当前选择获取
            if (selection.rangeCount > 0) {
              range = selection.getRangeAt(0).cloneRange();
            } else {
              console.warn("Selection range is invalid");
              return;
            }
          }
        } catch (e) {
          // 如果检查失败，尝试从当前选择获取
          if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0).cloneRange();
          } else {
            console.warn("Failed to get valid range");
            return;
          }
        }
        
        selection.removeAllRanges();
        selection.addRange(range);
        
        // 使用 Range 的 deleteContents 方法
        range.deleteContents();
        const textNode = document.createTextNode(newText);
        range.insertNode(textNode);
        
        // 选中新插入的文本，而不是只移动光标
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStartBefore(textNode);
        newRange.setEndAfter(textNode);
        selection.addRange(newRange);
        
        // 更新选中文本和选区范围
        setSelectedText(newText);
        setSelectionRange(newRange.cloneRange());
        
        // 更新内容状态
        if (editorRef.current) {
          const newContent = editorRef.current.textContent || "";
          setContent(newContent);
          // 检查是否有修改
          const hasModifications = newContent.trim() !== originalContent.trim();
          setHasChanges(hasModifications);
        }
      }
    } catch (error) {
      console.error("Error replacing selection:", error);
    }
  };

  const handleDetectViolations = async () => {
    if (!editorRef.current) return;

    const currentContent = editorRef.current.textContent || content;
    if (!currentContent.trim()) {
      alert("内容为空，无法检测");
      return;
    }

    setIsDetecting(true);
    setShowDetectionSidebar(true);

    try {
      const response = await fetch(`/api/reports/${id}/edit/detect-violations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: currentContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "检测失败");
      }

      const result: DetectionResult = await response.json();
      setDetectionResult(result);
    } catch (error) {
      console.error("Error detecting violations:", error);
      alert("检测失败，请重试");
      setDetectionResult(null);
    } finally {
      setIsDetecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-2">加载中...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-2">报告不存在</p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="mt-4"
          >
            返回首页
          </Button>
        </div>
      </div>
    );
  }

  const currentVersionData = versions.find((v) => v.id === currentVersion);
  const isOriginal = currentVersion === "original";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Version Sidebar */}
      <VersionSidebar
        key={versionListKey} // 使用key强制刷新侧边栏
        reportId={id}
        currentVersionId={currentVersion}
        onVersionChange={handleVersionChange}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/research/${id}/report`)}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
                title="返回报告"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm">返回报告</span>
              </button>
              <div className="h-6 w-px bg-slate-300" />
              <span className="text-slate-600">编辑报告</span>
              {isOriginal && (
                <>
                  <div className="h-6 w-px bg-slate-300" />
                  <span className="text-sm text-slate-500">编辑原报告（保存将创建新版本）</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDetectViolations}
                disabled={isDetecting}
                className="gap-2"
                title="检测违禁词"
              >
                <Shield className="w-4 h-4" />
                {isDetecting ? "检测中..." : "检测违禁词"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowSettings(true)}
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                设置
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className={cn(
                  "gap-2",
                  hasChanges && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                )}
                variant={hasChanges ? "default" : "outline"}
                title={isOriginal ? "保存将创建新版本，原报告保持不变" : "保存将创建新版本"}
              >
                <Save className="w-4 h-4" />
                {isSaving ? "保存中..." : "保存"}
              </Button>
            </div>
          </div>
        </div>

        {/* Style Toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-600 mr-2">全文风格改写：</span>
            {styles.map((style) => (
              <Button
                key={style.id}
                variant="outline"
                size="sm"
                onClick={() => handleFullRewrite(style.prompt)}
                disabled={isRewriting}
                className="gap-2"
              >
                <Sparkles className="w-3 h-3" />
                {style.name}
              </Button>
            ))}
            {isRewriting && (
              <span className="text-sm text-slate-500 ml-2">正在改写...</span>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto px-6 py-8">
            <div className="max-w-4xl mx-auto">
              <Card className="bg-white">
                <CardHeader>
                  {/* <CardTitle className="text-3xl font-bold text-slate-900">
                    {reportData?.question || "研究报告"}
                  </CardTitle> */}
                  {currentVersionData && (
                    <p className="text-sm text-slate-500 mt-2">
                      当前版本：{currentVersionData.name}
                      {isOriginal && "（保存将创建新版本）"}
                    </p>
                  )}
                </CardHeader>
                <CardContent>
                  <div
                    ref={editorRef}
                    contentEditable
                    className="min-h-[600px] w-full p-6 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 prose prose-slate max-w-none"
                    style={{
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                    suppressContentEditableWarning
                    onInput={(e) => {
                      if (editorRef.current) {
                        const newContent = editorRef.current.textContent || "";
                        setContent(newContent);
                        // 实时检查是否有修改
                        const hasModifications = newContent.trim() !== originalContent.trim();
                        setHasChanges(hasModifications);
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* AI Toolbar */}
      {selectedText && selectionRange && (
        <AiToolbar
          selectedText={selectedText}
          onReplace={handleReplaceSelection}
          reportId={id}
          onRestoreSelection={handleRestoreSelection}
        />
      )}

      {/* Detection Sidebar */}
      {showDetectionSidebar && (
        <DetectionSidebar
          result={detectionResult}
          loading={isDetecting}
          onClose={() => setShowDetectionSidebar(false)}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          open={showSettings}
          onOpenChange={(open) => {
            setShowSettings(open);
            // 当设置关闭时，刷新风格列表
            if (!open) {
              fetch(`/api/edit-config`)
                .then((res) => res.json())
                .then((data) => {
                  if (data.styles) {
                    setStyles(data.styles);
                  }
                })
                .catch((error) => {
                  console.error("Error refreshing config:", error);
                });
            }
          }}
        />
      )}
    </div>
  );
}

