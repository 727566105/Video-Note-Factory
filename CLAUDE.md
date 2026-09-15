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
python3 -m pytest tests/              # 运行所有测试
python3 -m pytest tests/test_export.py -v          # 运行单个测试文件（须在 backend/ 目录下运行，无 pytest.ini）
```

### 前端测试
```bash
cd videoNote_frontend
pnpm test                             # 运行 Vitest 单元测试
pnpm test:watch                       # 运行 Vitest 监听模式
pnpm test:e2e                         # 运行 Playwright E2E 测试
pnpm test:e2e:ui                      # 运行 E2E 测试（带 UI）
```

**Playwright 配置** (`playwright.config.ts`):
- E2E 测试目录: `./e2e`
- 自动启动后端 (端口 8483) 和前端 (端口 3015)
- 支持 Chromium 浏览器测试

### 前端开发
```bash
cd videoNote_frontend
pnpm install                # 安装依赖
pnpm dev                    # 启动开发服务器 (端口由 VITE_FRONTEND_PORT 控制，默认 3015)
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
   - 支持: Bilibili, YouTube, 抖音, 快手, 小红书, CCTV, 本地视频
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
   - 状态文件: 四级目录内 `status.json` (实时更新；无 author_id 时为 `data/video/_pending/{task_id}/status.json`)
   - 结果文件: `note.json` (最终笔记；多用户为 `note_{user_id}.json`)
   - 支持缓存机制: 音频/转写/Markdown 都会缓存

6. **媒体类型架构**

   笔记根据 `content_type` 显示不同前端组件：

   | content_type | 显示组件 | 播放行为 |
   |--------------|----------|----------|
   | `video` | 视频封面 + 播放按钮 | localVideoUrl → embedUrl → videoUrl fallback |
   | `article` | MediaGallery 图片轮播 | 无视频播放 |
   | `live_photo` | MediaGallery + 长按播放 | 实况照片视频 |

   **播放 fallback 链** (`LeftPanel.tsx`):
   1. `localVideoUrl` 存在 → 播放本地 mp4
   2. `embedUrl` 存在 → iframe 嵌入播放（B站/YouTube/抖音）
   3. `videoUrl` 存在 → 跳转外部链接

   **注意**: `localVideoUrl` 需要 `author_id` 才能构建正确的四级目录路径，缺少 `author_id` 会降级到外部链接。

### 前端架构 (videoNote_frontend/)

**技术栈**: React 19 + TypeScript + Vite + Tailwind CSS 4.x + Zustand + shadcn/ui + antd

1. **状态管理** (`src/store/`) — 各 store 独立管理

   | Store | 职责 | persist | 初始化 |
   |-------|------|---------|--------|
   | `authStore` | 用户认证状态 | 是 | — |
   | `taskStore` | 笔记任务管理 | 是 | App.tsx 全局加载 |
   | `modelStore` | AI 模型配置列表 | 否 | App.tsx 由云端偏好 loadFromServer |
   | `providerStore` | 模型供应商配置 | 否 | 按需懒加载（SettingPage/ModelSelectDialog/NoteForm/CollectionDetail） |
   | `configStore` | 应用全局配置 | 是 | — |
   | `subscriptionStore` | 订阅频道管理 | 否 | AuthenticatedApp 加载 |
   | `summarySettingsStore` | 总结设置 | 否（云偏好 userPreferences 持久化） | — |
   | `siyuanStore` | 思源笔记集成 | 是 | — |
   | `webdavStore` | WebDAV 备份配置 | 是 | — |
   | `collectionStore` | 合集/资料库管理 | 否 | 页面内按需加载 |

   > 主题切换**不在 store**：由 `src/components/ThemeProvider.tsx`（React Context）+ `ThemeModeSelector.tsx` 管理，持久化到 localStorage，`ThemeProvider` 在 App 根注入。

