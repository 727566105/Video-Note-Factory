import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CheckCheck, LayoutGrid, List, Plus, Activity } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo } from '@/components/Icons/platform'
import type { FeedItem } from '@/services/subscription'

const platformIcon: Record<string, React.ReactNode> = {
  bilibili: <BiliBiliLogo className="w-4 h-4" />,
  youtube: <YoutubeLogo className="w-4 h-4" />,
  douyin: <DouyinLogo className="w-4 h-4" />,
}

const formatDuration = (s?: number | null) => {
  if (!s) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

const timeAgo = (iso?: string | null) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

export default function FeedPage() {
  const navigate = useNavigate()
  const { feedItems, loading, fetchFeed, markAllRead, refreshFeed, unreadCount } = useSubscriptionStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => { fetchFeed() }, [fetchFeed])

  const handleGenerate = (item: FeedItem) => {
    if (item.content_type === 'video' && item.content_url) {
      navigate(`/?url=${encodeURIComponent(item.content_url)}`)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-xl font-bold">动态</h1>
          <p className="text-sm text-muted-foreground">你订阅频道的最新内容</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshFeed} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-1" />刷新
          </Button>
          <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="w-4 h-4 mr-1" />全部已读
          </Button>
          <Select value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'list')}>
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid"><span className="flex items-center gap-2"><LayoutGrid className="size-4" />网格</span></SelectItem>
              <SelectItem value="list"><span className="flex items-center gap-2"><List className="size-4" />列表</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading && feedItems.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">加载中...</div>
        ) : feedItems.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Activity /></EmptyMedia>
              <EmptyTitle>还没有动态内容</EmptyTitle>
              <EmptyDescription>订阅频道后将在此显示最新视频</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={() => navigate('/channels')}>
                <Plus className="w-4 h-4 mr-1" />订阅频道
              </Button>
            </EmptyContent>
          </Empty>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {feedItems.map(item => (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  {item.cover_url ? (
                    <img src={item.cover_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      {platformIcon[item.platform]}
                    </div>
                  )}
                  {item.duration ? (
                    <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                      {formatDuration(item.duration)}
                    </span>
                  ) : null}
                  <span className={`absolute top-2 left-2 text-white text-xs px-2 py-0.5 rounded ${
                    item.content_type === 'video' ? 'bg-blue-500' : 'bg-orange-500'
                  }`}>
                    {item.content_type === 'video' ? '视频' : '图文'}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 mb-2">{item.title}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.author}</span>
                    <span>{timeAgo(item.published_at)}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => handleGenerate(item)}>
                    生成笔记
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {feedItems.map(item => (
              <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50">
                <div className="w-24 h-14 bg-muted rounded flex-shrink-0 overflow-hidden relative">
                  {item.cover_url && <img src={item.cover_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                  {item.duration && (
                    <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{item.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {platformIcon[item.platform]}
                    <span>{item.author}</span>
                    <span>{timeAgo(item.published_at)}</span>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleGenerate(item)}>生成笔记</Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}