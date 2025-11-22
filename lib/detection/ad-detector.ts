import {
  explicitViolations,
  fuzzyKeywords,
  highRiskKeywords,
  isExplicitViolation,
  isFuzzyKeyword,
  isHighRiskKeyword,
  getRelatedArticles,
} from "./keywords";

export interface MatchedKeyword {
  keyword: string;
  position: number;
  type: "explicit" | "fuzzy" | "high-risk";
  relatedArticles: string[];
}

export interface DictionaryMatchResult {
  hasViolations: boolean;
  matchedKeywords: MatchedKeyword[];
  needsLLMReview: boolean;
}

/**
 * 文本预处理：去除HTML标签、表情、URL、多余空格等
 */
export function preprocessText(text: string): string {
  if (!text) return "";

  let processed = text;

  // 移除HTML标签
  processed = processed.replace(/<[^>]*>/g, "");

  // 移除URL
  processed = processed.replace(
    /https?:\/\/[^\s]+/g,
    ""
  );

  // 移除Emoji（简单处理，移除常见emoji范围）
  processed = processed.replace(
    /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu,
    ""
  );

  // 移除多余空格，保留单个空格
  processed = processed.replace(/\s+/g, " ");

  // 去除首尾空格
  processed = processed.trim();

  return processed;
}

/**
 * 在文本中查找关键词的所有出现位置
 */
function findAllOccurrences(
  text: string,
  keyword: string
): number[] {
  const positions: number[] = [];
  let index = text.indexOf(keyword);
  
  while (index !== -1) {
    positions.push(index);
    index = text.indexOf(keyword, index + 1);
  }
  
  return positions;
}

/**
 * 词典匹配：检查文本中是否包含违禁词
 */
export function dictionaryMatch(text: string): DictionaryMatchResult {
  const processedText = preprocessText(text);
  const matchedKeywords: MatchedKeyword[] = [];
  let needsLLMReview = false;

  // 检查明确违禁词
  for (const violation of explicitViolations) {
    if (processedText.includes(violation)) {
      const positions = findAllOccurrences(processedText, violation);
      for (const pos of positions) {
        matchedKeywords.push({
          keyword: violation,
          position: pos,
          type: "explicit",
          relatedArticles: getRelatedArticles(violation),
        });
      }
    }
  }

  // 检查高危词
  for (const risk of highRiskKeywords) {
    if (processedText.includes(risk)) {
      const positions = findAllOccurrences(processedText, risk);
      for (const pos of positions) {
        matchedKeywords.push({
          keyword: risk,
          position: pos,
          type: "high-risk",
          relatedArticles: [],
        });
      }
    }
  }

  // 检查模糊关键词（用于触发LLM）
  for (const fuzzy of fuzzyKeywords) {
    if (processedText.includes(fuzzy)) {
      needsLLMReview = true;
      const positions = findAllOccurrences(processedText, fuzzy);
      for (const pos of positions) {
        // 如果模糊关键词还没有被添加，则添加
        if (!matchedKeywords.some(m => m.keyword === fuzzy && m.position === pos)) {
          matchedKeywords.push({
            keyword: fuzzy,
            position: pos,
            type: "fuzzy",
            relatedArticles: [],
          });
        }
      }
    }
  }

  // 去重（相同位置相同关键词只保留一个）
  const uniqueMatches = matchedKeywords.filter(
    (match, index, self) =>
      index ===
      self.findIndex(
        (m) => m.keyword === match.keyword && m.position === match.position
      )
  );

  return {
    hasViolations: uniqueMatches.some(
      (m) => m.type === "explicit" || m.type === "high-risk"
    ),
    matchedKeywords: uniqueMatches,
    needsLLMReview,
  };
}

