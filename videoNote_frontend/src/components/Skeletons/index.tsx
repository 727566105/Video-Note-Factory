import { Skeleton } from '@/components/ui/skeleton'

// 表格行骨架 — 用于笔记列表（匹配 3.0 版本）
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-4 py-4 border-b border-border"
        >
          {/* 复选框 */}
          <Skeleton className="w-4 h-4 rounded" />
          {/* 封面 - aspect-video */}
          <div className="w-32">
            <Skeleton className="aspect-video rounded-md" />
          </div>
          {/* 标题区 - 两行 */}
          <div className="flex-1 min-w-0 space-y-1">
            <Skeleton className="h-5 w-3/4 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
          </div>
          {/* 笔记摘要 */}
          <div className="flex-1 min-w-0">
            <Skeleton className="h-4 w-full rounded" />
          </div>
          {/* 操作按钮 */}
          <div className="w-24 flex justify-end">
            <Skeleton className="w-7 h-7 rounded-md" />
          </div>
        </div>
      ))}
    </>
  )
}

// 详情页骨架 — 匹配 3.0 版本双栏布局
export function DetailSkeleton() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* 左栏 */}
      <div className="flex flex-col border-r border-border overflow-hidden w-[592px] min-w-[400px]">
        {/* 返回按钮区 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Skeleton className="h-4 w-20 rounded" />
        </div>

        {/* 顶栏工具按钮 - 一行 ToolBtn */}
        <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-8 rounded-md shrink-0" />
          ))}
        </div>

        {/* 视频播放器 - aspect-video */}
        <div className="px-4 py-2">
          <Skeleton className="aspect-video w-full rounded-xl" />
          {/* 控制栏 */}
          <div className="flex items-center justify-between py-2">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        </div>

        {/* 视频信息 */}
        <div className="px-4 py-2 space-y-2">
          <Skeleton className="h-6 w-3/4 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>

        {/* 聊天输入框 - 底部 */}
        <div className="mt-auto px-4 py-3">
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>

      {/* 拖拽分割线 */}
      <div className="w-1.5 shrink-0 bg-border/50" />

      {/* 右栏 */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 标签栏 - 三个 tab */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-2">
          <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
            <Skeleton className="h-8 w-24 rounded" />
            <Skeleton className="h-8 w-24 rounded" />
            <Skeleton className="h-8 w-24 rounded" />
          </div>
        </div>

        {/* 信息行：版本/徽章/操作按钮 */}
        <div className="flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-[100px] rounded" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <div className="flex items-center gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-8 rounded-md" />
            ))}
          </div>
        </div>

        {/* 状态行 */}
        <div className="flex items-center justify-between px-4 py-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full">
            <Skeleton className="w-3.5 h-3.5 rounded-full" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-accent/30 m-4 p-4">
          <div className="space-y-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full rounded" style={{ width: `${80 + Math.random() * 20}%` }} />
            ))}
          </div>
        </div>
      </div>

      {/* 右侧导航栏 */}
      <Skeleton className="w-16 h-full shrink-0" />
    </div>
  )
}

// 卡片骨架 — 用于 Provider 列表
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 rounded-lg border border-border animate-pulse"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="w-8 h-8 rounded-md" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <Skeleton className="w-6 h-6 rounded" />
        </div>
      ))}
    </>
  )
}