import Provider from '@/components/Form/modelForm/Provider.tsx'
import { Outlet, useLocation } from 'react-router-dom'

const Model = () => {
  const location = useLocation()
  const isEditing = location.pathname.includes('/settings/model/') && location.pathname !== '/settings/model/new'
  const isCreating = location.pathname === '/settings/model/new'

  return (
    <div className="flex h-full w-full bg-white flex-col md:flex-row">
      <div className={`w-full shrink-0 border-r border-neutral-200 p-4 md:w-[375px] ${
        isEditing || isCreating ? 'hidden md:block' : 'block'
      }`}>
        <Provider />
      </div>
      <div className={`flex-1 overflow-auto ${
        isEditing || isCreating ? 'block' : 'hidden md:block'
      }`}>
        <Outlet />
      </div>
    </div>
  )
}
export default Model