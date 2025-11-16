"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";

interface Todo {
  content: string;
  status: string;
  id?: string;
  sub_todos?: Todo[];  // 子任务列表
}

interface TodosPanelProps {
  todos: Todo[];
}

interface TodoItemProps {
  todo: Todo;
  index: number;
  level?: number;  // 嵌套层级，0为顶层
  expandedItems: Set<string>;
  onToggleExpand: (key: string) => void;
}

function TodoItem({ todo, index, level = 0, expandedItems, onToggleExpand }: TodoItemProps) {
  const hasSubTodos = todo.sub_todos && todo.sub_todos.length > 0;
  const itemKey = todo.id || `todo-${index}-${level}`;
  const isExpanded = expandedItems.has(itemKey);
  const isTopLevel = level === 0;

  // 计算子任务完成进度
  const getSubTodoProgress = () => {
    if (!hasSubTodos) return null;
    const completed = todo.sub_todos!.filter(t => t.status === "completed").length;
    const total = todo.sub_todos!.length;
    return { completed, total };
  };

  const subTodoProgress = getSubTodoProgress();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in_progress":
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      case "pending":
      default:
        return <Circle className="w-5 h-5 text-slate-500" />;
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
    <div>
      <div
        className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
          todo.status === "in_progress"
            ? "bg-blue-900/20 border border-blue-700/30"
            : todo.status === "completed"
            ? "bg-green-900/10 border border-green-700/20"
            : "bg-slate-900/50 border border-slate-700/30"
        } ${!isTopLevel ? "ml-4" : ""}`}
      >
        {/* 展开/折叠按钮 */}
        {hasSubTodos && (
          <button
            onClick={() => onToggleExpand(itemKey)}
            className="mt-0.5 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label={isExpanded ? "收起子任务" : "展开子任务"}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        )}
        {!hasSubTodos && <div className="w-4" />} {/* 占位符，保持对齐 */}

        {/* 状态图标 */}
        <div className="mt-0.5">{getStatusIcon(todo.status)}</div>

        {/* 任务内容 */}
        <div className="flex-1 min-w-0">
          <p
            className={`${isTopLevel ? "text-sm" : "text-xs"} ${
              todo.status === "completed"
                ? "text-slate-400 line-through"
                : isTopLevel
                ? "text-slate-200"
                : "text-slate-300"
            }`}
          >
            {todo.content}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-500">
              {getStatusText(todo.status)}
            </p>
            {subTodoProgress && (
              <span className="text-xs text-slate-500">
                ({subTodoProgress.completed}/{subTodoProgress.total} 完成)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 子任务列表 */}
      {hasSubTodos && isExpanded && (
        <div className="mt-2 space-y-2">
          {todo.sub_todos!.map((subTodo, subIndex) => (
            <TodoItem
              key={subTodo.id || `sub-${index}-${subIndex}`}
              todo={subTodo}
              index={subIndex}
              level={level + 1}
              expandedItems={expandedItems}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TodosPanel({ todos }: TodosPanelProps) {
  // 管理展开/折叠状态
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // 默认展开有 in_progress 子任务的项目
  useEffect(() => {
    const defaultExpanded = new Set<string>();
    todos.forEach((todo, index) => {
      const itemKey = todo.id || `todo-${index}-0`;
      // 如果任务本身是 in_progress 或有 in_progress 的子任务，默认展开
      if (todo.status === "in_progress") {
        defaultExpanded.add(itemKey);
      } else if (todo.sub_todos?.some(st => st.status === "in_progress")) {
        defaultExpanded.add(itemKey);
      }
    });
    setExpandedItems(defaultExpanded);
  }, [todos]);

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // 计算总任务数（包括子任务）
  const getTotalTaskCount = () => {
    let count = todos.length;
    todos.forEach((todo) => {
      if (todo.sub_todos) {
        count += todo.sub_todos.length;
      }
    });
    return count;
  };

  return (
    <Card className="bg-slate-800 border-slate-700 h-full">
      <CardHeader>
        <CardTitle className="text-sm text-slate-400 uppercase">
          任务列表 ({todos.length} 顶层, {getTotalTaskCount()} 总计)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无任务...</p>
        ) : (
          <div className="space-y-3">
            {todos.map((todo, index) => (
              <TodoItem
                key={todo.id || index}
                todo={todo}
                index={index}
                level={0}
                expandedItems={expandedItems}
                onToggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