2. **路由结构** (`src/App.tsx`)
   - `ProtectedRoute`: 需要登录认证
   - `AdminRoute`: 需要管理员权限（包裹 model/download/taskqueue/subscription）
   ```
   /login                      → 登录页
   /                           → 首页 (笔记生成)
   /notes                      → 笔记列表
   /notes/:id                  → 笔记详情
   /feed                       → 订阅动态
   /channels                   → 频道管理
   /channel/:platform/:id      → 频道详情
   /authors                    → 博主列表
   /authors/:id                → 博主详情
   /library                    → 合集/资料库列表
   /library/:id                → 合集详情
   /settings                   → 设置页（桌面端显示分组列表）
     /settings/profile         → 个人资料
     /settings/model           → 模型供应商 [AdminRoute]
     /settings/download        → 下载器配置 [AdminRoute]
     /settings/taskqueue       → 任务队列 [AdminRoute]
     /settings/siyuan          → 思源笔记配置
     /settings/webdav          → WebDAV 备份配置
     /settings/about           → 关于页面
     /settings/subscription    → 订阅管理 [AdminRoute]
     /settings/users           → 用户管理
   ```

3. **布局模式** — 桌面端与移动端分开处理
   - 桌面端: `SidebarProvider` + `AppSidebar` 侧边栏布局
   - 移动端: `SiteHeader` + `MobileBottomNav` 底部导航 + `SwipeBackHandler` 滑动返回

4. **设置页架构** — 设置子项集中在 `src/layouts/SettingLayout.tsx` 的 `groups` 配置
   - 子项（profile/siyuan/webdav/model/download/subscription/users/taskqueue/about）由 `SettingsHome`（根列表）与 `SettingsNavigation`（桌面左侧栏）渲染
   - `nav-user.tsx`（桌面端）/ `site-header.tsx`（移动端）的下拉菜单**只提供**「个人资料」「设置中心」入口，不含具体设置子项
   - 管理员专属项通过 `getVisibleGroups()` 按 `adminOnly` 过滤显示
   - 桌面端访问根 `/settings` 显示分组列表（`SettingsHome`），点入子项后左侧出现 `SettingsNavigation` 导航；移动端 `/settings` 显示设置列表，子页面直接显示内容
   - 移动端 `/settings` 显示设置列表，子页面直接显示内容

5. **笔记详情页** — 左右分栏结构
   - `LeftPanel.tsx`: 视频播放/封面 + 任务状态 + 总结设置面板
   - `RightPanel.tsx`: Markdown 渲染 / 思维导图 / 转写文本 三种视图 + 导出功能
   - `processing.tsx`: 任务处理中/失败状态视图
   - 局部设置（`localSettings`）隔离全局 store，仅影响当前笔记的重新生成

6. **自定义组件**
   - `GuideOverlay`: 自建引导组件（替代 driver.js），用 `createPortal` + `box-shadow` 聚光灯效果
   - `FullscreenViewer`: 全屏图片查看器，支持缩放/拖拽/键盘导航/实况照片长按播放
   - `MediaGallery`: Swiper 轮播图组件，支持实况照片长按播放 + 全屏查看按钮

7. **总结设置默认值** (`summarySettingsStore`)
   - `videoUnderstanding`: 默认 `true`（启用）
   - `selectedFormats`: 默认全部启用 `['toc', 'link', 'screenshot', 'summary']`
   - 以上默认值在 store、`SummarySettings`、`NoteForm`、`NoteDetailPage` 四处保持一致
   - 合集详情页（`CollectionDetail`）使用 local 模式，初始值从全局 store 继承

