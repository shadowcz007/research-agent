# 实时日志与历史日志一致性问题解决方案 (v2)

## 1. 问题分析 (Problem Analysis)

当前系统中，研究任务的实时日志和历史报告加载的日志存在明显的不一致。根本原因在于两者的数据源和生成机制完全不同。

*   **实时日志 (Real-time Log):**
    *   由 `executor.ts` 中的 `onProgress` 回调函数直接驱动，即时触发。
    *   包含了丰富的、为实时展示而设计的上下文描述。

*   **历史日志 (Historical Log):**
    *   通过读取 `reports/{reportId}/agent_raw_result.json` 文件来**重建**日志流。
    *   `agent_raw_result.json` 保存的是 Agent 的**状态快照**，并通过**2秒防抖机制**写入。

*   **不一致的根源 (Root of Inconsistency):**
    1.  **信息源不同:** 实时日志是事件流，历史日志是状态快照的重建。
    2.  **数据丢失:** 防抖机制导致在2秒内发生的多次状态变更和日志事件只有最后一次会被保存，中间过程完全丢失。
    3.  **时序错乱:** 防抖的延迟导致保存的时间戳与事件实际发生的时间不一致。

## 2. 解决方案 (Solution)

### 2.1. 范围界定：只记录主 Agent 日志

根据对 `deepagents` 框架的分析，子 Agent (通过 `task` 工具调用) 的执行过程是一个**“黑盒”**。主 Agent 的事件流无法监听到子 Agent 内部的具体步骤（如文件读写、网络搜索等）。

因此，为了确保方案的健壮性和可行性，我们将日志记录的范围**严格限定在主 Agent 的活动**上。我们将忠实记录主 Agent 的每一次 `onProgress` 事件，但不会尝试去追踪和记录子 Agent 的内部活动。

### 2.2. 引入 `progress_log.json`

我们将为每个报告引入一个新的、专门用于记录日志的事件流文件，以确保主 Agent 的实时日志和历史日志完全一致。

*   **文件**: `reports/{reportId}/progress_log.json`
*   **作用**: 作为一个**不可变的事件日志 (Immutable Event Log)**，精确记录主 Agent 的每一次 `onProgress` 调用。
*   **格式**: 文件将存储一个 JSON 对象数组。每个对象包含 `timestamp`, `payload` (用于前端展示) 以及可选的 `rawData` (来自 Agent 的原始 `streamEvents` 事件，用于调试和深度分析)。

*   **`progress_log.json` 示例:**
    ```json
    [
      {
        "timestamp": "2025-11-17T12:00:01.000Z",
        "payload": { "stage": "初始化", "progress": 0, "log": "准备研究环境" }
      },
      {
        "timestamp": "2025-11-17T12:00:05.250Z",
        "payload": { "stage": "开始研究", "progress": 0, "log": "正在搜索相关资料..." }
      },
      {
        "timestamp": "2025-11-17T12:00:10.500Z",
        "payload": { "stage": "工具调用: task", "progress": 0, "log": "正在调用工具: task..." },
        "rawData": {
          ...
        }
      }
    ]
    ```

### 2.3. 修改 `executor.ts` 核心逻辑

1.  **创建新的日志记录方法:** 在 `AgentExecutorService` 中添加一个私有的异步方法 `logProgressEvent(reportId, progressData)`。
2.  **`logProgressEvent` 的双重职责:**
    *   **记录到文件:** 创建一个带时间戳的日志条目，并**立即、原子性地追加**到 `reports/{reportId}/progress_log.json` 文件中。
    *   **实时推送:** 调用原始的 `onProgress` 回调，将 `progressData` 发送到前端，确保实时视图不受影响。
3.  **替换所有 `onProgress` 调用:** 在 `execute` 方法中，将所有对 `onProgress(...)` 的直接调用全部替换为对 `await this.logProgressEvent(reportId, ...)` 的调用。
4.  **保留 `agent_raw_result.json`:** 此文件继续按原样工作。它的职责回归为**调试和任务恢复**，不再作为历史日志的数据源。

### 2.4. 前端修改 (Implied Frontend Changes)

*   **实时视图:** 保持不变，继续监听服务器推送的 `onProgress` 事件。
*   **历史视图:** 修改历史报告的加载逻辑。**不再读取和解析 `agent_raw_result.json`**，而是直接请求一个新的后端API（例如 `/api/reports/{reportId}/logs`），该API负责返回 `progress_log.json` 的完整内容。前端只需遍历并渲染这个数组即可。

## 3. 实施步骤 (Implementation Steps)

1.  **后端 - 文件存储层:** 在 `lib/storage/file-storage.ts` 中添加一个新方法 `appendProgressLog(reportId, logEntry)`。
2.  **后端 - 执行器 (`executor.ts`):**
    *   实现 `logProgressEvent` 方法。
    *   在 `execute` 方法的开头，确保 `progress_log.json` 文件被创建或清空。
    *   全局搜索并替换所有 `onProgress` 调用为 `logProgressEvent`。
3.  **后端 - API (推荐):** 创建一个新的 API 端点，用于安全地提供 `progress_log.json` 的内容给前端。
4.  **前端:** 调整历史报告页面的数据请求逻辑。

## 4. 方案优势 (Advantages)

*   **绝对一致性:** 主 Agent 的实时和历史日志的数据源变为同一个，从根本上保证了两者100%一致。
*   **关注点分离 (SoC):** Agent 的内部状态 (`agent_raw_result.json`) 与 UI 的表现层日志 (`progress_log.json`) 完全解耦。
*   **性能提升:** 对日志文件的追加操作远比反复序列化和写入整个大的JSON状态对象要高效。
*   **数据健壮性:** 即使 Agent 执行过程中意外崩溃，已经发生的日志也因为是实时追加的而被完整地记录下来。
