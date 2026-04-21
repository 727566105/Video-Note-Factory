import Provider from '@/components/Form/modelForm/Provider.tsx'
import { Outlet } from 'react-router-dom'
import Options from '@/components/Form/DownloaderForm/Options.tsx'
const Downloader = () => {
  return (
    <div className={'flex h-full bg-white'}>
      <div className={'w-[375px] border-r border-neutral-200 p-2'}>
        <Options></Options>
      </div>
      <div className={'flex-4/5'}>
        <Outlet />
      </div>
    </div>
  )
}
export default Downloader
