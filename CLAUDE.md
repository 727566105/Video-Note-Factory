<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

BiliNote 是一个 AI 视频笔记生成工具，支持从 Bilibili、YouTube、抖音等平台下载视频，通过 AI 转写和总结生成 Markdown 笔记。

**技术栈**: FastAPI (后端) + React/TypeScript (前端) + Tauri (桌面应用)

## 常用命令

### 后端开发
```bash
cd backend
pip install -r requirements.txt
python main.py              # 启动后端 (默认端口 8483)
```

### 前端开发
```bash
cd BillNote_frontend
pnpm install
pnpm dev                    # 启动开发服务器 (默认端口 5173)
pnpm build                  # 构建生产版本
pnpm lint                   # ESLint 检查
```

### Docker 部署
```bash
docker-compose up --build   # 构建并启动所有服务
```

## 架构说明

### 后端架构 (backend/)

**核心流程**: `NoteGenerator` 服务协调整个笔记生成流程

1. **下载器** (`app/downloaders/`)
   - 平台特定下载器继承自 `Downloader` 基类
   - 支持: Bilibili, YouTube, 抖音, 快手, 本地视频
   - `SUPPORT_PLATFORM_MAP` 定义平台与下载器的映射关系

2. **转写器** (`app/transcriber/`)
   - 可配置的转写引擎 (通过 `TRANSCRIBER_TYPE` 环境变量)
   - 支持: fast-whisper, bcut, kuaishou, mlx-whisper, groq
   - 统一接口 `Transcriber.transcript()`

3. **GPT 提供商** (`app/gpt/`)
   - `GPTFactory` 根据配置动态创建 GPT 实例
   - `ProviderService` 管理用户的 API 配置
   - 所有 GPT 类继承自 `GPT` 基类

4. **任务状态管理**
   - 状态文件: `{task_id}.status.json` (实时更新)
   - 结果文件: `{task_id}.json` (最终笔记)
   - 支持缓存机制: 音频/转写/Markdown 都会缓存

### 前端架构 (BillNote_frontend/)

1. **状态管理** (`src/store/`)
   - `taskStore`: 管理笔记生成任务，支持版本控制
   - `modelStore`: 管理 AI 模型配置
   - `configStore`: 应用全局配置
   - 使用 Zustand + persist 中间件持久化

2. **服务层** (`src/services/`)
   - 基于 axios 的统一请求封装 (`src/utils/request.ts`)
   - 响应拦截器统一处理错误提示

3. **路由设计** (`src/App.tsx`)
   - 首页: 笔记生成和查看
   - 设置页: 模型/下载器配置
   - 嵌套路由用于表单复用

4. **任务轮询** (`src/hooks/useTaskPolling.ts`)
   - 每 3 秒轮询后端任务状态
   - 自动更新前端任务列表

## 开发注意事项

### 环境依赖

1. **FFmpeg**: 必须安装并加入系统 PATH
   ```bash
   # Mac
   brew install ffmpeg
   # Ubuntu
   sudo apt install ffmpeg
   ```

2. **CUDA 加速** (可选): 需要配置 fast-whisper + CUDA

### 添加新平台支持

1. 在 `app/downloaders/` 创建新的下载器类，继承 `Downloader`
2. 在 `app/services/constant.py` 的 `SUPPORT_PLATFORM_MAP` 注册
3. 更新前端平台图标 (`src/components/Icons/platform.tsx`)
4. 添加 URL 验证规则 (`app/validators/video_url_validator.py`)

### 添加新转写器

1. 在 `app/transcriber/` 实现继承 `Transcriber` 基类
2. 在 `app/transcriber/transcriber_provider.py` 注册
3. 更新 `.env` 中的 `TRANSCRIBER_TYPE` 选项

### 添加新 GPT 提供商

1. 在 `app/gpt/` 创建新的 GPT 类，继承 `GPT` 基类
2. 在 `app/gpt/gpt_factory.py` 的 `GPTFactory.from_config()` 添加分支
3. 确保数据库 `providers` 表支持该提供商类型

## 关键文件位置

- 后端入口: [backend/main.py](backend/main.py)
- 核心服务: [backend/app/services/note.py](backend/app/services/note.py)
- API 路由: [backend/app/routers/](backend/app/routers/)
- 前端入口: [BillNote_frontend/src/App.tsx](BillNote_frontend/src/App.tsx)
- 请求封装: [BillNote_frontend/src/utils/request.ts](BillNote_frontend/src/utils/request.ts)
- 环境配置: [.env.example](.env.example)

## 缓存机制

后端会在 `note_results/` 目录缓存以下文件以加速重试:
- `{task_id}_audio.json`: 音频元信息
- `{task_id}_transcript.json`: 转写结果
- `{task_id}.md`: GPT 生成的 Markdown
- `{task_id}.status.json`: 任务实时状态
