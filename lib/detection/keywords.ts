/**
 * 广告法违禁词库
 * 基于《中华人民共和国广告法》提取
 */

// 明确违禁词（直接拦截，高置信度违规）
export const explicitViolations: string[] = [
  // 第九条：禁止使用的绝对化用语
  "国家级",
  "最高级",
  "最佳",
  "最好",
  "最优",
  "第一",
  "唯一",
  "独一无二",
  "绝无仅有",
  "史无前例",
  "空前绝后",
  "最先进",
  "最优秀",
  "最专业",
  "最权威",
  "最全面",
  "最完善",
  "最可靠",
  "最安全",
  "最有效",
  "最快速",
  "最便宜",
  "最实惠",
  "最畅销",
  "销量第一",
  "排名第一",
  "行业第一",
  "市场第一",
  "全球第一",
  "全国第一",
  "世界第一",
  "宇宙第一",
  
  // 虚假宣传相关
  "100%",
  "百分百",
  "完全",
  "彻底",
  "根治",
  "包治",
  "药到病除",
  "永不复发",
  "无效退款",
  "假一赔十",
  
  // 医疗相关违禁词
  "治愈率",
  "有效率",
  "根治",
  "包治百病",
  "药到病除",
  
  // 投资回报相关违禁词
  "保本",
  "无风险",
  "保收益",
  "稳赚不赔",
  "零风险",
  "高收益",
  "日赚",
  "月赚",
  "年赚",
  
  // 房地产违禁词
  "升值",
  "投资回报",
  "稳赚",
  "稳赚不赔",
];

// 模糊关键词（触发LLM语义审核）
export const fuzzyKeywords: string[] = [
  "敏感",
  "爆料",
  "懂的都懂",
  "老板",
  "政策",
  "没人管",
  "背后",
  "真相",
  "建议别",
  "不建议",
  "小心",
  "注意",
  "听说",
  "据说",
  "传言",
  "内幕",
  "秘密",
  "隐藏",
  "不为人知",
  "很少有人知道",
  "一般人不知道",
  "只有我知道",
  "独家",
  "内部消息",
  "小道消息",
];

// 高危词（直接拦截，涉及严重违规）
export const highRiskKeywords: string[] = [
  // 色情相关
  "色情",
  "淫秽",
  "性",
  "性爱",
  "性服务",
  
  // 暴力相关
  "暴力",
  "血腥",
  "杀戮",
  "武器",
  "枪支",
  
  // 赌博相关
  "赌博",
  "博彩",
  "赌场",
  "彩票",
  "投注",
  
  // 毒品相关
  "毒品",
  "吸毒",
  "大麻",
  "海洛因",
  "冰毒",
  
  // 迷信相关
  "迷信",
  "算命",
  "占卜",
  "风水",
  "看相",
];

// 广告法相关条例映射（用于显示相关法条）
export const articleMapping: Record<string, string[]> = {
  "国家级": ["第九条"],
  "最高级": ["第九条"],
  "最佳": ["第九条"],
  "治愈率": ["第十六条"],
  "有效率": ["第十六条"],
  "保本": ["第二十五条"],
  "无风险": ["第二十五条"],
  "保收益": ["第二十五条"],
  "升值": ["第二十六条"],
  "投资回报": ["第二十六条"],
};

/**
 * 检查关键词是否属于明确违禁词
 */
export function isExplicitViolation(keyword: string): boolean {
  return explicitViolations.some(v => keyword.includes(v));
}

/**
 * 检查关键词是否属于模糊关键词
 */
export function isFuzzyKeyword(keyword: string): boolean {
  return fuzzyKeywords.some(f => keyword.includes(f));
}

/**
 * 检查关键词是否属于高危词
 */
export function isHighRiskKeyword(keyword: string): boolean {
  return highRiskKeywords.some(h => keyword.includes(h));
}

/**
 * 获取关键词相关的法条
 */
export function getRelatedArticles(keyword: string): string[] {
  const articles: string[] = [];
  for (const [key, arts] of Object.entries(articleMapping)) {
    if (keyword.includes(key)) {
      articles.push(...arts);
    }
  }
  return [...new Set(articles)]; // 去重
}