8. **请求封装** (`src/utils/request.ts`)
   - 基于 axios，后端返回格式 `{ code, msg, data }`，`code === 0` 为成功
   - **拦截器剥壳契约**：成功时拦截器 `return res.data`（剥掉 `{code,msg,data}` 外壳，resolve 出**裸 data**），失败时 `Promise.reject`
   - ⚠️ **组件层不要判 `response.code`**：`request.xxx()` 成功 resolve 的就是裸 data，直接用；错误统一走 catch（拦截器已 reject 并 toast）。误写 `if (response.code === 200)` 会永远走失败分支（曾导致「导入配置 → 文件解析失败」bug）
   - 错误时自动 toast 提示

9. **任务轮询** (`src/hooks/useTaskPolling.ts`)
   - 每 3 秒轮询 `/api/task_status/{task_id}`
   - 仅轮询 PENDING/RUNNING 状态的任务

10. **平台图标系统** (`src/components/Icons/platform.tsx`)
    - 8 个平台 Logo SVG 组件: BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, XiaohongshuLogo, CCTVLogo, LocalLogo, AudioLogo
    - 默认尺寸 `w-6 h-6`，通过 `className` prop 覆盖

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
2. 所有供应商统一走 `UniversalGPT`（`GPTFactory.from_config()` 无分支），新增类型只需 `providers` 表支持该 type
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

**平台目录映射**（`constant.py` 的 `PLATFORM_DIR_MAP`）：bilibili, youtube, cctv, douyin (含 tiktok), kuaishou, xiaohongshu, local (含 local_audio), `_other`（未知平台兜底）

**API 路由**：
- 封面图: `GET /api/video_cover/{platform}/{author_id}/{video_id}`
- 截图: `GET /api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}`
- 图片代理: `GET /api/image_proxy?url=<url>`（支持本地封面路径和远程图片）
- 媒体列表: `GET /api/note_media/{task_id}`（图文笔记的图片/实况照片列表）
- 媒体文件: `GET /api/note_media_file/{platform}/{author_id}/{video_id}/{filename}`（直接访问 image_*.jpg, live_photo_*.mp4）

**路径管理核心文件**：`app/utils/path_helper.py`
- `get_video_folder()`: 生成四级目录路径 `video/{platform}/{author}/{video}/`
- `get_note_file_path_v2()`: 新旧路径桥接（有 author_id 走四级，否则走 `data/video/_pending/{task_id}/`，不回退 `data/notes/`）
- `find_note_file()`: 兼容查找，优先四级路径 → 三级路径 → 扁平路径（不创建目录）
- `get_note_folder()` / `get_note_file_path()`: 旧版路径（`data/notes/`），不自动创建目录
- `move_note_files_to_video_folder()`: 旧路径迁移到四级目录
- `migrate_to_platform_structure()`: 启动时自动迁移旧数据 + 封面图

**注意**: 读取场景用 `find_note_file()`（不创建目录），写入场景用 `get_note_file_path_v2()` 并在写入前 `parent.mkdir(parents=True, exist_ok=True)`。

## 数据库

使用 SQLite + SQLAlchemy，数据库文件位于后端目录下的 `data/video_note.db`（`engine.py` 的 PROJECT_ROOT 解析为 `backend/`）。Engine 配置在 `app/db/engine.py`（默认 `data/video_note.db`，可由 `DATABASE_URL` 环境变量覆盖；兼容旧版根目录 `video_note.db`，启动时自动迁移）。后端启动时自动初始化（`init_db`）并种子默认供应商（`seed_default_providers`）。

**数据库迁移**: `app/db/init_db.py` 中通过 `migrate_video_tasks_table()` 和 `migrate_feed_items_table()` 函数检查并添加新列。新增字段必须同时更新模型文件和迁移函数。

## 配置导入导出系统

整机配置（供应商/模型/下载器等）的导出/导入，用于跨实例迁移。后端路由 `app/routers/config_backup.py`（前缀 `/configs`），核心服务 `app/services/config_export.py`。

