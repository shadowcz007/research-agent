"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { FileText, Lock } from "lucide-react";

export interface ReportVersion {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  isOriginal: boolean;
  exists?: boolean;
}

interface VersionSidebarProps {
  reportId: string;
  currentVersionId: string;
  onVersionChange: (versionId: string) => void;
}

export function VersionSidebar({
  reportId,
  currentVersionId,
  onVersionChange,
}: VersionSidebarProps) {
  const [versions, setVersions] = useState<ReportVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const res = await fetch(`/api/reports/${reportId}/edit/versions`);
        const data = await res.json();
        if (data.versions) {
          setVersions(data.versions);
        }
      } catch (error) {
        console.error("Error fetching versions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVersions();
  }, [reportId]);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) {
        return "刚刚";
      } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
      } else if (diffHours < 24) {
        return `${diffHours}小时前`;
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      } else {
        return date.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="w-64 border-r border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900">版本历史</h3>
        <p className="text-xs text-slate-500 mt-1">
          {versions.length} 个版本
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {versions.map((version) => {
            const isActive = version.id === currentVersionId;
            const isOriginal = version.isOriginal;

            return (
              <button
                key={version.id}
                onClick={() => onVersionChange(version.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg mb-2 transition-colors",
                  "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
                  isActive && "bg-slate-100 border border-slate-300",
                  !isActive && "border border-transparent"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {isOriginal ? (
                      <Lock className="w-4 h-4 text-slate-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          isActive ? "text-slate-900" : "text-slate-700"
                        )}
                      >
                        {version.name}
                      </span>
                      {isOriginal && (
                        <span className="text-xs px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded">
                          只读
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {formatDate(version.createdAt)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

