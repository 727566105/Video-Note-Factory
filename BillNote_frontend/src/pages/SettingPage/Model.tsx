import Provider from '@/components/Form/modelForm/Provider.tsx'
import { Outlet } from 'react-router-dom'

const Model = () => {
  return (
    <div className="flex h-full bg-white">
      <div className="w-64 shrink-0 border-r border-neutral-200 p-4">
        <Provider />
      </div>
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
export default Model
