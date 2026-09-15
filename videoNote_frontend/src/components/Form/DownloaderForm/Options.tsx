import ProviderCard from '@/components/Form/DownloaderForm/providerCard.tsx'
import { useNavigate } from 'react-router-dom'
import { videoPlatforms } from '@/constant/note.ts'
import { useIsMobile } from '@/hooks/use-mobile'

const Provider = () => {
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  return (
    <div className={cn(
      "flex h-full flex-col",
      isMobile ? "p-4" : ""
    )}>
      {/* 标题 - 仅桌面端显示 */}
      {!isMobile && (
        <div>
          <div className="text-sm font-medium text-foreground">下载器配置</div>
        </div>
      )}
      <div className="mt-4 md:mt-6 flex-1">
        {videoPlatforms &&
          videoPlatforms.map((provider, index) => {
            if (provider.value !== 'local' && provider.value !== 'local_audio')
              return (
                <ProviderCard
                  key={index}
                  providerName={provider.label}
                  Icon={provider?.logo}
                  id={provider.value}
                />
              )
          })}
      </div>
    </div>
  )
}

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(' ')
}

export default Provider