- `GET /configs/export` — 导出配置 JSON（走 `request` 拦截器，resolve 裸 data）
- `GET /configs/export/file` — 导出为文件下载，**`require_admin` 保护 + 前端用原生 `fetch`**（不走 `request` 拦截器，因为要拿文件流 + 手动带 `Authorization: Bearer` header，见 `services/configBackup.ts`）
- `POST /configs/import/preview` — 上传文件预览（FormData）
- `POST /configs/import/preview/json` — 直接传 JSON 预览
- `POST /configs/import/execute` — 执行导入

**占位符陷阱**：导出时对脱敏字段（如密码 `********`）做占位符替换，导入还原时需识别并还原原值。`sk-test` 这类测试值**不能被误判为占位符**（曾导致配置导入丢失，见 `396fadb`）。

## 合集与资料库系统

- **合集** (`/library`): 用户创建合集，将多个笔记按标签或手动归类
- **合集总结**: AI 分析合集内所有视频内容，生成结构化综合总结
- **总结设置**: 合集详情页使用 local 模式，初始值从全局 `summarySettingsStore` 继承

## 认证系统

JWT Bearer Token 认证，通过 `app/auth/` 模块实现：
- 登录返回 JWT token，前端存储在 localStorage `auth-storage` 中
- 路由通过 `get_current_user` 依赖注入验证
- 管理员接口使用 `require_admin` 依赖
- 默认用户：admin，密码 `change_me_on_first_login`（可用 `DEFAULT_ADMIN_PASSWORD` 环境变量覆盖；CI 设为 123456）

## 订阅与频道系统

- **订阅**: 用户订阅频道后，通过定时任务或手动刷新获取最新视频
- **跨用户复用**: 新用户订阅已有频道时，复制 FeedItem 但不复制 task_id；笔记可用性通过 API 跨用户检测
- **频道统计**: `subscription_dao.get_channel_stats()` 聚合订阅者数、视频数、笔记数

## CI 测试配置

GitHub Actions 工作流 (`.github/workflows/test.yml`):
- **backend-tests**: Python 3.11 + pytest
- **frontend-unit-tests**: Node.js 22 + Vitest
- **frontend-e2e-tests**: Python 后端 + Playwright E2E

> Node 必须为 22（≥22.13）：`package.json` 声明 `packageManager: pnpm@11.8.0`，pnpm 11 依赖 `node:sqlite`（Node 22.5+ 内置），Node 20 会在 `pnpm install` 阶段崩溃。

CI 环境变量要求:
```bash
JWT_SECRET_KEY=ci-test-secret
BACKEND_PORT=8483
WEBDAV_ENCRYPTION_KEY=<encryption-key>
DEFAULT_ADMIN_PASSWORD=123456
```

## 构建与 Docker 发布

- **pnpm 版本**：`package.json` 的 `packageManager: pnpm@11.8.0`（corepack 锁定），要求 Node ≥22.13；CI 与 Dockerfile 均用 Node 22 对齐
- **Dockerfile**：前端阶段 `node:22` + `pnpm install --frozen-lockfile`，依赖 `videoNote_frontend/pnpm-lock.yaml`（**已入库，勿再忽略**）
- **子目录 `.gitignore` 陷阱**：`videoNote_frontend/.gitignore` 的规则会覆盖根 `.gitignore` 的 `!` 放行；排查「文件被忽略」用 `git check-ignore -v --no-index <path>`
- **Docker 镜像发布**：`Docker Build and Push` workflow 是 `workflow_dispatch`（手动触发，可指定分支/版本/changelog）；同时 push 到 `main` 也会自动触发构建
  ```bash
  gh workflow run "Docker Build and Push" --ref dev3.0   # 触发发布
  gh run watch <run-id>                                    # 监控构建（约 5 分钟）
  ```

## 版本号更新

版本号需同步修改 3 处：
1. `README.md` — `<h1>videoNote v{version}</h1>`
2. `videoNote_frontend/package.json` — `"version": "{version}"`
3. `videoNote_frontend/src/pages/SettingPage/about.tsx` — 关于页标题
