import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'

export default function SubscriptionSettings() {
  const isMobile = useIsMobile()
  const [fetchInterval, setFetchInterval] = useState(60)
  const [rsshubUrl, setRsshubUrl] = useState('https://rsshub.app')
  const [limit, setLimit] = useState(20)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    // TODO: 调用后端 API 保存设置
    await new Promise(r => setTimeout(r, 500))
    toast.success('设置已保存')
    setSaving(false)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      {/* 标题 - 仅桌面端显示 */}
      {!isMobile && (
        <h2 className="text-lg font-semibold mb-6">订阅设置</h2>
      )}

      <div className="space-y-4 md:space-y-6">
        <div>
          <label className="text-sm font-medium block mb-2">自动刷新频率</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            value={fetchInterval}
            onChange={e => setFetchInterval(Number(e.target.value))}
          >
            <option value={30}>每 30 分钟</option>
            <option value={60}>每小时</option>
            <option value={360}>每 6 小时</option>
            <option value={0}>仅手动</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">订阅频道自动获取最新内容的频率</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">RSSHub 地址</label>
          <Input
            value={rsshubUrl}
            onChange={e => setRsshubUrl(e.target.value)}
            placeholder="https://rsshub.app"
          />
          <p className="text-xs text-muted-foreground mt-1">默认使用公共 rsshub.app，也可填写自建实例地址</p>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">单次获取数量</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm bg-background"
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
          >
            <option value={20}>20 条</option>
            <option value={50}>50 条</option>
            <option value={100}>100 条</option>
          </select>
          <p className="text-xs text-muted-foreground mt-1">每次刷新时从每个频道获取的最大内容数</p>
        </div>

        <div className="pt-2 md:pt-4">
          <Button size={isMobile ? 'sm' : 'default'} onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>
    </div>
  )
}