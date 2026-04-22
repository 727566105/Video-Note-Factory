import { Skeleton } from '@/components/ui/skeleton'
import logo from '@/assets/logo.png'

const HomeSkeleton = () => {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 顶部导航栏骨架 */}
      <header className="flex h-12 items-center justify-between border-b border-neutral-200 bg-white px-3 md:h-14 md:px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg md:h-8 md:w-8">
            <img src={logo} alt="logo" className="h-full w-full object-contain" />
          </div>
          <Skeleton className="h-5 w-24 md:h-6 md:w-28" />
        </div>
        <Skeleton className="h-4 w-4 md:h-5 md:w-5 rounded-full" />
      </header>

      {/* 三栏布局骨架 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板 - 笔记表单骨架 */}
        <div className="shrink-0 flex flex-col border-r border-neutral-200 bg-white w-full md:w-80 lg:w-96">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-3 md:p-4 space-y-4">
              {/* 按钮骨架 */}
              <Skeleton className="h-9 w-full" />

              {/* 视频链接区域 */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-32" />
                  <Skeleton className="h-9 flex-1" />
                </div>
              </div>

              {/* 模型选择区域 */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </div>

              {/* 视频理解区域 */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-6 w-16" />
              </div>

              {/* 笔记格式区域 */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>

              {/* 备注区域 */}
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-20 w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* 中间面板 - 历史记录骨架 */}
        <div className="shrink-0 flex flex-col border-r border-neutral-200 bg-white w-full md:w-64 lg:w-80">
          <div className="flex-1 min-h-0 overflow-hidden px-2.5 pt-2.5">
            {/* 筛选栏骨架 */}
            <div className="mb-2 flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-[100px]" />
            </div>
            {/* 搜索框骨架 */}
            <Skeleton className="mb-2 h-8 w-full" />

            {/* 任务卡片骨架 */}
            <div className="flex flex-col gap-2 pb-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex cursor-pointer flex-col rounded-md border border-neutral-200 p-3">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-12 rounded-md" />
                    <Skeleton className="h-4 flex-1 max-w-[180px]" />
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Skeleton className="h-5 w-10 rounded" />
                    <Skeleton className="h-5 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧面板 - 预览骨架 */}
        <div className="flex flex-1 flex-col bg-white">
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
            <div className="w-[300px] flex-col justify-items-center">
              <Skeleton className="mb-4 h-16 w-16 rounded-full mx-auto" />
              <Skeleton className="mb-2 h-4 w-[200px] mx-auto" />
              <Skeleton className="h-3 w-[160px] mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomeSkeleton