# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 前端开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器 (端口 3015)
pnpm build            # 构建生产版本
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

| Store | 职责 | persist | 初始化 |
|-------|------|---------|--------|
| `authStore` | 用户认证状态 | 是 | — |
| `taskStore` | 笔记任务管理 | 是 | App.tsx 全局加载 |
| `modelStore` | AI 模型配置列表 | 是 | — |
| `providerStore` | 模型供应商配置 | 否 | AuthenticatedApp 加载 |
| `configStore` | 应用全局配置 | 是 | — |
| `subscriptionStore` | 订阅频道管理 | 否 | AuthenticatedApp 加载 |
| `summarySettingsStore` | 总结设置 | 是 | — |
| `siyuanStore` | 思源笔记集成 | 是 | — |
| `webdavStore` | WebDAV 备份配置 | 是 | — |
| `themeStore` | 主题切换 | 是 | — |

### 路由结构 (`src/App.tsx`)
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
/settings                   → 设置页
  /settings/model           → 模型供应商 [AdminRoute]
  /settings/download        → 下载器配置 [AdminRoute]
  /settings/taskqueue       → 任务队列 [AdminRoute]
  /settings/siyuan          → 思源笔记配置
  /settings/webdav          → WebDAV 备份配置
  /settings/about           → 关于页面
  /settings/subscription    → 订阅管理 [AdminRoute]
  /settings/users           → 用户管理
```

### 布局模式
- 桌面端: `SidebarProvider` + `AppSidebar` 侧边栏布局
- 移动端: `SiteHeader` + `MobileBottomNav` 底部导航 + `SwipeBackHandler` 滑动返回

### 平台图标系统 (`src/components/Icons/platform.tsx`)
- 8 个平台 Logo SVG 组件: BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, XiaohongshuLogo, CCTVLogo, LocalLogo, AudioLogo
- 默认尺寸 `w-6 h-6`，通过 `className` prop 覆盖
- 各页面独立维护 `iconMap` 字典，未知平台 fallback 到 `LocalLogo`

### 任务轮询机制 (`src/hooks/useTaskPolling.ts`)
- 每 3 秒轮询后端 `/api/task_status/{task_id}`
- 仅轮询 PENDING/RUNNING 状态的任务
- 成功时更新 taskStore 并显示 toast 提示

### 请求封装 (`src/utils/request.ts`)
基于 axios 的统一封装：
- 自动提取 `response.data.data` (后端返回格式 `{ code, msg, data }`)
- `code === 0` 视为成功
- 错误时自动 toast 提示
