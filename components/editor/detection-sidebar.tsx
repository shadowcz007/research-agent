"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";

export interface ViolationItem {
  keyword: string;
  position: number;
  type: "explicit" | "fuzzy" | "high-risk";
  relatedArticles: string[];
}

export interface DetectionResult {
  dictionaryMatches: {
    hasViolations: boolean;
    matchedKeywords: ViolationItem[];
    needsLLMReview: boolean;
  };
  llmResult?: {
    is_violation: boolean;
    violation_type: string;
    confidence: number;
    reason: string;
    matched_keywords: string[];
    related_articles: string[];
  };
  finalDecision: {
    isViolation: boolean;
    confidence: number;
    summary: string;
  };
}

interface DetectionSidebarProps {
  result: DetectionResult | null;
  loading?: boolean;
  onClose?: () => void;
}

export function DetectionSidebar({
  result,
  loading = false,
  onClose,
}: DetectionSidebarProps) {

  if (loading) {
    return (
      <div className="w-80 border-l border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-500">检测中...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="w-80 border-l border-slate-200 bg-white p-4">
        <div className="text-sm text-slate-500">暂无检测结果</div>
      </div>
    );
  }

  const { dictionaryMatches, llmResult, finalDecision } = result;

  return (
    <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">检测结果</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          {finalDecision.isViolation ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-red-600 font-medium">
                发现违规内容
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-xs text-green-600 font-medium">
                未发现违规
              </span>
            </>
          )}
        </div>
        {finalDecision.isViolation && (
          <div className="mt-1 text-xs text-slate-500">
            置信度: {(finalDecision.confidence * 100).toFixed(0)}%
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {/* 词典匹配结果 */}
          {dictionaryMatches.matchedKeywords.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                词典匹配 ({dictionaryMatches.matchedKeywords.length})
              </h4>
              <div className="space-y-2">
                {dictionaryMatches.matchedKeywords.map((item, index) => (
                  <div
                    key={index}
                    className={cn(
                      "border rounded-lg p-3 text-sm",
                      item.type === "explicit" || item.type === "high-risk"
                        ? "border-red-200 bg-red-50"
                        : "border-yellow-200 bg-yellow-50"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">
                          {item.keyword}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          类型:{" "}
                          {item.type === "explicit"
                            ? "明确违禁"
                            : item.type === "high-risk"
                            ? "高危词"
                            : "模糊关键词"}
                        </div>
                        {item.relatedArticles.length > 0 && (
                          <div className="mt-1 text-xs text-blue-600">
                            相关法条: {item.relatedArticles.join(", ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LLM审核结果 */}
          {llmResult && (
            <div>
              <h4 className="text-xs font-semibold text-slate-700 mb-2">
                LLM语义审核
              </h4>
              <div
                className={cn(
                  "border rounded-lg p-3 text-sm",
                  llmResult.is_violation
                    ? "border-red-200 bg-red-50"
                    : "border-green-200 bg-green-50"
                )}
              >
                <div className="space-y-2">
                  <div>
                    <span className="font-medium text-slate-900">判定: </span>
                    <span
                      className={cn(
                        "font-medium",
                        llmResult.is_violation
                          ? "text-red-600"
                          : "text-green-600"
                      )}
                    >
                      {llmResult.is_violation ? "违规" : "未违规"}
                    </span>
                  </div>
                  {llmResult.violation_type !== "无" && (
                    <div>
                      <span className="font-medium text-slate-900">
                        违规类型:{" "}
                      </span>
                      <span className="text-slate-700">
                        {llmResult.violation_type}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="font-medium text-slate-900">置信度: </span>
                    <span className="text-slate-700">
                      {(llmResult.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {llmResult.reason && (
                    <div>
                      <span className="font-medium text-slate-900">理由: </span>
                      <span className="text-slate-700">{llmResult.reason}</span>
                    </div>
                  )}
                  {llmResult.matched_keywords.length > 0 && (
                    <div>
                      <span className="font-medium text-slate-900">
                        匹配关键词:{" "}
                      </span>
                      <span className="text-slate-700">
                        {llmResult.matched_keywords.join(", ")}
                      </span>
                    </div>
                  )}
                  {llmResult.related_articles.length > 0 && (
                    <div>
                      <span className="font-medium text-slate-900">
                        相关法条:{" "}
                      </span>
                      <span className="text-blue-600">
                        {llmResult.related_articles.join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 最终决策摘要 */}
          {finalDecision.summary && (
            <div className="pt-2 border-t border-slate-200">
              <div className="text-xs text-slate-600">
                <span className="font-medium">摘要: </span>
                {finalDecision.summary}
              </div>
            </div>
          )}

          {/* 无违规提示 */}
          {!finalDecision.isViolation &&
            dictionaryMatches.matchedKeywords.length === 0 &&
            !llmResult && (
              <div className="text-center py-8 text-slate-500 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <div>未检测到违规内容</div>
              </div>
            )}
        </div>
      </ScrollArea>
    </div>
  );
}

