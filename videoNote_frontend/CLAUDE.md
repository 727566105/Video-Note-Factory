# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 前端开发命令

```bash
pnpm install          # 安装依赖
pnpm dev              # 启动开发服务器 (端口 3015)
pnpm build            # 构建生产版本
pnpm lint             # ESLint 检查
pnpm preview          # 预览构建结果
pnpm test             # 运行测试 (vitest)
pnpm test:e2e         # 运行 E2E 测试 (playwright)
```

**注意**: 从项目根目录运行时需用 `pnpm --dir videoNote_frontend <command>`。

## 前端架构

### 技术栈
- React 19 + TypeScript + Vite
- Tailwind CSS 4.x + shadcn/ui + antd
- Zustand (带 persist 中间件)
- react-hook-form + zod 表单验证
- Swiper 轮播组件

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

### 设置页架构
- 无侧边栏，设置项在用户下拉菜单中（`nav-user.tsx` 桌面端 / `site-header.tsx` 移动端）
- 管理员专属项通过 `isAdmin()` 判断显示
- 桌面端 `/settings` 重定向到 `/settings/about`

### 笔记详情页 (`src/pages/NoteDetailPage/`)
- `LeftPanel.tsx`: 视频播放 + 任务状态 + 总结设置
- `RightPanel.tsx`: Markdown / 思维导图 / 转写文本 + 导出
- `processing.tsx`: 处理中/失败状态视图
- 局部设置 `localSettings` 隔离全局 store

### 自定义组件
- `GuideOverlay`: 自建引导组件，`createPortal` + `box-shadow` 聚光灯
- `FullscreenViewer`: 全屏图片查看器（缩放/拖拽/实况照片）
- `MediaGallery`: Swiper 轮播 + 实况照片长按播放

### 总结设置默认值
- `videoUnderstanding`: 默认 `true`
- `selectedFormats`: 默认全部 `['toc', 'link', 'screenshot', 'summary']`
- 默认值在 store、`SummarySettings`、`NoteForm`、`NoteDetailPage` 四处保持一致

### 自定义 Hooks (`src/hooks/`)
- `useTaskPolling`: 每 3 秒轮询任务状态
- `use-mobile`: 移动端检测
- `useHomeGuide` / `useDetailGuide`: 新用户引导
- `useCheckBackend` / `useConfigHealth`: 后端健康检查
- `usePlatformFeatures`: 平台特性检测

### 请求封装 (`src/utils/request.ts`)
- 基于 axios，后端返回格式 `{ code, msg, data }`，`code === 0` 为成功
- 错误时自动 toast 提示
