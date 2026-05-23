import { Skeleton } from '@/components/ui/skeleton'

const HomeSkeleton = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* 侧边栏骨架 */}
      <div className="w-64 shrink-0 border-r border-border bg-sidebar flex flex-col">
        {/* Logo */}
        <div className="p-2">
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="size-8 rounded-lg" />
            <div className="grid flex-1 gap-1">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <Skeleton className="size-7 rounded-md" />
          </div>
        </div>
        {/* 搜索 */}
        <div className="px-2 pb-2">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        {/* 快捷添加 */}
        <div className="px-2 pb-2">
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
        {/* 菜单分组 */}
        <div className="flex-1 overflow-hidden px-2 space-y-4">
          <div className="space-y-1">
            <Skeleton className="h-4 w-10 rounded mx-2" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-4 w-10 rounded mx-2" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </div>
        {/* 底部用户 */}
        <div className="p-2 border-t border-border">
          <div className="flex items-center gap-2 p-2">
            <Skeleton className="size-8 rounded-md" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区 - 居中 QuickAdd */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background">
        <div className="w-full max-w-2xl px-6 space-y-6">
          {/* 标题 */}
          <div className="text-center space-y-2">
            <Skeleton className="h-10 w-48 rounded mx-auto" />
            <Skeleton className="h-4 w-64 rounded mx-auto" />
          </div>
          {/* 标签按钮 */}
          <div className="flex gap-2 justify-center">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
          </div>
          {/* 输入区域 */}
          <Skeleton className="h-32 w-full rounded-lg" />
          {/* 控制栏 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
          {/* 生成按钮 */}
          <Skeleton className="h-10 w-32 rounded-full mx-auto" />
          {/* 底部链接 */}
          <div className="flex justify-center gap-4">
            <Skeleton className="h-4 w-16 rounded" />
            <Skeleton className="h-4 w-16 rounded" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeSkeleton
