# 🌟 Magic Writer AI —— 你的高端AI写作伙伴

> **核心理念**：  
> 不只是编辑器，而是懂你的写作伙伴。从零生成、智能润色、风格重塑——一切在无干扰的沉浸环境中完成。

---

## ✨ 核心功能

### 1. 🚀 AI 生成初稿（From Scratch）
- **触发方式**：点击右下角主 FAB 按钮（魔棒图标）
- **弹出模态框**，支持：
  - 输入详细文本提示（Prompt）
  - 上传文件作为上下文（PDF、图片、TXT、DOCX）
- **输出格式**：结构完整、语义清晰的 **Markdown 文档**
- **AI 模型**：`gemini-2.5-pro`
- **系统提示**：
  ```text
  You are a world-class writing assistant. Generate a well-structured and engaging document based on the user's prompt. Use markdown for formatting.
  ```

---

### 2. ✏️ 上下文 AI 编辑（In-line Editing）
- **触发条件**：用户选中任意一段文本
- **出现浮动 AI 工具栏**（上方悬浮，优雅淡入）
- **预设操作**：
  - ✅ 改进写作
  - ✅ 缩短
  - ✅ 扩写
  - ✅ 重写为更正式/幽默/简洁等风格
- **自定义指令**：
  - 点击「自定义」→ 工具栏平滑转为输入框
  - 支持自然语言指令：  
    > “把这段改成更幽默的语气”  
    > “用学术风格重写”  
    > “删掉所有被动语态”
- **AI 模型**：`gemini-2.5-flash`
- **系统提示模板**：
  ```text
  You are an expert writing assistant. The user has selected a piece of text and wants to modify it. User's instruction: "{instruction}" Selected text: "{selectedText}" Rewrite the selected text based on the user's instruction. Return ONLY the rewritten text, without any preamble, explanations, or markdown formatting.
  ```
> 💡 **设计关键**：只返回纯文本，确保无缝替换编辑器内容，保障流畅体验。

---

### 3. 🎨 全文风格改写（Document-wide Rewrite）
- **入口**：编辑器正上方专属“风格工具栏”
- **支持选项**：
  - 预设风格：`专业正式`、`风趣幽默`、`简洁有力`、`诗意文艺`、`科技报告`
  - 自定义风格（用户可创建）
- **行为**：
  - AI 重写全文，**严格保留所有 Markdown 结构**（标题、代码块、列表、加粗、斜体等）
  - 仅调整语气、词汇、句式
- **AI 模型**：`gemini-2.5-pro`
- **系统提示**：
  ```text
  You are an expert writing assistant. Your task is to rewrite an entire document based on a specific style instruction provided by the user. It is crucial that you maintain the original markdown structure, including all headings, subheadings, code blocks, bold/italic text, and paragraph breaks. Only change the tone and wording of the text itself as requested.
  ```
> ✅ **关键设计**：结构不变，风格重塑 —— 保证内容完整性与创作自由。

---

### 4. 🔧 高度可定制化（Deep Customization）
- **入口**：右下角「设置」FAB 按钮 → 打开设置模态框
- **功能分区**：
  - **AI 动作管理**（Tabs: “AI Actions”）
    - 启用/禁用任意动作
    - 创建新动作：自定义名称、Prompt、图标
    - 默认动作不可删除，但可禁用
  - **文风管理**（Tabs: “Styles”）
    - 创建/编辑自定义风格（名称 + Prompt）
    - 为每个风格分配专属图标（如 🎭、⚖️、🚀）
- **数据持久化**：所有自定义项本地存储，支持导出/导入

---

### 5. 📜 提示历史与固定（Prompt History & Pinning）
- **自动记录**：最近 20 条用户自定义指令
- **展示位置**：设置 → “历史记录”标签页
- **一键固定**：
  - 点击历史项 → “固定为动作”按钮
  - 自动创建新可复用 AI 动作（带名称、图标、Prompt）
