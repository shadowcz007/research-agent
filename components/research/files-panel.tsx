import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Sparkles } from "lucide-react";

interface FileInfo {
  size: number;
  modified_at: string;
  path: string;
}

interface FilesPanelProps {
  files: Record<string, FileInfo>;
}

export function FilesPanel({ files }: FilesPanelProps) {
  const fileList = Object.entries(files).map(([path, info]) => ({
    name: path.split("/").pop() || path,
    fullPath: path,
    ...info,
  }));

  // Sort by modified time (newest first)
  fileList.sort((a, b) => {
    const timeA = new Date(a.modified_at).getTime();
    const timeB = new Date(b.modified_at).getTime();
    return timeB - timeA;
  });

  // Check if file was modified in the last 5 seconds
  const isRecentlyModified = (modifiedAt: string) => {
    const now = Date.now();
    const modifiedTime = new Date(modifiedAt).getTime();
    return now - modifiedTime < 5000;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <Card className="bg-slate-800 border-slate-700 h-full">
      <CardHeader>
        <CardTitle className="text-sm text-slate-400 uppercase">
          文件列表 ({fileList.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {fileList.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无文件...</p>
        ) : (
          <div className="space-y-2">
            {fileList.map((file, index) => {
              const isRecent = isRecentlyModified(file.modified_at);
              return (
                <div
                  key={file.fullPath}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                    isRecent
                      ? "bg-blue-900/20 border border-blue-700/30 animate-pulse"
                      : "bg-slate-900/50 border border-slate-700/30"
                  }`}
                >
                  <div className="relative">
                    <FileText className="w-5 h-5 text-blue-400" />
                    {isRecent && (
                      <Sparkles className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 animate-bounce" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 font-mono truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-500">
                        {formatTime(file.modified_at)}
                      </p>
                      {file.size > 0 && (
                        <>
                          <span className="text-slate-600">•</span>
                          <p className="text-xs text-slate-500">
                            {formatFileSize(file.size)}
                          </p>
                        </>
                      )}
                      {isRecent && (
                        <>
                          <span className="text-slate-600">•</span>
                          <p className="text-xs text-blue-400">刚刚更新</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


