import SettingLayout from '@/layouts/SettingLayout.tsx'
import { useProviderStore } from '@/store/providerStore'
import { useEffect } from 'react'

const SettingPage = () => {
  const fetchProviderList = useProviderStore(state => state.fetchProviderList)
  useEffect(() => {
    fetchProviderList()
  }, [])
  return (
    <div className="h-full w-full">
      <SettingLayout />
    </div>
  )
}
export default SettingPage
