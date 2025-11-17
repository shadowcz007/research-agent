# 任务恢复功能优化开发计划

## 1. 背景

当前的研究代理（Research Agent）执行流程是原子性的，一旦启动便会一直运行至完成或出错。如果在此过程中发生意外中断（如服务器重启、进程崩溃等），整个任务的进度都会丢失，用户不得不从头开始，这会浪费大量的计算资源和时间。

`agent_raw_result.json` 文件目前被设计为定期保存代理执行过程中的完整状态，包括消息历史、工具调用、Todos 列表和生成的文件。这为我们实现任务恢复提供了数据基础。

本计划旨在利用 `agent_raw_result.json` 文件，开发一个可靠的任务恢复机制，允许系统在发生中断后，从上一个保存的状态点无缝地继续执行任务。

## 2. 目标

- **无缝恢复**: 实现一个 `resume` 方法，能够读取中断任务的 `agent_raw_result.json` 状态，并从上次中断的位置继续执行，无需用户手动干预。
- **状态完整性**: 确保任务的所有关键上下文都被完整恢复，包括：
    - **任务状态**: `todos`, `files`, `toolCalls`, `progress`, `stage` 等。
    - **Agent 记忆**: 完整的消息历史记录（`messages`），确保 Agent 能够基于之前的对话和决策继续工作。
- **鲁棒性**: 增强系统的健壮性，能够优雅地处理状态文件不存在、格式损坏或消息历史为空等异常情况。
- **用户反馈**: 在任务恢复过程中，向前端提供清晰的状态反馈（如 "正在恢复任务..."），提升用户体验。
- **代码可维护性**: 复用现有的 `execute` 逻辑，避免代码冗余，确保新功能易于理解和维护。

## 3. 技术设计

核心思路是在 `AgentExecutorService` (`lib/agent/executor.ts`) 中引入一个新的入口点 `resume(reportId, onProgress)`。此方法将负责加载状态、重建上下文，并调用现有的 `execute` 方法来完成后续的执行流程。

### 3.1. 状态加载

- 在 `FileStorageService` (`lib/storage/file-storage.ts`) 中新增一个 `loadAgentRawResult(reportId)` 方法。
- 该方法负责读取并解析 `reports/{reportId}/agent_raw_result.json` 文件。
- 必须包含错误处理逻辑，以应对文件不存在或 JSON 解析失败的情况。

### 3.2. 状态恢复

`resume` 方法将执行以下操作：
1.  调用 `loadAgentRawResult` 获取持久化的状态。
2.  将 `state.task` 对象中的数据（`todos`, `files` 等）恢复到 `activeTasks` 中对应的任务实例上。
3.  处理 `state.messages` 数组，这是恢复 Agent 记忆的关键。

### 3.3. 消息历史反序列化

- `agent_raw_result.json` 中存储的消息是序列化后的 JSON 对象，需要将其转换回 LangChain 的 `BaseMessage` 实例（如 `HumanMessage`, `AIMessage`, `ToolMessage` 等）。
- 为此，需要创建一个辅助函数 `deserializeMessages(messages: any[]): BaseMessage[]`。
- 此函数将根据每个消息对象的 `id` 或 `type` 字段，实例化对应的消息类。
- 需要特别注意处理各种可能的消息类型，并提供对未知类型的降级处理方案，以增强兼容性。

### 3.4. 继续执行

1.  成功恢复任务状态和消息历史后，从消息历史的第一条 `HumanMessage` 中提取原始的 `question`。
2.  调用 `this.execute(reportId, question, onProgress, restoredMessages)`，将恢复的消息历史作为 `initialMessages` 参数传入。
3.  通过这种方式，`execute` 方法将接收到一个已经包含部分对话历史的上下文，Agent 会自然地从中断处继续思考和执行。

## 4. 开发步骤

| 任务 ID | 任务内容 | 涉及文件 | 预估工时 | 状态 |
| :--- | :--- | :--- | :--- | :--- |
| **TR-1** | **实现状态加载逻辑** | `lib/storage/file-storage.ts` | 0.5 天 | `pending` |
| | - 添加 `loadAgentRawResult` 方法 | | | |
| | - 实现文件读取和 JSON 解析 | | | |
| | - 添加健壮的错误处理 | | | |
| **TR-2** | **实现消息反序列化** | `lib/agent/executor.ts` | 1 天 | `pending` |
| | - 引入所有相关的 `Message` 类 | | | |
| | - 创建 `deserializeMessages` 辅助函数 | | | |
| | - 覆盖 `HumanMessage`, `AIMessage`, `SystemMessage`, `ToolMessage` 等类型 | | | |
| **TR-3** | **实现核心 `resume` 方法** | `lib/agent/executor.ts` | 1.5 天 | `pending` |
| | - 创建 `resume(reportId, onProgress)` 方法 | | | |
| | - 编排状态加载、任务恢复、消息反序列化的完整流程 | | | |
| | - 调用 `execute` 方法并传入恢复的上下文 | | | |
| | - 添加详细的日志记录 | | | |
| **TR-4** | **暴露恢复接口** | (待定, 如 `lib/server.ts`) | 0.5 天 | `pending` |
| | - 创建一个新的 API 端点（例如 `POST /reports/:reportId/resume`）来触发 `resume` 方法 | | | |
| **TR-5** | **编写与集成测试** | `tests/` | 2 天 | `pending` |
| | - 为 `loadAgentRawResult` 和 `deserializeMessages` 编写单元测试 | | | |
| | - 编写一个集成测试，模拟任务中断和恢复的完整场景 | | | |
| | - 验证恢复后 Agent 的行为是否符合预期 | | | |

---

**总计预估工时:** 5.5 天
