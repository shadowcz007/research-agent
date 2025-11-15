import { Search, FileText, Edit, CheckSquare, Zap } from "lucide-react";

interface ToolCallBadgeProps {
  name: string;
  className?: string;
}

export function ToolCallBadge({ name, className = "" }: ToolCallBadgeProps) {
  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case "internet_search":
        return <Search className="w-3 h-3" />;
      case "write_file":
        return <FileText className="w-3 h-3" />;
      case "edit_file":
        return <Edit className="w-3 h-3" />;
      case "write_todos":
        return <CheckSquare className="w-3 h-3" />;
      case "task":
        return <Zap className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getToolColor = (toolName: string) => {
    switch (toolName) {
      case "internet_search":
        return "bg-blue-900/30 text-blue-400 border-blue-700/30";
      case "write_file":
        return "bg-green-900/30 text-green-400 border-green-700/30";
      case "edit_file":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-700/30";
      case "write_todos":
        return "bg-purple-900/30 text-purple-400 border-purple-700/30";
      case "task":
        return "bg-orange-900/30 text-orange-400 border-orange-700/30";
      default:
        return "bg-slate-900/30 text-slate-400 border-slate-700/30";
    }
  };

  const getToolLabel = (toolName: string) => {
    switch (toolName) {
      case "internet_search":
        return "搜索";
      case "write_file":
        return "创建文件";
      case "edit_file":
        return "编辑文件";
      case "write_todos":
        return "任务";
      case "task":
        return "子任务";
      default:
        return toolName;
    }
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${getToolColor(
        name
      )} ${className}`}
    >
      {getToolIcon(name)}
      {getToolLabel(name)}
    </span>
  );
}

