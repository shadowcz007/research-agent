# 🎨 Magic Writer AI —— 你的高端AI写作伙伴

> **不是编辑器，是写作灵感的延伸。**  
> 专注、无干扰、智能驱动——从零创作到精细打磨，全程由AI陪伴。

---

## 🌟 核心概念

Magic Writer AI 是一款为深度写作者打造的**高端AI写作环境**。  
它超越传统文本编辑器，成为你的**智能写作协作者**：  
- ✍️ 从空白页面生成完整初稿  
- 🔍 随时选中文字，让AI即时优化  
- 🛠️ 完全自定义AI行为，打造专属写作流程  

---

## ✨ 主要功能

### 1. AI 生成初稿  
**从无到有，一气呵成。**

- 点击主按钮，弹出 **初始提示模态框**  
- 用户可输入**详细文本提示**（Prompt）  
- 支持上传 **1~5 个文件** 作为上下文：  
  - PDF（提取文本）  
  - 图片（OCR 识别）  
  - TXT / DOCX / MD 等文档  
- AI 基于提示 + 文件内容，生成**结构完整、格式规范的 Markdown 初稿**

> ✅ **模型**：`gemini-2.5-pro`  
> ✅ **系统提示**：  
> `You are a world-class writing assistant. Generate a well-structured and engaging document based on the user's prompt. Use markdown for formatting.`

---

### 2. 上下文 AI 编辑  
**选中即改，所见即优化。**

- 在编辑器中**选中任意文本**，顶部自动浮现 **AI 工具栏**（AiToolbar）  
- 提供预设操作：  
  - ✅ 改进写作  
  - ✅ 缩短  
  - ✅ 扩写  
  - ✅ 转为正式/幽默/简洁/学术等风格  
- 💬 **“自定义”选项**：点击后工具栏平滑转为输入框，支持输入任意指令：  
  > *“把这段改成更幽默的语气”*  
  > *“用鲁迅的风格重写”*  
  > *“提炼成3句话”*

> ✅ **模型**：`gemini-2.5-flash`（低延迟，实时响应）  
> ✅ **系统提示**：  
> `You are an expert writing assistant. The user has selected a piece of text and wants to modify it. User's instruction: "{instruction}" Selected text: "{selectedText}" Rewrite the selected text based on the user's instruction. Return ONLY the rewritten text, without any preamble, explanations, or markdown formatting.`

> ⚠️ **关键要求**：仅返回重写后文本，**禁止任何前缀、解释或格式**，确保无缝替换。

---

### 3. 可定制的 AI 动作  
**你的写作，你的规则。**

- 在 **设置菜单** 中，用户可管理所有 AI 动作  
- 支持：  
  - ✅ 启用/禁用默认动作（如“改进”、“缩短”）  
  - ✅ 创建**全新自定义动作**：  
    - 自定义标签（显示名称）  
    - 自定义 AI 指令（Prompt）  
    - 自定义图标（从库中选择）  
- 默认动作**不可删除**，但可完全禁用

> 💡 示例：创建动作「转为小红书风格」→ 指令：`把这段改成小红书爆款笔记语气，带emoji和感叹号`

---

### 4. 提示历史记录  
**让灵感不再重复。**

- 系统**自动保存**用户最近使用的 **20 条自定义指令**  
- 在设置菜单中展示为“提示历史”列表  
- 支持一键操作：  
  - 👉 点击某条历史指令 → 自动填入“自定义”输入框  
  - 💾 点击“固定为动作” → 一键创建为可复用的自定义 AI 动作  

> 🔄 构建你的专属“写作指令库”，越用越聪明。

---

## 🖥️ 图形界面与用户体验（GUI & UX）

### 🎨 整体风格  
- **深色主题**：沉浸式写作环境，减少视觉干扰  
- **主色调**：`#8a2be2`（深紫）用于按钮、高亮、交互元素  
- **字体**：`Inter` 或 `Fira Code`（等宽字体支持代码块），行高 1.6，字间距优化  
- **留白**：宽松间距，专注内容，不拥挤

### 🧩 布局结构  
- **中心**：富文本编辑器（占据 90% 视口）  
- **右下角**：两个悬浮操作按钮（FAB）  
  - 🟣 **主按钮**（魔棒图标）→ 触发「生成初稿」  
  - ⚙️ **次按钮**（齿轮图标）→ 打开「设置」  

### 🧱 核心组件

| 组件 | 说明 |
|------|------|
| **编辑器 (Editor)** | 支持富文本：标题、粗体、斜体、引用、列表、代码块（带语法高亮） |
| **初始提示模态框 (InitialPromptModal)** | 大型文本输入区 + 拖放/点击上传区，支持多文件 |
| **AI 工具栏 (AiToolbar)** | 浮动、轻量、仅在选中文本时出现；“自定义”点击后平滑转为输入框 |
| **设置模态框 (SettingsModal)** | 分区清晰：管理动作、提示历史、添加新动作、图标选择器 |

### 🎭 动效与反馈

| 场景 | 动效/反馈 |
|------|-----------|
| AI 生成初稿 | 全屏半透明加载动画（紫色波浪 + “AI正在构思…”） |
| AI 重写文本 | 工具栏内显示旋转加载图标，选中区域淡出 → 重写 → 淡入 |
| 模态框/工具栏 | 淡入（fade-in）+ 微缩弹出（scale-up） |
| AI 调用失败 | 显示红色提示条：“AI 服务异常，请稍后重试” |
| 操作成功 | 轻微震动 + 成功图标（✅） |

---

## 🤖 AI 集成与系统提示（System Prompts）

| 功能 | 模型 | 系统提示 |
|------|------|----------|
| **生成初稿** | `gemini-2.5-pro` | `You are a world-class writing assistant. Generate a well-structured and engaging document based on the user's prompt. Use markdown for formatting.` |
| **重写选中文本** | `gemini-2.5-flash` | `You are an expert writing assistant. The user has selected a piece of text and wants to modify it. User's instruction: "{instruction}" Selected text: "{selectedText}" Rewrite the selected text based on the user's instruction. Return ONLY the rewritten text, without any preamble, explanations, or markdown formatting.` |

> 🔒 **关键原则**：  
> **“只返回结果”** —— 确保 AI 输出可直接替换编辑器内容，零格式污染，体验丝滑。

---

## 💡 产品哲学

> **Magic Writer AI 不是工具，而是你思维的镜像。**  
> 它不打断你，它理解你。  
> 你写，它懂；你改，它懂；你沉默，它等。  
>  
> 专注写作，其余，交给我们。