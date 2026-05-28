import { Outlet } from 'react-router-dom'
import Options from '@/components/Form/DownloaderForm/Options.tsx'
import { useIsMobile } from '@/hooks/use-mobile'

const Downloader = () => {
  const isMobile = useIsMobile()

  return (
    <div className="flex h-full bg-background">
      {/* 桌面端：侧边栏 + 内容区 */}
      {!isMobile && (
        <>
          <div className="hidden lg:block w-[375px] border-r border-border p-2">
            <Options />
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </div>
        </>
      )}

      {/* 移动端：直接显示 Options 列表 */}
      {isMobile && (
        <div className="flex-1 overflow-auto">
          <Options />
        </div>
      )}
    </div>
  )
}
export default Downloader