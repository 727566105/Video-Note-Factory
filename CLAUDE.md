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

videoNote 是一个 AI 视频笔记生成工具，支持从 Bilibili、YouTube、抖音、快手、小红书等平台下载视频，通过 AI 转写和总结生成 Markdown 笔记。

**技术栈**: FastAPI (后端) + React/TypeScript (前端)

## 常用命令

### 后端开发
```bash
cd backend
pip install -r requirements.txt
python3 main.py              # 启动后端 (默认端口 8483)
# 注意: macOS 需要 python3，不是 python
```

### 后端测试
```bash
cd backend
python3 -m pytest tests/     # 运行测试
python3 -m app.routers.test_export  # 单独测试导出功能
```

### 前端开发
```bash
cd videoNote_frontend
pnpm install                # 安装依赖
pnpm dev                    # 启动开发服务器 (端口动态分配，默认 3015)
pnpm build                  # 构建生产版本
pnpm lint                   # ESLint 检查
pnpm preview                # 预览构建结果
```

### Docker 部署
```bash
docker-compose up --build   # 构建并启动所有服务
```

## 项目结构

```
videoNote/
├── backend/                    # 后端服务 (FastAPI)
├── videoNote_frontend/          # 前端服务 (React + TypeScript)
├── browser-extension/          # Chrome 浏览器插件
│   ├── manifest.json           # 插件配置
│   ├── popup/                  # 弹窗页面
│   ├── options/                # 设置页面
│   └── background/             # Service Worker
├── doc/                        # 文档资源
├── nginx/                      # Nginx 配置
└── .env.example                # 环境变量模板
```

## 架构说明

### 后端架构 (backend/)

**核心流程**: `NoteGenerator` 服务协调整个笔记生成流程

1. **下载器** (`app/downloaders/`)
   - 平台特定下载器继承自 `Downloader` 基类
   - 支持: Bilibili, YouTube, 抖音, 快手, 小红书, 本地视频
   - `SUPPORT_PLATFORM_MAP` 定义平台与下载器的映射关系

2. **转写器** (`app/transcriber/`)
   - 可配置的转写引擎 (通过 `TRANSCRIBER_TYPE` 环境变量)
   - 支持: fast-whisper, bcut, kuaishou, mlx-whisper, groq
   - 统一接口 `Transcriber.transcript()`

3. **GPT 提供商** (`app/gpt/`)
   - `GPTFactory` 根据配置动态创建 GPT 实例
   - `ProviderService` 管理用户的 API 配置
   - 所有 GPT 类继承自 `GPT` 基类

4. **供应商类型系统**
   - `built-in`: 内置供应商（OpenAI/DeepSeek/Qwen 等），logo 来自 `@lobehub/icons`
   - `custom`: 自定义供应商，支持上传 logo 图标
   - `newapi`: NewAPI 中转服务，使用专用 logo
   - 前端 `AILogo` 组件根据 `name` + `type` + `logoUrl` 决定显示哪个图标

5. **任务状态管理**
   - 状态文件: `{task_id}.status.json` (实时更新)
   - 结果文件: `{task_id}.json` (最终笔记)
   - 支持缓存机制: 音频/转写/Markdown 都会缓存

### 前端架构 (videoNote_frontend/)

**技术栈**: React 19 + TypeScript + Vite + Tailwind CSS 4.x + Zustand + shadcn/ui + antd

1. **状态管理** (`src/store/`) — 各 store 独立管理

   | Store | 职责 | persist | 初始化 |
   |-------|------|---------|--------|
   | `taskStore` | 笔记任务管理，支持版本控制 | 是 | App.tsx 全局加载 |
   | `modelStore` | AI 模型配置列表 | 是 | — |
   | `providerStore` | 模型供应商配置 | 否 | 组件内 `fetchProviderList()` |
   | `configStore` | 应用全局配置 | 是 | — |
   | `subscriptionStore` | 订阅频道管理 | 否 | App.tsx 全局加载 |
   | `siyuanStore` | 思源笔记集成 | 是 | — |
   | `webdavStore` | WebDAV 备份配置 | 是 | — |

   注意：`providerStore` 和 `subscriptionStore` 没有 persist，需要在 App.tsx 的 `AuthenticatedApp` 组件中全局加载（`fetchProviderList()` 和 `fetchSubscriptions()`）。

2. **路由结构** (`src/App.tsx`)
   ```
   /                          → 首页 (笔记生成)
   /settings/model            → 模型供应商列表
   /settings/model/new        → 新建供应商
   /settings/model/:id        → 编辑供应商
   /settings/download/:id     → 编辑下载器
   /settings/siyuan           → 思源笔记配置
   /settings/webdav           → WebDAV 备份配置
   /settings/about            → 关于页面
   ```

3. **请求封装** (`src/utils/request.ts`)
   - 基于 axios，后端返回格式 `{ code, msg, data }`，`code === 0` 为成功
   - 错误时自动 toast 提示

4. **任务轮询** (`src/hooks/useTaskPolling.ts`)
   - 每 3 秒轮询 `/api/task_status/{task_id}`
   - 仅轮询 PENDING/RUNNING 状态的任务

### 浏览器插件 (browser-extension/)

