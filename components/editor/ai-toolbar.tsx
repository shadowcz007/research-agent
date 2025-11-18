"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiAction {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
  enabled: boolean;
}

interface AiToolbarProps {
  selectedText: string;
  onReplace: (newText: string) => void;
  reportId: string;
}

export function AiToolbar({ selectedText, onReplace, reportId }: AiToolbarProps) {
  const [showCustom, setShowCustom] = useState(false);
  const [customInstruction, setCustomInstruction] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [aiActions, setAiActions] = useState<AiAction[]>([]);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // 从全局配置加载AI动作
  useEffect(() => {
    const fetchActions = async () => {
      try {
        const response = await fetch(`/api/edit-config`);
        if (response.ok) {
          const data = await response.json();
          if (data.aiActions) {
            // 只显示启用的动作
            setAiActions(data.aiActions.filter((action: AiAction) => action.enabled));
          } else {
            // 使用默认动作
            setAiActions([
              { id: "1", name: "改进写作", prompt: "改进这段文字的写作质量", enabled: true },
              { id: "2", name: "缩短", prompt: "缩短这段文字", enabled: true },
              { id: "3", name: "扩写", prompt: "扩写这段文字", enabled: true },
              { id: "4", name: "更正式", prompt: "将这段文字改写为更正式的风格", enabled: true },
            ]);
          }
        }
      } catch (error) {
        console.error("Error fetching AI actions:", error);
        // 使用默认动作
        setAiActions([
          { id: "1", name: "改进写作", prompt: "改进这段文字的写作质量", enabled: true },
          { id: "2", name: "缩短", prompt: "缩短这段文字", enabled: true },
          { id: "3", name: "扩写", prompt: "扩写这段文字", enabled: true },
          { id: "4", name: "更正式", prompt: "将这段文字改写为更正式的风格", enabled: true },
        ]);
      }
    };

    fetchActions();
  }, []);

  useEffect(() => {
    const updatePosition = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setPosition({
        top: rect.top - 60,
        left: rect.left + rect.width / 2,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [selectedText]);

  const handleAction = async (actionPrompt: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/reports/${reportId}/edit/rewrite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selectedText,
          instruction: actionPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error("改写失败");
      }

      const data = await response.json();
      if (data.rewrittenText) {
        onReplace(data.rewrittenText);
      }
    } catch (error) {
      console.error("Error rewriting text:", error);
      alert("改写失败，请重试");
    } finally {
      setIsProcessing(false);
      setShowCustom(false);
      setCustomInstruction("");
    }
  };

  const handleCustomSubmit = () => {
    if (!customInstruction.trim()) return;
    handleAction(customInstruction);
  };

  if (!selectedText) return null;

  return (
    <div
      ref={toolbarRef}
      data-ai-toolbar="true"
      className={cn(
        "fixed z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        "transform -translate-x-1/2"
      )}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseDown={(e) => {
        // 防止点击工具栏时清除文本选择
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {!showCustom ? (
        <>
          {aiActions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant="ghost"
              onClick={() => handleAction(action.prompt)}
              disabled={isProcessing}
              className="text-white hover:bg-slate-800 h-8"
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                action.name
              )}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowCustom(true)}
            disabled={isProcessing}
            className="text-white hover:bg-slate-800 h-8"
          >
            <Sparkles className="w-3 h-3 mr-1" />
            自定义
          </Button>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            placeholder="输入自定义指令..."
            className="bg-slate-800 text-white border-slate-700 h-8 w-64"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCustomSubmit();
              } else if (e.key === "Escape") {
                setShowCustom(false);
                setCustomInstruction("");
              }
            }}
            autoFocus
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCustomSubmit}
            disabled={isProcessing || !customInstruction.trim()}
            className="text-white hover:bg-slate-800 h-8"
          >
            {isProcessing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              "确定"
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowCustom(false);
              setCustomInstruction("");
            }}
            disabled={isProcessing}
            className="text-white hover:bg-slate-800 h-8"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

