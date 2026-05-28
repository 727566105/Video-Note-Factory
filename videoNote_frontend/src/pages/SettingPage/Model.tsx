import Provider from '@/components/Form/modelForm/Provider.tsx'
import { Outlet } from 'react-router-dom'
import { useIsMobile } from '@/hooks/use-mobile'

const Model = () => {
  const isMobile = useIsMobile()

  return (
    <div className="flex h-full w-full bg-background">
      {/* 桌面端：侧边栏 + 内容区 */}
      {!isMobile && (
        <>
          <div className="hidden lg:block w-[375px] shrink-0 border-r border-border p-4">
            <Provider />
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </div>
        </>
      )}

      {/* 移动端：直接显示 Provider 列表 */}
      {isMobile && (
        <div className="flex-1 overflow-auto">
          <Provider />
        </div>
      )}
    </div>
  )
}
export default Model