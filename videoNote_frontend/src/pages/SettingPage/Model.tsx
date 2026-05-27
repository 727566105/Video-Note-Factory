import Provider from '@/components/Form/modelForm/Provider.tsx'
import { Outlet } from 'react-router-dom'

const Model = () => {
  return (
    <div className="flex h-full w-full bg-background">
      {/* 侧边栏仅桌面端显示 */}
      <div className="hidden lg:block w-[375px] shrink-0 border-r border-border p-4">
        <Provider />
      </div>
      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  )
}
export default Model
