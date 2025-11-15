# Research Agent

一个基于 Next.js 的 AI 研究助手，用户输入研究问题，Agent 完成问题拆解、网络查找、审查，最后生成研究报告。

## 功能特性

- 🔍 **智能研究**: 使用 AI Agent 自动进行深度研究
- 📊 **实时进度**: 通过 SSE 实时查看研究进度
- 📝 **报告生成**: 自动生成结构化的 Markdown 报告
- 📚 **版本管理**: 支持报告版本历史和下载
- 🎨 **现代 UI**: 使用 shadcn/ui 构建的现代化界面

## 技术栈

- **前端**: Next.js 14 (App Router), React, TypeScript
- **UI 组件**: shadcn/ui, Tailwind CSS
- **后端**: Next.js API Routes
- **AI**: LangChain, ChatOpenAI (DeepSeek), Tavily Search, DeepAgents
- **实时通信**: Server-Sent Events (SSE)

## 环境变量

创建 `.env.local` 文件并配置以下变量：

```env
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
OPENAI_MODEL=deepseek-ai/DeepSeek-V3.2-Exp
TAVILY_API_KEY=your-tavily-api-key
```

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 配置环境变量（见上方）

3. 运行开发服务器：
```bash
npm run dev
```

4. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)

## 项目结构

```
research-agent/
├── app/                    # Next.js App Router
│   ├── page.tsx           # 主页面 (GUI-01)
│   ├── research/[id]/     # 进度页面 (GUI-02)
│   │   └── report/        # 报告页面 (GUI-03)
│   └── api/               # API 路由
├── lib/
│   ├── agent/            # Agent 逻辑
│   └── storage/          # 文件存储管理
├── components/           # React 组件
│   └── ui/              # shadcn/ui 组件
└── reports/             # 报告存储目录
```

## 使用说明

1. **提交研究问题**: 在主页面输入研究问题并提交
2. **查看进度**: 自动跳转到进度页面，实时查看研究进度
3. **查看报告**: 研究完成后自动跳转到报告页面
4. **下载报告**: 在报告页面可以下载 Markdown 格式的报告

## 开发

```bash
# 开发模式
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start

# 代码检查
npm run lint
```

## 注意事项

- 报告文件存储在 `reports/` 目录下
- 生产环境建议使用 Redis 或数据库存储任务状态
- 确保有足够的 API 配额用于 OpenAI 和 Tavily

## 许可证

ISC

