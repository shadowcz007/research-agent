"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";

interface Todo {
  content: string;
  status: string;
  id?: string;
  sub_todos?: Todo[];  // 子任务列表
}

interface TodosPanelProps {
  todos: Todo[];
  researchId?: string; // 研究项目 ID，用于持久化折叠状态
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

  // 递归计算所有层级的子任务数量
  const getTotalSubTodosCount = (todos: Todo[]): number => {
    let count = todos.length;
    todos.forEach((t) => {
      if (t.sub_todos && t.sub_todos.length > 0) {
        count += getTotalSubTodosCount(t.sub_todos);
      }
    });
    return count;
  };

  // 计算子任务完成进度
  const getSubTodoProgress = () => {
    if (!hasSubTodos) return null;
    const completed = todo.sub_todos!.filter(t => t.status === "completed").length;
    const total = todo.sub_todos!.length;
    return { completed, total };
  };

  const subTodoProgress = getSubTodoProgress();
  const totalSubTodosCount = hasSubTodos ? getTotalSubTodosCount(todo.sub_todos!) : 0;

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
        {hasSubTodos ? (
          <button
            onClick={() => onToggleExpand(itemKey)}
            className="mt-0.5 text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1 group"
            aria-label={isExpanded ? "收起子任务" : "展开子任务"}
            title={`${isExpanded ? "收起" : "展开"} ${totalSubTodosCount} 个子任务`}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
            ) : (
              <ChevronRight className="w-4 h-4 group-hover:scale-110 transition-transform" />
            )}
            {!isExpanded && (
              <span className="text-xs text-slate-500 group-hover:text-slate-300">
                {totalSubTodosCount}
              </span>
            )}
          </button>
        ) : (
          <div className="w-4" /> // 占位符，保持对齐
        )}

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
        <div className={`mt-2 space-y-2 ${level > 0 ? "ml-2" : ""}`}>
          {todo.sub_todos!.map((subTodo, subIndex) => (
            <TodoItem
              key={subTodo.id || `sub-${index}-${subIndex}-${level}`}
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

export function TodosPanel({ todos, researchId }: TodosPanelProps) {
  // 生成 localStorage 的 key
  const storageKey = useMemo(
    () => researchId ? `todos-expanded-${researchId}` : 'todos-expanded-default',
    [researchId]
  );

  // 从 localStorage 加载保存的展开状态
  const loadExpandedState = useCallback((): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const expandedArray = JSON.parse(saved) as string[];
        return new Set(expandedArray);
      }
    } catch (error) {
      console.error('加载折叠状态失败:', error);
    }
    return new Set();
  }, [storageKey]);

  // 保存展开状态到 localStorage
  const saveExpandedState = useCallback((expanded: Set<string>) => {
    if (typeof window === 'undefined') return;
    try {
      const expandedArray = Array.from(expanded);
      localStorage.setItem(storageKey, JSON.stringify(expandedArray));
    } catch (error) {
      console.error('保存折叠状态失败:', error);
    }
  }, [storageKey]);

  // 管理展开/折叠状态，从 localStorage 初始化
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const key = researchId ? `todos-expanded-${researchId}` : 'todos-expanded-default';
      const saved = localStorage.getItem(key);
      if (saved) {
        const expandedArray = JSON.parse(saved) as string[];
        return new Set(expandedArray);
      }
    } catch (error) {
      console.error('初始化折叠状态失败:', error);
    }
    return new Set();
  });

  // 当 researchId 变化时，重新加载保存的状态
  useEffect(() => {
    // 只加载保存的状态，不自动展开任何项目
    const savedState = loadExpandedState();
    setExpandedItems(savedState);
  }, [loadExpandedState]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      // 立即保存到 localStorage
      saveExpandedState(next);
      return next;
    });
  }, [saveExpandedState]);

  // 递归计算总任务数（包括所有层级的子任务）
  const getTotalTaskCount = (taskList: Todo[] = todos): number => {
    let count = taskList.length;
    taskList.forEach((todo) => {
      if (todo.sub_todos && todo.sub_todos.length > 0) {
        count += getTotalTaskCount(todo.sub_todos);
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


