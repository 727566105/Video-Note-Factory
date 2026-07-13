import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, Power, PowerOff, Rss } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useAuthStore } from '@/store/authStore'
import { fetchSummarizedChannels, parseChannelUrl, fetchIntervalOptions, updateFetchInterval, toggleAutoGenerate, FetchIntervalGroups } from '@/services/subscription'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, XiaohongshuLogo } from '@/components/Icons/platform'
import { toast } from 'sonner'
import { useIsMobile } from '@/hooks/use-mobile'

interface SummarizedChannel {
  platform: string
  author: string
  video_url: string
  count: number
  last_summarized: string | null
}

const platformLabel: Record<string, string> = { bilibili: 'B站', youtube: 'YouTube', douyin: '抖音', xiaohongshu: '小红书', kuaishou: '快手' }
const platformIcon: Record<string, React.ReactNode> = {
  bilibili: <BiliBiliLogo className="size-4" />,
  youtube: <YoutubeLogo className="size-4" />,
  douyin: <DouyinLogo className="size-4" />,
  xiaohongshu: <XiaohongshuLogo className="size-4" />,
  kuaishou: <span className="text-xs font-bold">KS</span>,
}

export default function ChannelsPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { subscriptions, fetchSubscriptions, subscribe, unsubscribe, toggleSubscription } = useSubscriptionStore()
  const isAdmin = useAuthStore(state => state.isAdmin())
  const [tab, setTab] = useState<'summarized' | 'subscribed'>('subscribed')
  const [summarized, setSummarized] = useState<SummarizedChannel[]>([])
  const [subscribeUrl, setSubscribeUrl] = useState('')
  const [search, setSearch] = useState('')
  const [subscribing, setSubscribing] = useState(false)
  const [intervalGroups, setIntervalGroups] = useState<FetchIntervalGroups | null>(null)

  useEffect(() => {
    loadSummarized()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchIntervalOptions().then(setIntervalGroups).catch(() => {})
    }
  }, [isAdmin])

  const loadSummarized = async () => {
    try {
      const res = await fetchSummarizedChannels()
      setSummarized(res || [])
    } catch (e) {
      console.error('加载已总结频道失败:', e)
    }
  }

  const handleSubscribe = async () => {
    if (!subscribeUrl.trim()) return
    setSubscribing(true)
    try {
      const info = await parseChannelUrl(subscribeUrl)
      toast.success(`识别到 ${platformLabel[info.platform] || info.platform} 频道：${info.channel_name || '未知'}`)
    } catch (e) {
      console.error('解析频道URL失败:', e)
    }
    const ok = await subscribe(subscribeUrl)
    if (ok) setSubscribeUrl('')
    setSubscribing(false)
  }

  const handleIntervalChange = async (subId: number, interval: number) => {
    try {
      await updateFetchInterval(subId, { fetch_interval: interval })
      toast.success('刷新间隔已更新')
      fetchSubscriptions()
    } catch (e) {
      toast.error('更新失败')
    }
  }

  const filteredSubs = subscriptions.filter(s =>
    !search || (s.channel_name || '').includes(search) || s.platform.includes(search)
  )

  return (
    <div className="flex flex-col h-full">
      {/* 标题 - 仅桌面端显示 */}
      {!isMobile && (
        <div className="px-4 md:px-6 py-4 border-b">
          <h1 className="text-xl font-bold">频道管理</h1>
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'summarized' | 'subscribed')} className="flex flex-col flex-1 min-h-0">
        <div className="px-4 md:px-6 pt-4">
          <TabsList>
            <TabsTrigger value="subscribed">已订阅的频道</TabsTrigger>
            <TabsTrigger value="summarized">已总结过的频道</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="subscribed" className="flex-1 min-h-0 overflow-auto mt-0 px-4 md:px-6 pt-4">
          <div className="flex gap-3 mb-4 flex-wrap">
            <Input placeholder="粘贴频道URL或视频URL" value={subscribeUrl}
              onChange={e => setSubscribeUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
              className="flex-1 min-w-0" />
            <Button onClick={handleSubscribe} disabled={subscribing} size="sm" className="whitespace-nowrap">
              <Plus className="size-4 mr-1" />订阅
            </Button>
            <Input placeholder="搜索..." value={search} onChange={e => setSearch(e.target.value)} className="w-32 md:w-48 md:ml-auto" />
          </div>

          {/* 桌面端表格 */}
          {!isMobile && (
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted">
                <th className="px-4 py-2 text-left font-medium">频道</th>
                <th className="px-4 py-2 text-left font-medium">平台</th>
                <th className="px-4 py-2 text-left font-medium">状态</th>
                {isAdmin && <th className="px-4 py-2 text-left font-medium">刷新间隔</th>}
                <th className="px-4 py-2 text-left font-medium">自动生成</th>
                <th className="px-4 py-2 text-left font-medium">上次检查</th>
                <th className="px-4 py-2 text-right font-medium">操作</th>
              </tr></thead>
              <tbody>
                {filteredSubs.map(sub => (
                  <tr key={sub.id} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        {sub.avatar_url ? <img src={sub.avatar_url} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" /> :
                          <div className="w-8 h-8 rounded-full bg-muted" />}
                        <span className="font-medium cursor-pointer hover:text-primary"
                          onClick={() => navigate(`/channel/${sub.platform}/${sub.platform_id}`)}>
                          {sub.channel_name || '未知'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2"><div className="flex items-center gap-1">{platformIcon[sub.platform]} {platformLabel[sub.platform] || sub.platform}</div></td>
                    <td className="px-4 py-2">{sub.enabled ? '启用' : '禁用'}</td>
                    {isAdmin && (
                      <td className="px-4 py-2">
                        <Select
                          value={sub.fetch_interval.toString()}
                          onValueChange={(val) => handleIntervalChange(sub.id, parseInt(val))}
                        >
                          <SelectTrigger className="w-28 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {intervalGroups && Object.entries(intervalGroups).map(([group, options]) => (
                              <div key={group}>
                                <div className="px-2 py-1 text-xs text-muted-foreground font-medium">{group}</div>
                                {options.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value.toString()}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                    <td className="px-4 py-2">
                      <Switch
                        checked={sub.auto_generate === 1}
                        onCheckedChange={async (checked) => {
                          try {
                            await toggleAutoGenerate(sub.id, checked)
                            toast.success(checked ? '已开启自动生成' : '已关闭自动生成')
                            fetchSubscriptions()
                          } catch {
                            toast.error('设置失败')
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {sub.last_checked_at ? new Date(sub.last_checked_at).toLocaleString() : '未检查'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => toggleSubscription(sub.id)}>
                        {sub.enabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500 ml-1"
                        onClick={() => { if (confirm('确定取消订阅？')) unsubscribe(sub.id) }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredSubs.length === 0 && (
                  <tr><td colSpan={isAdmin ? 7 : 6}>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon"><Rss /></EmptyMedia>
                        <EmptyTitle>暂无订阅</EmptyTitle>
                        <EmptyDescription>订阅频道后将显示在这里</EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  </td></tr>
                )}
              </tbody>
            </table>
          )}

          {/* 移动端卡片视图 */}
          {isMobile && (
            <div className="space-y-3">
              {filteredSubs.map(sub => (
                <div key={sub.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-3">
                    {sub.avatar_url ? (
                      <img src={sub.avatar_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        {platformIcon[sub.platform]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-medium truncate cursor-pointer hover:text-primary"
                        onClick={() => navigate(`/channel/${sub.platform}/${sub.platform_id}`)}
                      >
                        {sub.channel_name || '未知'}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">{platformIcon[sub.platform]} {platformLabel[sub.platform] || sub.platform}</div>
                        <span className={cn("px-1.5 py-0.5 rounded text-xs", sub.enabled ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500")}>
                          {sub.enabled ? '启用' : '禁用'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => toggleSubscription(sub.id)}>
                        {sub.enabled ? <PowerOff className="size-4" /> : <Power className="size-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500"
                        onClick={() => { if (confirm('确定取消订阅？')) unsubscribe(sub.id) }}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="mt-2 pt-2 border-t flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">刷新间隔:</span>
                      <Select
                        value={sub.fetch_interval.toString()}
                        onValueChange={(val) => handleIntervalChange(sub.id, parseInt(val))}
                      >
                        <SelectTrigger className="h-7 w-20 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {intervalGroups && Object.entries(intervalGroups).map(([group, options]) => (
                            <div key={group}>
                              <div className="px-2 py-1 text-xs text-muted-foreground font-medium">{group}</div>
                              {options.map(opt => (
                                <SelectItem key={opt.value} value={opt.value.toString()}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {sub.last_checked_at ? new Date(sub.last_checked_at).toLocaleDateString() : '未检查'}
                      </span>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">自动生成笔记</span>
                    <Switch
                      checked={sub.auto_generate === 1}
                      onCheckedChange={async (checked) => {
                        try {
                          await toggleAutoGenerate(sub.id, checked)
                          toast.success(checked ? '已开启自动生成' : '已关闭自动生成')
                          fetchSubscriptions()
                        } catch {
                          toast.error('设置失败')
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
              {filteredSubs.length === 0 && (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon"><Rss /></EmptyMedia>
                    <EmptyTitle>暂无订阅</EmptyTitle>
                    <EmptyDescription>订阅频道后将显示在这里</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="summarized" className="flex-1 min-h-0 overflow-auto mt-0 px-4 md:px-6 pt-4">
          {/* 桌面端表格 */}
          {!isMobile && (
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted">
                <th className="px-4 py-2 text-left font-medium">频道</th>
                <th className="px-4 py-2 text-left font-medium">平台</th>
                <th className="px-4 py-2 text-center font-medium">总结数</th>
                <th className="px-4 py-2 text-left font-medium">最近总结</th>
                <th className="px-4 py-2 text-right font-medium">操作</th>
              </tr></thead>
              <tbody>
                {(summarized || []).filter((c: SummarizedChannel) => !search || c.author?.includes(search)).map((ch: SummarizedChannel, i: number) => (
                  <tr key={i} className="border-b hover:bg-accent/30">
                    <td className="px-4 py-2 font-medium">{ch.author}</td>
                    <td className="px-4 py-2"><div className="flex items-center gap-1">{platformIcon[ch.platform]} {platformLabel[ch.platform] || ch.platform}</div></td>
                    <td className="px-4 py-2 text-center">{ch.count}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">
                      {ch.last_summarized ? new Date(ch.last_summarized).toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {subscriptions.some(s => s.channel_name === ch.author) ? (
                        <span className="text-green-500 text-xs">已订阅</span>
                      ) : (
                        <Button size="sm" onClick={() => { setSubscribeUrl(ch.video_url || ''); setTab('subscribed') }}>
                          <Plus className="size-4 mr-1" />订阅
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* 移动端卡片视图 */}
          {isMobile && (
            <div className="space-y-3">
              {(summarized || []).filter((c: SummarizedChannel) => !search || c.author?.includes(search)).map((ch: SummarizedChannel, i: number) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {platformIcon[ch.platform]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{ch.author}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center gap-1">{platformIcon[ch.platform]} {platformLabel[ch.platform] || ch.platform}</div>
                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600">{ch.count} 篇</span>
                      </div>
                    </div>
                    <div>
                      {subscriptions.some(s => s.channel_name === ch.author) ? (
                        <span className="text-green-500 text-xs">已订阅</span>
                      ) : (
                        <Button size="sm" onClick={() => { setSubscribeUrl(ch.video_url || ''); setTab('subscribed') }}>
                          <Plus className="size-4 mr-1" />订阅
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                    最近总结: {ch.last_summarized ? new Date(ch.last_summarized).toLocaleDateString() : '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}