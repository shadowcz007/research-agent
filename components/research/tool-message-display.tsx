"use client";

import { Search, Zap, CheckSquare, Circle, Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";

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

interface ToolMessageDisplayProps {
  toolName: string;
  message: TaskMessage | TodosMessage | SearchMessage;
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

export function ToolMessageDisplay({ toolName, message }: ToolMessageDisplayProps) {
  // 根据工具类型显示不同的 UI
  if (toolName === "task") {
    return <TaskMessageDisplay message={message as TaskMessage} />;
  } else if (toolName === "write_todos") {
    return <TodosMessageDisplay message={message as TodosMessage} />;
  } else if (toolName === "internet_search") {
    return <SearchMessageDisplay message={message as SearchMessage} />;
  }

  // 未知工具类型，返回 null 或默认显示
  return null;
}

