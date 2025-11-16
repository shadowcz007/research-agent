"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StreamingContentProps {
  content: string | undefined;
}

export function StreamingContent({ content }: StreamingContentProps) {
  // 如果没有内容，不显示组件
  if (!content || content.trim() === "") {
    return null;
  }

  return (
    <Card className="bg-slate-800 border-slate-700 mb-6">
      <CardHeader>
        <CardTitle className="text-sm text-slate-400 uppercase">
          LLM 思考内容
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="min-h-[60px] max-h-[200px] overflow-y-auto">
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

