import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

interface Todo {
  content: string;
  status: string;
  id?: string;
}

interface TodosPanelProps {
  todos: Todo[];
}

export function TodosPanel({ todos }: TodosPanelProps) {
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
    <Card className="bg-slate-800 border-slate-700 h-full">
      <CardHeader>
        <CardTitle className="text-sm text-slate-400 uppercase">
          任务列表 ({todos.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {todos.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无任务...</p>
        ) : (
          <div className="space-y-3">
            {todos.map((todo, index) => (
              <div
                key={todo.id || index}
                className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
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
                    className={`text-sm ${
                      todo.status === "completed"
                        ? "text-slate-400 line-through"
                        : "text-slate-200"
                    }`}
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
        )}
      </CardContent>
    </Card>
  );
}


