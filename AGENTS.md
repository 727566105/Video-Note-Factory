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

# VideoNote 项目指南

AI 视频笔记工具：导入音视频链接/文件，自动转写、总结、截图，生成结构化笔记。前后端分离 + Docker 部署。

## 目录结构

- `backend/` — FastAPI + SQLAlchemy + SQLite，入口 `main.py`（uvicorn，端口 `BACKEND_PORT`，默认 8483）
  - `app/routers/` — API 路由层（REST，挂在 `/api` 下）
  - `app/services/` — 业务逻辑（`config_export.py` 配置导入导出、`webdav_backup.py` 备份/恢复、`note_share.py` 笔记跨用户分享）
  - `app/db/` — 数据访问层（`engine.py` 引擎，`*_dao.py` 各 DAO）+ SQLAlchemy 模型 `app/models/`
  - `app/utils/path_helper.py` — **三级/四级目录命名 + 笔记文件查找（核心，见下方 gotcha）**
  - `app/transcriber/` — 转写提供器（fast-whisper/bcut/mlx 等）
  - `tests/` — pytest（含 `conftest.py`）
- `videoNote_frontend/` — React 19 + Vite + TypeScript + **Tailwind CSS v4 + shadcn/ui (Radix) + Zustand**（antd 仍有残留引用，新组件统一用 shadcn/ui），端口 `VITE_FRONTEND_PORT`（默认 3015）
  - `src/layouts/SettingLayout.tsx` — 设置页侧边栏分组配置（`settingGroups` 数组），4 个分组：账号与工作区 / 基础数据设置 / AI 与处理 / 系统管理
  - `src/store/` — Zustand store（`configStore` 带 persist 中间件，持久化视图模式等偏好到 localStorage）
  - API 通过 `src/utils/request.ts`（axios）→ `/api` 前缀；base URL 由 `VITE_API_BASE_URL` 配置
- `data/` — 运行时数据（`video_note.db` + `video/{platform}/{author}/{video}/` 笔记/媒体）
- `deploy.sh` / `deploy.local.sh` / `restart.sh` / `stop.sh` — 部署/重启/停止脚本（`stop.sh` 同时处理 Docker 容器和本地进程）
- `Dockerfile` — 多阶段构建（前端 pnpm build → nginx 静态文件 + 后端 Python），镜像 `dick86114/videonote:dev3.0`
- `.env` / `.env.example` / `.env.low-spec.example` — 环境变量配置

## 常用命令

```bash
# 后端（从 backend/ 运行）
.venv/bin/python main.py                              # 启动（venv 在仓库根 .venv/）
.venv/bin/python -m pytest tests/                     # 全量测试（从 backend/ 跑）
.venv/bin/python -m pytest tests/test_xxx.py -v -s    # 单文件 + 打印

# 前端（从 videoNote_frontend/ 运行）
pnpm dev                          # 开发服务器（HMR，读源码，端口 3015）
pnpm build                        # 构建
pnpm lint                         # eslint
pnpm test                         # vitest 单测
pnpm test:e2e                     # playwright e2e

# Docker 部署（生产模式，nginx 静态文件，无 HMR）
./deploy.sh                       # 拉镜像 + 启动容器
./stop.sh                         # 停止 Docker 容器 + 本地进程
./restart.sh                      # 重启
```

注意：venv 在**仓库根** `.venv/`，不是 `backend/venv/`。前端必须 `cd videoNote_frontend` 再跑 pnpm。`pnpm dev`（开发模式）和 Docker（生产模式）**共用 3015 端口**，不能同时运行。

## 架构边界

- **路由层只编排**：参数校验 + 调 service + 用 `ResponseWrapper`（`app/utils/response.py`）返回 `{code,msg,data}`。业务逻辑放 service/DAO。
- **DAO 层不返回 JSON**：返回 ORM 对象或原始数据，序列化在路由层。
- **路径管理统一走 `path_helper.py`**：不要在业务代码里手拼 `data/video/...` 路径，用 `get_video_folder` / `find_note_file` / `sanitize_path_name` 等。
- **数据库替换 SQLite 文件前必须 `engine.dispose()`**（释放连接池），否则 Windows/文件锁导致写入失败。
- **前端设置页导航**：新增/调整设置子页面需要同时改三处 — `App.tsx`（路由）+ `SettingLayout.tsx`（`settingGroups` 数组）+ 新页面组件。设置页偏好（视图模式等）用 Zustand `configStore` + persist 持久化，不要用 `useState`（页面切换会丢）。

## 关键 gotcha

- **文件名按 UTF-8 字节算，不是字符**：Linux 单文件名上限 255 **字节**。`sanitize_path_name(name, max_length=200)` 按字节截断并在字符边界安全切分。改目录命名逻辑务必保持字节语义。
- **笔记目录结构**：`data/video/{platform}/{author_id}_{author_name}/{video_id}_{title}/`，内含 `note.md`、`note_{user_id}.json`、`status.json`、`cover.jpg`、`image_*.jpg`、`screenshots/`。
- **自愈合查找**：`find_note_file` / `get_video_folder` 在精确目录不存在时，按 `{video_id}_` / `{author_id}_` 前缀扫描已有目录复用（兼容旧整机包截断点不一致）。新增路径查找逻辑要保留这层兜底。
- **导入整机包**：`_safe_extract_all` 逐文件解压 + 超长路径段截断 + zip-slip 防护（拒绝 `..`/绝对路径 + resolve 校验）。不要换回 `zipfile.extractall`。
- **备份/恢复全局状态**：`_restore_in_progress` 等模块级变量，`main.py` lifespan 启动时调 `reset_stale_backup_state()` 自愈重置（防进程被 kill 卡死）。
- **配置导入**：`_is_placeholder` 只认 `********`（导出脱敏占位符）为假值；`sk-test` 是系统内置 provider 默认 key，应忠实导入，不要当占位符跳过。

## 敏感区域改动前必读

- 改 `path_helper.py` 目录命名/查找逻辑 → 影响所有笔记媒体定位，先看现有自愈合测试
- 改备份/恢复 → 看 `tests/test_backup_import.py` + `tests/test_webdav_cleanup.py` + `tests/test_webdav_hardening.py`（含 zip-slip 安全回归）
- 改笔记分享 → 看 `tests/test_note_share.py`（跨用户权限 + 冲突解决）
- 改 `SettingLayout.tsx` 分组结构 → 需同步检查 `App.tsx` 路由是否存在
- `openspec/` — 架构/重大变更走 OpenSpec 提案流程（见文件顶部 managed block）
- 根 `CLAUDE.md` / `videoNote_frontend/CLAUDE.md` — 更详细的项目约定
