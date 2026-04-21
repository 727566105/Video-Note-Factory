# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 前端开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器 (端口 3015)
pnpm build            # 构建生产版本
pnpm build --mode tauri  # 构建 Tauri 桌面应用版本
pnpm lint             # ESLint 检查
pnpm preview          # 预览构建结果
```

## 前端架构

### 技术栈
- React 19 + TypeScript
- Vite 构建工具
- Tailwind CSS 4.x 样式
- Zustand 状态管理 (带 persist 中间件)
- Radix UI + shadcn/ui 组件
- antd 补充组件
- react-hook-form + zod 表单验证

### 状态管理 (`src/store/`)
使用 Zustand 的单一 store 模式，各 store 独立管理：

| Store | 文件 |职责 |
|-------|------|------|
| taskStore | `store/taskStore/` | 笔记任务管理，支持版本控制 |
| modelStore | `store/modelStore/` | AI 模型配置列表 |
| providerStore | `store/providerStore/` | 模型供应商配置 |
| configStore | `store/configStore/` | 应用全局配置 |
| siyuanStore | `store/siyuanStore/` | 思源笔记集成配置 |
| webdavStore | `store/webdavStore/` | WebDAV 备份配置 |

所有 store 使用 `persist` 中间件持久化到 localStorage。

### 路由结构 (`src/App.tsx`)
```
/                        → HomePage (笔记生成)
/settings                → SettingPage
  /settings/model        → 模型供应商列表
    /settings/model/new  → 新建供应商
    /settings/model/:id  → 编辑供应商
  /settings/download     → 下载器配置
    /settings/download/:id → 编辑下载器
  /settings/siyuan       → 思源笔记配置
  /settings/webdav       → WebDAV 备份配置
  /settings/about        → 关于页面
```

### 任务轮询机制 (`src/hooks/useTaskPolling.ts`)
- 每 3 秒轮询后端 `/api/task_status/{task_id}`
- 仅轮询 PENDING/RUNNING 状态的任务
- 成功时更新 taskStore 并显示 toast 提示

### 请求封装 (`src/utils/request.ts`)
基于 axios 的统一封装：
- 自动提取 `response.data.data` (后端返回格式 `{ code, msg, data }`)
- `code === 0` 视为成功
- 错误时自动 toast 提示

### 组件分层
```
src/
├── components/
│   ├── ui/           # shadcn/ui 基础组件
│   ├── Form/         # 表单组件
│   │   ├── modelForm/   # 模型供应商表单
│   │   └── DownloaderForm/  # 下载器表单
│   └── Icons/        # 平台图标
├── pages/
│   ├── HomePage/     # 首页
│   │   └── components/   # NoteForm, NoteHistory, MarkdownViewer 等
│   └── SettingPage/  # 设置页
├── services/         # API 服务层
├── hooks/            # 自定义 hooks
└── store/            # Zustand stores
```

### Tauri 桌面应用
配置文件：`src-tauri/tauri.conf.json`
- 前端构建命令：`pnpm build --mode tauri`
- 开发端口配置在 `tauri.conf.json` 的 `build.devUrl`