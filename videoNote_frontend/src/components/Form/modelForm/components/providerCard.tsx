import { Switch } from '@/components/ui/switch'
import { FC } from 'react'
import styles from './index.module.css'
import { useNavigate, useParams } from 'react-router-dom'
import AILogo from '@/components/Form/modelForm/Icons'
import { useProviderStore } from '@/store/providerStore'
import { useModelStore } from '@/store/modelStore'
export interface IProviderCardProps {
  id: string
  providerName: string
  Icon: string
  logoUrl?: string
  type?: string
  enable: number
}
const ProviderCard: FC<IProviderCardProps> = ({
  providerName,
  Icon,
  logoUrl,
  type,
  id,
  enable,
}: IProviderCardProps) => {
  const navigate = useNavigate()
  const updateProvider = useProviderStore(state => state.updateProvider)
  const loadEnabledModels = useModelStore(state => state.loadEnabledModels)
  const handleClick = () => {
    navigate(`/settings/model/${id}`)
  }
  const handleEnable = async () => {
    await updateProvider({
      id,
      enabled: enable == 1 ? 0 : 1,
    })
    // 刷新首页模型列表
    loadEnabledModels()
  }
  const { id: currentId } = useParams<{ id: string }>()
  const isActive = currentId === id

  return (
    <div
      onClick={() => {
        handleClick()
      }}
      className={[
        styles.card,
        'group relative flex h-14 cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-foreground transition-all duration-200',
        'border border-transparent hover:border-border/70 hover:bg-muted/45 hover:shadow-sm',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isActive
          ? 'bg-primary/10 font-semibold text-primary shadow-sm ring-1 ring-primary/25 before:absolute before:left-0 before:top-2 before:h-10 before:w-1 before:rounded-r-full before:bg-primary'
          : '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-center gap-3 text-base">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted/70 transition-colors group-hover:bg-background">
          <AILogo name={Icon} logoUrl={logoUrl} type={type} />
        </div>
        <div className="truncate font-semibold">{providerName}</div>
      </div>

      <div className="shrink-0">
        <Switch
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            handleEnable()
          }}
          checked={enable == 1}
        />
      </div>
    </div>
  )
}
export default ProviderCard