- **价值**：将临时指令转化为高效工作流，告别重复输入

---

## 🎨 图形界面与用户体验（GUI / UX）

### 🖤 整体风格
- **主题**：现代深色模式（Dark Mode）
- **主色调**：`#8a2be2`（紫色）用于按钮、高亮、开关、图标
- **字体**：`Inter` 或 `SF Pro Text`，行高 1.6，字间距优化
- **目标**：极简、无干扰、专注写作的沉浸式环境

### 📐 布局结构
```
┌───────────────────────────────────────┐
│ 风格工具栏（全局风格切换）             │
├───────────────────────────────────────┤
│                                       │
│          📄 富文本编辑器               │
│  支持：标题、加粗、斜体、代码块、列表  │
│  代码块：语法高亮 + 行号               │
│                                       │
└───────────────────────────────────────┘
                      └───────┐
                             ▼
                    [✨ 魔棒]   [⚙️ 设置]
                    （主FAB）   （次FAB）
```

### 🧩 核心组件

| 组件 | 说明 |
|------|------|
| **编辑器 (Editor)** | 支持完整 Markdown 渲染 + 实时预览（利用HTML的原生属性：contentEditable），代码块语法高亮（Prism.js） |
| **AI 工具栏 (AiToolbar)** | 选中文本时淡入，5个预设按钮 + “自定义” → 点击后平滑转为输入框 |
| **设置模态框 (SettingsModal)** | 标签页布局（AI 动作 / 文风），支持拖拽图标、搜索、排序 |

### 🎭 动效与反馈
| 场景 | 动效/反馈 |
|------|-----------|
| AI 生成中 | 全屏半透明遮罩 + 动态提示：“正在生成文档...” |
| 风格改写中 | 遮罩提示：“正在应用新风格...” |
| 模态框打开 | 淡入动画（0.2s），背景轻微模糊 |
| 工具栏出现 | 滑入 + 缩放（0.15s） |
| AI 失败 | 顶部红色横幅提示：“AI 服务暂时不可用，请稍后重试。” |
| 操作成功 | 微动效 + 绿色小气泡：“已更新” |

---

## 🤖 AI 集成与系统提示（System Prompts）

| 功能 | 模型 | 系统提示（System Prompt） |
|------|------|---------------------------|
| **生成初稿** | `gemini-2.5-pro` | `You are a world-class writing assistant. Generate a well-structured and engaging document based on the user's prompt. Use markdown for formatting.` |
| **选中文本重写** | `gemini-2.5-flash` | `You are an expert writing assistant. The user has selected a piece of text and wants to modify it. User's instruction: "{instruction}" Selected text: "{selectedText}" Rewrite the selected text based on the user's instruction. Return ONLY the rewritten text, without any preamble, explanations, or markdown formatting.` |
| **全文风格改写** | `gemini-2.5-pro` | `You are an expert writing assistant. Your task is to rewrite an entire document based on a specific style instruction provided by the user. It is crucial that you maintain the original markdown structure, including all headings, subheadings, code blocks, bold/italic text, and paragraph breaks. Only change the tone and wording of the text itself as requested.` |

> 💡 **模型选择逻辑**：  
> - `flash`：高频、低延迟交互（如选中改写）  
> - `pro`：复杂、长文本、结构敏感任务（如生成/重写全文）

---

## 📦 总结：Magic Writer AI 的独特价值

| 维度 | 传统工具 | Magic Writer AI |
|------|----------|------------------|
| **创作起点** | 空白页 | AI 从零生成 + 文件上下文 |
| **编辑方式** | 手动修改 | 智能上下文指令 |
| **风格调整** | 无或插件 | 一键全局风格重塑 |
| **个性化** | 固定功能 | 用户自定义 AI 动作与风格 |
| **工作流** | 碎片化 | 全流程沉浸式协作 |

> ✅ **一句话定位**：  
> **不是让你写得更快，而是让你写得更像你自己。**


