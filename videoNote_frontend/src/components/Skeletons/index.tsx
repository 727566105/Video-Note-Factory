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
    <div className="flex h-full w-full overflow-hidden bg-background">
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
              <Skeleton key={i} className="h-4 w-full rounded" style={{ width: `${85 + (i % 3) * 5}%` }} />
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
          className="flex items-center justify-between p-3 rounded-lg border border-border"
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

// 动态页骨架 — Grid 模式
export function FeedSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="space-y-1">
          <Skeleton className="h-6 w-16 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
          <Skeleton className="h-8 w-[120px] rounded-md" />
        </div>
      </div>
      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card">
              {/* 封面 */}
              <Skeleton className="aspect-video rounded-t-lg" />
              {/* 底部信息 */}
              <div className="p-3 space-y-2">
                <Skeleton className="h-5 w-full rounded" />
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-8 w-full rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// 频道详情页骨架
export function ChannelDetailSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* 返回按钮 */}
      <div className="px-6 pt-4">
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      {/* 频道信息卡片 */}
      <div className="mx-6 mb-4 rounded-lg bg-background p-4 shadow-md">
        <div className="flex gap-4">
          {/* Avatar */}
          <Skeleton className="size-20 md:size-48 rounded-full shrink-0" />
          {/* Info */}
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-32 rounded" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-4 w-20 rounded" />
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="size-6 rounded-full" />
              ))}
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </div>
      {/* 搜索栏 */}
      <div className="px-6 py-3 flex gap-3">
        <Skeleton className="h-8 max-w-sm flex-1 rounded-md" />
        <Skeleton className="h-8 w-[120px] rounded-md" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      {/* 视频表格 */}
      <div className="flex-1 overflow-auto px-6">
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border">
              <Skeleton className="w-24 h-14 rounded-md shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-5 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/4 rounded" />
              </div>
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          ))}
        </div>
      </div>
      {/* 分页 */}
      <div className="px-6 py-4 flex justify-center">
        <Skeleton className="h-8 w-[300px] rounded-md" />
      </div>
    </div>
  )
}

// 博主列表页骨架
export function AuthorListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Skeleton className="h-8 w-24 rounded mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-border">
            <Skeleton className="size-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// 博主详情页骨架
export function AuthorDetailSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-24 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      {/* Video list */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-lg border border-border">
            <Skeleton className="w-24 h-16 rounded-md shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-5 w-3/4 rounded" />
              <div className="flex items-center gap-2">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

// 设置页骨架
export function SettingSkeleton() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Skeleton className="h-8 w-24 rounded" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between p-4 rounded-lg border border-border">
            <div className="space-y-1">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}