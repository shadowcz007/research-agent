"use client";

import { Search, Zap, CheckSquare, Circle, Loader2, CheckCircle2, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useState } from "react";

interface TaskMessage {
  subagent_type?: string;
  description?: string;
}

interface TodosMessage {
  todos?: Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
  }>;
}

interface SearchMessage {
  query?: string;
}

interface WriteFileMessage {
  file_path?: string;
  content?: string;
}

interface ToolMessageDisplayProps {
  toolName: string;
  message: TaskMessage | TodosMessage | SearchMessage | WriteFileMessage;
}

function TaskMessageDisplay({ message }: { message: TaskMessage }) {
  return (
    <div className="space-y-2">
      {message.subagent_type && (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-orange-900/30 text-orange-400 border border-orange-700/30">
          <Zap className="w-3 h-3" />
          {message.subagent_type}
        </div>
      )}
      {message.description && (
        <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">
          {message.description}
        </p>
      )}
    </div>
  );
}

function TodosMessageDisplay({ message }: { message: TodosMessage }) {
  if (!message.todos || message.todos.length === 0) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "in_progress":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "pending":
      default:
        return <Circle className="w-4 h-4 text-slate-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "in_progress":
        return "进行中";
      case "pending":
        return "待处理";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
        <CheckSquare className="w-4 h-4" />
        <span>待办事项列表 ({message.todos.length} 项)</span>
      </div>
      <div className="space-y-2">
        {message.todos.map((todo, index) => (
          <div
            key={index}
            className={`flex items-start gap-2 p-2 rounded-md text-sm ${
              todo.status === "in_progress"
                ? "bg-blue-900/20 border border-blue-700/30"
                : todo.status === "completed"
                ? "bg-green-900/10 border border-green-700/20"
                : "bg-slate-900/50 border border-slate-700/30"
            }`}
          >
            <div className="mt-0.5">{getStatusIcon(todo.status)}</div>
            <div className="flex-1 min-w-0">
              <p
                className={
                  todo.status === "completed"
                    ? "text-slate-400 line-through"
                    : "text-slate-200"
                }
              >
                {todo.content}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {getStatusText(todo.status)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SearchMessageDisplay({ message }: { message: SearchMessage }) {
  if (!message.query) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-900/30 text-blue-400 border border-blue-700/30">
        <Search className="w-4 h-4" />
        <span className="font-medium">搜索查询:</span>
      </div>
      <span className="text-slate-300">{message.query}</span>
    </div>
  );
}

function WriteFileMessageDisplay({ message }: { message: WriteFileMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!message.file_path) {
    return null;
  }

  const content = message.content || "";
  const contentLines = content.split("\n");
  const previewLines = 5;
  const hasMoreContent = contentLines.length > previewLines;
  const displayContent = isExpanded 
    ? content 
    : contentLines.slice(0, previewLines).join("\n");
  const contentLength = content.length;
  const fileSize = contentLength > 1024 
    ? `${(contentLength / 1024).toFixed(2)} KB` 
    : `${contentLength} 字符`;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-green-900/30 text-green-400 border border-green-700/30">
          <FileText className="w-4 h-4" />
          <span className="font-medium">文件路径:</span>
        </div>
        <span className="text-slate-300 font-mono text-xs">{message.file_path}</span>
      </div>
      
      {content && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FileText className="w-3 h-3" />
              <span>文件内容 ({fileSize})</span>
            </div>
            {hasMoreContent && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    <span>收起</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>展开全部 ({contentLines.length} 行)</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="bg-slate-900/70 border border-slate-700/50 rounded-md p-3 overflow-x-auto">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono">
              {displayContent}
              {!isExpanded && hasMoreContent && (
                <span className="text-slate-500 italic">
                  {"\n... (还有 " + (contentLines.length - previewLines) + " 行)"}
                </span>
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolMessageDisplay({ toolName, message }: ToolMessageDisplayProps) {
  // 根据工具类型显示不同的 UI
  if (toolName === "task") {
    return <TaskMessageDisplay message={message as TaskMessage} />;
  } else if (toolName === "write_todos") {
    return <TodosMessageDisplay message={message as TodosMessage} />;
  } else if (toolName === "internet_search") {
    return <SearchMessageDisplay message={message as SearchMessage} />;
  } else if (toolName === "write_file") {
    return <WriteFileMessageDisplay message={message as WriteFileMessage} />;
  }

  // 未知工具类型，返回 null 或默认显示
  return null;
}

