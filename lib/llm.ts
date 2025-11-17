import "dotenv/config";
import { ChatOpenAI, type ChatOpenAICallOptions } from "@langchain/openai";
import { AIMessageChunk } from "@langchain/core/messages";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";

/**
 * 抑制 LangChain 关于 token 字段的警告信息
 * 这个函数会全局注入一次，替换 console.warn 来过滤特定的警告消息
 */
let isWarningSuppressed = false;
let originalConsoleWarn: typeof console.warn | null = null;

function suppressLangchainWarnings() {
  // 如果已经注入过，直接返回
  if (isWarningSuppressed) {
    return;
  }

  // 保存原始的 console.warn 引用
  originalConsoleWarn = console.warn;

  console.warn = (...args: any[]) => {
    // 检查第一个参数是否是字符串，并且包含需要过滤的警告信息
    const firstArg = args[0];
    if (
      typeof firstArg === "string" &&
      (firstArg.includes("field[total_tokens]") ||
        firstArg.includes("field[completion_tokens]"))
    ) {
      return;
    }
    // 调用原始的 console.warn，确保上下文正确
    return originalConsoleWarn!.apply(console, args);
  };

  // 标记为已注入
  isWarningSuppressed = true;
}

// 在模块加载时全局注入一次
suppressLangchainWarnings();

/**
 * 判断错误是否是速率限制错误
 */
function isRateLimitError(error: any): boolean {
  // 检查 HTTP 状态码 429
  if (error?.status === 429 || error?.response?.status === 429) {
    return true;
  }

  // 检查错误消息中是否包含速率限制相关关键词
  const errorMessage = error?.message?.toLowerCase() || "";
  const rateLimitKeywords = [
    "rate limit",
    "rate_limit",
    "429",
    "too many requests",
    "quota exceeded",
    "请求过于频繁",
    "速率限制",
  ];

  return rateLimitKeywords.some((keyword) => errorMessage.includes(keyword));
}

/**
 * 延迟函数
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带指数退避的重试机制
 */
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error, delay: number) => void;
  } = {}
): Promise<T> {
  const {
    maxRetries = 5,
    baseDelay = 1000, // 1秒
    maxDelay = 60000, // 60秒
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 检查是否是速率限制错误
      const isRateLimit = isRateLimitError(error);

      // 如果是速率限制错误且还有重试次数，则重试
      if (isRateLimit && attempt < maxRetries) {
        // 指数退避：baseDelay * 2^attempt，但不超过 maxDelay
        const delayMs = Math.min(
          baseDelay * Math.pow(2, attempt),
          maxDelay
        );

        if (onRetry) {
          onRetry(attempt + 1, lastError, delayMs);
        } else {
          console.log(
            `[ChatOpenAI] 速率限制错误，${delayMs / 1000}秒后重试 (${attempt + 1}/${maxRetries})...`
          );
        }

        await delay(delayMs);
        continue;
      }

      // 如果不是速率限制错误或已达到最大重试次数，抛出错误
      throw error;
    }
  }

  throw lastError || new Error("重试失败：未知错误");
}

/**
 * 带重试机制的 ChatOpenAI 包装类
 * 
 * 这个类包装了 ChatOpenAI，添加了指数退避重试机制来处理速率限制错误。
 */
export class RetryableChatOpenAI extends ChatOpenAI {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(config: ConstructorParameters<typeof ChatOpenAI>[0] & {
    retryConfig?: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
    };
  }) {
    const { retryConfig, ...chatOpenAIConfig } = config;
    
    // 从环境变量或配置中获取重试参数
    const maxRetries = retryConfig?.maxRetries ?? 
      parseInt(process.env.OPENAI_MAX_RETRIES || "5", 10);
    const baseDelay = retryConfig?.baseDelay ?? 
      parseInt(process.env.OPENAI_RETRY_BASE_DELAY || "1000", 10);
    const maxDelay = retryConfig?.maxDelay ?? 
      parseInt(process.env.OPENAI_RETRY_MAX_DELAY || "60000", 10);

    super(chatOpenAIConfig);

    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * 重写 invoke 方法以添加重试机制
   * 这是最常用的方法，也是速率限制最常影响的方法
   */
  async invoke(
    input: BaseLanguageModelInput,
    options?: ChatOpenAICallOptions
  ): Promise<AIMessageChunk> {
    return retryWithExponentialBackoff(
      () => super.invoke(input, options),
      {
        maxRetries: this.maxRetries,
        baseDelay: this.baseDelay,
        maxDelay: this.maxDelay,
        onRetry: (attempt, error, delay) => {
          console.log(
            `[RetryableChatOpenAI] 速率限制错误，${delay / 1000}秒后重试 (${attempt}/${this.maxRetries})...`
          );
        },
      }
    );
  }
}

/**
 * 创建带重试机制的 ChatOpenAI 实例
 */
export function createRetryableChatOpenAI(
  config?: ConstructorParameters<typeof ChatOpenAI>[0] & {
    retryConfig?: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
    };
  }
): RetryableChatOpenAI {
  const defaultConfig = {
    model: process.env.OPENAI_MODEL || "deepseek-ai/DeepSeek-V3.2-Exp",
    apiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: process.env.OPENAI_BASE_URL || "https://api.siliconflow.cn/v1",
      timeout: parseInt(process.env.OPENAI_TIMEOUT || "60000", 10),
    },
    temperature: 0,
    // 添加此配置来忽略 token 使用信息
    includeUsage: false,  // 如果支持的话
    ...config,
  };

  return new RetryableChatOpenAI(defaultConfig);
}