Chrome 插件 "VideoNote Helper"，功能：
- 一键获取 B站/抖音/快手/YouTube 平台 Cookie
- 快捷提交视频链接到 VideoNote 后端
- Manifest V3，Service Worker 后台运行

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

- 后端入口: `backend/main.py`
- 核心服务: `backend/app/services/note.py`
- API 路由: `backend/app/routers/`
- 前端入口: `videoNote_frontend/src/App.tsx`
- 请求封装: `videoNote_frontend/src/utils/request.ts`
- 浏览器插件: `browser-extension/manifest.json`
- 环境配置: `.env.example`

## 作者字段映射模式

数据库有三个作者相关字段：`author`、`author_id`、`author_name`。前端显示博主名称时需使用统一的 fallback 链：

```tsx
author: task.author || task.author_name || task.note?.audio_meta?.raw_info?.owner?.name || ''
```

**涉及位置**：
- `NoteListPage/index.tsx:fetchNotes()` — 笔记列表 author 映射
- `taskStore/index.ts:loadTasksFromBackend()` — audioMeta.author 映射
- `NoteDetailPage/LeftPanel.tsx:getAuthor()` — 详情页博主名称显示

**注意**：图文笔记（小红书、抖音图集）的 `author` 字段可能为空，但 `author_name` 有值，必须包含 fallback。

## 环境变量

关键配置项（参考 `.env.example`）：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `TRANSCRIBER_TYPE` | 转写引擎类型 | `fast-whisper` |
| `WHISPER_MODEL_SIZE` | Whisper 模型大小 | `base` |
| `BACKEND_PORT` | 后端端口 | `8483` |
| `FRONTEND_PORT` | 前端端口 | `3015` |
| `VITE_API_BASE_URL` | 前端访问后端地址 | `http://127.0.0.1:8483` |
| `WEBDAV_ENCRYPTION_KEY` | WebDAV 加密密钥 | 需自行设置 |

## 存储结构

后端使用四级目录结构 `data/video/{platform}/{author_id}_{author_name}/{video_id}_{title}/`：

```
data/video/{platform}/{author_id}_{author_name}/{video_id}_{title}/
├── {video_id}.mp3          # 音频
├── {video_id}.mp4          # 视频（可选）
├── cover.jpg               # 封面图
├── screenshots/            # 帧截图
│   └── screenshot_{idx}_{uuid}.jpg
├── note.json               # 最终笔记（含 markdown、audio_meta）
├── audio.json              # 音频元信息
├── transcript.json         # 转写结果
├── note.md                 # GPT 生成的 Markdown
└── status.json             # 任务实时状态
```

**平台目录映射**（`constant.py` 的 `PLATFORM_DIR_MAP`）：bilibili, youtube, douyin (含 tiktok), kuaishou, xiaohongshu, local (含 local_audio), `_other`（未知平台兜底）

**API 路由**：
- 封面图: `GET /api/video_cover/{platform}/{author_id}/{video_id}`
- 截图: `GET /api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}`
- 图片代理: `GET /api/image_proxy?url=<url>`（支持本地封面路径和远程图片）

**路径管理核心文件**：`app/utils/path_helper.py`
- `get_video_folder()`: 生成四级目录路径 `video/{platform}/{author}/{video}/`
- `get_note_file_path_v2()`: 新旧路径桥接（有 author_id 走四级，否则回退 `data/notes/`）
- `find_note_file()`: 兼容查找，优先四级路径 → 三级路径 → 扁平路径（不创建目录）
- `get_note_folder()` / `get_note_file_path()`: 旧版路径（`data/notes/`），不自动创建目录
- `move_note_files_to_video_folder()`: 旧路径迁移到四级目录
- `migrate_to_platform_structure()`: 启动时自动迁移旧数据 + 封面图

**注意**: 读取场景用 `find_note_file()`（不创建目录），写入场景用 `get_note_file_path_v2()` 并在写入前 `parent.mkdir(parents=True, exist_ok=True)`。

## 数据库

使用 SQLite + SQLAlchemy，数据库文件位于项目根目录的 `data/video_note.db`。后端启动时自动初始化（`init_db`）并种子默认供应商（`seed_default_providers`）。

**数据库迁移**: `app/db/init_db.py` 中通过 `migrate_video_tasks_table()` 和 `migrate_feed_items_table()` 函数检查并添加新列。新增字段必须同时更新模型文件和迁移函数。

## 认证系统

JWT Bearer Token 认证，通过 `app/auth/` 模块实现：
- 登录返回 JWT token，前端存储在 localStorage `auth-storage` 中
- 路由通过 `get_current_user` 依赖注入验证
- 管理员接口使用 `require_admin` 依赖
- 默认用户：admin（密码 123456）

## 订阅与频道系统

- **订阅**: 用户订阅频道后，通过定时任务或手动刷新获取最新视频
- **跨用户复用**: 新用户订阅已有频道时，复制 FeedItem 但不复制 task_id；笔记可用性通过 API 跨用户检测
- **频道统计**: `subscription_dao.get_channel_stats()` 聚合订阅者数、视频数、笔记数

## 版本号更新

版本号需同步修改 3 处：
1. `README.md` — `<h1>videoNote v{version}</h1>`
2. `videoNote_frontend/package.json` — `"version": "{version}"`
3. `videoNote_frontend/src/pages/SettingPage/about.tsx` — 关于页标题
