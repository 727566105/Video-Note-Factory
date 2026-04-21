import ProviderCard from '@/components/Form/DownloaderForm/providerCard.tsx'
import { Button } from '@/components/ui/button.tsx'
import { useProviderStore } from '@/store/providerStore'
import { useNavigate } from 'react-router-dom'
import { DouyinLogo, KuaishouLogo } from '@/components/Icons/platform.tsx'
import { videoPlatforms } from '@/constant/note.ts'

const Provider = () => {
  const navigate = useNavigate()
  const handleClick = () => {
    navigate(`/settings/model/new`)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex w-full flex-col gap-2">
        <div className="text-sm font-medium text-gray-800">下载器配置</div>
      </div>
      <div className="mt-6 flex-1">
        {videoPlatforms &&
          videoPlatforms.map((provider, index) => {
            if (provider.value !== 'local')
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
export default Provider
