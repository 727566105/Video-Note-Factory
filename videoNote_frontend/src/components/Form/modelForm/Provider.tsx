import ProviderCard from '@/components/Form/modelForm/components/providerCard.tsx'
import { Button } from '@/components/ui/button.tsx'
import { useProviderStore } from '@/store/providerStore'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'

const Provider = () => {
  const providers = useProviderStore(state => state.provider)
  const navigate = useNavigate()
  const handleClick = () => {
    navigate(`/settings/model/new`, { state: { reset: true } })
  }

  // 排序：已启用(enabled=1)排前面，已关闭(enabled=0)排后面
  const sortedProviders = [...providers].sort((a, b) => {
    const aEnabled = a.enabled ?? 0
    const bEnabled = b.enabled ?? 0
    return bEnabled - aEnabled
  })

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">模型供应商</h3>
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
        <div className="text-xs font-medium text-muted-foreground">已添加的供应商</div>
        <div className="flex flex-col gap-1">
          {sortedProviders && sortedProviders.length > 0 ? (
            sortedProviders.map((provider, index) => (
              <ProviderCard
                key={index}
                providerName={provider.name}
                Icon={provider.logo}
                logoUrl={provider.logoUrl}
                type={provider.type}
                id={provider.id}
                enable={provider.enabled}
              />
            ))
          ) : (
            <div className="rounded-lg border-2 border-dashed border-border bg-muted p-4 text-center">
              <p className="text-xs text-muted-foreground">暂无供应商</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default Provider
