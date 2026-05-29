import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, CheckCheck, LayoutGrid, List, Plus, Activity, Loader2, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import { useTaskStore } from '@/store/taskStore'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { generateNote } from '@/services/note'
import { toast } from 'sonner'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, XiaohongshuLogo } from '@/components/Icons/platform'
import type { FeedItem } from '@/services/subscription'
import { useIsMobile } from '@/hooks/use-mobile'

const platformIcon: Record<string, React.ReactNode> = {
  bilibili: <BiliBiliLogo className="size-4" />,
  youtube: <YoutubeLogo className="size-4" />,
  douyin: <DouyinLogo className="size-4" />,
  xiaohongshu: <XiaohongshuLogo className="size-4" />,
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

type ViewMode = 'grid' | 'list'

export default function FeedPage() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { feedItems, loading, fetchFeed, markAllRead, unreadCount } = useSubscriptionStore()
  const addPendingTask = useTaskStore(state => state.addPendingTask)
  const { style, selectedFormats, outputLanguage } = useSummarySettingsStore()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [generatingIds, setGeneratingIds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchFeed(20, 0, undefined, sortOrder) }, [fetchFeed, sortOrder])

  const handleRefresh = useCallback(async () => {
    await fetchFeed(20, 0, undefined, sortOrder)
  }, [fetchFeed, sortOrder])

  const handleGenerate = useCallback(async (item: FeedItem) => {
    if (item.content_type !== 'video' || !item.content_url) return
    setGeneratingIds(prev => new Set(prev).add(String(item.id)))
    try {
      const payload = {
        video_url: item.content_url,
        platform: item.platform,
        quality: 'medium',
        smart_mode: true,
        model_name: '',
        provider_id: '',
        style: style || 'minimal',
        format: selectedFormats || [],
        output_language: outputLanguage || 'zh',
      }
      const res = await generateNote(payload)
      if (res?.task_id) {
        addPendingTask(res.task_id, item.platform, payload)
        toast.success('生成任务已提交')
      }
    } catch {
      toast.error('提交失败')
    } finally {
      setGeneratingIds(prev => { const next = new Set(prev); next.delete(String(item.id)); return next })
    }
  }, [style, selectedFormats, outputLanguage, addPendingTask])

  const handleViewNote = useCallback((item: FeedItem) => {
    const taskId = item.task_id || item.available_task_id
    if (taskId) navigate(`/notes/${taskId}`)
  }, [navigate])

  const renderButton = (item: FeedItem) => {
    const isGenerating = generatingIds.has(item.id)
    const hasNote = item.task_id || item.note_available
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isGenerating}
        onClick={() => hasNote ? handleViewNote(item) : handleGenerate(item)}
      >
        {isGenerating ? (
          <><Loader2 className="size-4 animate-spin" />生成中...</>
        ) : hasNote ? '查看笔记' : '生成笔记'}
      </Button>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b">
        {/* 标题 - 仅桌面端显示 */}
        {!isMobile && (
          <div>
            <h1 className="text-lg md:text-xl font-bold">动态</h1>
            <p className="text-sm text-muted-foreground hidden md:block">你订阅频道的最新内容</p>
          </div>
        )}
        {/* 移动端显示未读数量 */}
        {isMobile && unreadCount > 0 && (
          <span className="text-sm text-muted-foreground">{unreadCount} 条未读</span>
        )}
        <div className="flex items-center gap-2">
          {/* 刷新按钮 - 所有尺寸 */}
          <Button variant="outline" size="icon" className="h-8 w-8 md:hidden" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="sm" className="hidden md:flex" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            <span className="ml-1">刷新</span>
          </Button>

          {/* 桌面端：全部已读 + 排序 + 视图切换 */}
          <div className="hidden md:flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
              <CheckCheck className="size-4 mr-1" />全部已读
            </Button>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'desc' | 'asc')}>
              <SelectTrigger className="w-[80px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">最新</SelectItem>
                <SelectItem value="asc">最早</SelectItem>
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid"><span className="flex items-center gap-2"><LayoutGrid className="size-4" />网格</span></SelectItem>
                <SelectItem value="list"><span className="flex items-center gap-2"><List className="size-4" />列表</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 移动端：排序 + 视图切换 */}
          <div className="md:hidden flex items-center gap-2">
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'desc' | 'asc')}>
              <SelectTrigger className="w-[60px] h-8 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">最新</SelectItem>
                <SelectItem value="asc">最早</SelectItem>
              </SelectContent>
            </Select>
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <SelectTrigger className="w-[40px] h-8 px-2">
                {viewMode === 'grid' ? <LayoutGrid className="size-4" /> : <List className="size-4" />}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="grid"><LayoutGrid className="size-4" /></SelectItem>
                <SelectItem value="list"><List className="size-4" /></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6">
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
                <Plus className="size-4 mr-1" />订阅频道
              </Button>
            </EmptyContent>
          </Empty>
        ) : viewMode === 'grid' ? (
          /* 网格 */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {feedItems.map(item => (
              <div key={item.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
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
                <div className="p-3 flex flex-col flex-1">
                  <h3 className="font-medium text-sm line-clamp-2 mb-2">{item.title}</h3>
                  <div className="flex justify-between text-xs text-muted-foreground mb-3">
                    <span>{item.author}</span>
                    <span>{timeAgo(item.published_at)}</span>
                  </div>
                  <div className="mt-auto w-full">
                    {renderButton(item)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 列表 */
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
                {renderButton(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
