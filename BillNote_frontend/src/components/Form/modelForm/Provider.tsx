import ProviderCard from '@/components/Form/modelForm/components/providerCard.tsx'
import { Button } from '@/components/ui/button.tsx'
import { useProviderStore } from '@/store/providerStore'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

const Provider = () => {
  const providers = useProviderStore(state => state.provider)
  const navigate = useNavigate()
  const handleClick = () => {
    navigate(`/settings/model/new`)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-gray-700">模型供应商</h3>
        <Button
          type="button"
          onClick={handleClick}
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" />
          添加供应商
        </Button>
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="text-xs font-medium text-gray-500">已添加的供应商</div>
        <div className="flex flex-col gap-1">
          {providers && providers.length > 0 ? (
            providers.map((provider, index) => (
              <ProviderCard
                key={index}
                providerName={provider.name}
                Icon={provider.logo}
                id={provider.id}
                enable={provider.enabled}
              />
            ))
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-xs text-gray-500">暂无供应商</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default Provider
