import Provider from '@/components/Form/modelForm/Provider.tsx'
import { Outlet } from 'react-router-dom'
import Options from '@/components/Form/DownloaderForm/Options.tsx'
const Downloader = () => {
  return (
    <div className={'flex h-full bg-background'}>
      {/* 侧边栏仅桌面端显示 */}
      <div className={'hidden lg:block w-[375px] border-r border-border p-2'}>
        <Options></Options>
      </div>
      {/* 内容区 */}
      <div className={'flex-1 overflow-auto p-4 md:p-6'}>
        <Outlet />
      </div>
    </div>
  )
}
export default Downloader
