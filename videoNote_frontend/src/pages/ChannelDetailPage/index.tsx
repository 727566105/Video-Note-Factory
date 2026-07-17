import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ExternalLink, LoaderCircle, UserPlus, UserCheck, Download, Search, Eye, FileText, ChevronDown, LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { fetchChannelVideos, refreshSubscription, fetchRefreshProgress, quickViewNote, checkNoteAvailability, fetchChannelSubscribers, getFetchStatus, fetchMoreVideos, markChannelVideoSeen } from '@/services/subscription'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, XiaohongshuLogo, KuaishouLogo, CCTVLogo } from '@/components/Icons/platform'
import type { FeedItem, FetchStatus } from '@/services/subscription'
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from '@/components/ui/avatar'
import { useModelStore } from '@/store/modelStore'
import { useTaskStore } from '@/store/taskStore'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { generateNote } from '@/services/note'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import { toast } from 'sonner'
import { usePlatformFeatures } from '@/hooks/usePlatformFeatures'
import { useIsMobile } from '@/hooks/use-mobile'

const platformLabel: Record<string, string> = { bilibili: 'B站', youtube: 'YouTube', douyin: '抖音', xiaohongshu: '小红书', kuaishou: '快手', cctv: '央视网' }
const platformIcon: Record<string, React.ReactNode> = {
  bilibili: <BiliBiliLogo className="size-5" />,
  youtube: <YoutubeLogo className="size-5" />,
  douyin: <DouyinLogo className="size-5" />,
  xiaohongshu: <XiaohongshuLogo className="size-5" />,
  kuaishou: <KuaishouLogo className="size-5" />,
  cctv: <CCTVLogo className="size-5" />,
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
  if (diff < 0) return '刚刚' // 未来时间或时钟偏移
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

const PAGE_SIZE = 20

export default function ChannelDetailPage() {
  const { platform, id } = useParams<{ platform: string; id: string }>()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { subscriptions, subscribe, unsubscribe, fetchSubscriptions } = useSubscriptionStore()
  const [videos, setVideos] = useState<FeedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'summarized' | 'unsummarized' | 'fresh'>('all')
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  // 轮询安全：最大轮询次数（5 分钟 / 2 秒 = 150 次）
  const pollCountRef = useRef(0)
  const MAX_POLL_COUNT = 150

  // 新增：刷新后新增的条目 ID
  const [newItemIds, setNewItemIds] = useState<Set<string>>(new Set())

  // 视图模式
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

  // 快速预览笔记
  const [previewNote, setPreviewNote] = useState<{ markdown: string; title: string | null } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  // 订阅者列表
  const [subscribers, setSubscribers] = useState<{ user_id: number; username: string }[]>([])
  const [subscribersTotal, setSubscribersTotal] = useState(0)

  // 异步获取进度状态
  const [fetching, setFetching] = useState(false)
  const [progressText, setProgressText] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 分批获取状态（加载更多）
  const [fetchStatus, setFetchStatus] = useState<FetchStatus | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const { modelList, loadEnabledModels } = useModelStore()
  const { addPendingTask } = useTaskStore()
  const { style, outputLanguage, videoUnderstanding, videoInterval, gridCols, gridRows, selectedFormats, extras } = useSummarySettingsStore()

  const sub = subscriptions.find(s => s.platform === platform && s.platform_id === id)
  const features = usePlatformFeatures(platform || 'bilibili')

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // 分页越界保护：total 减少时自动回到最后一页
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => {
    loadEnabledModels()
    return () => stopPolling()
  }, [])

  useEffect(() => {
    if (platform && id) loadVideos()
  }, [platform, id, page])

  useEffect(() => {
    if (platform && id) {
      fetchChannelSubscribers(platform, id).then(res => {
        setSubscribers(res?.subscribers || [])
        setSubscribersTotal(res?.total || 0)
      }).catch((e) => console.error('获取订阅者列表失败:', e))
    }
  }, [platform, id])

  // 加载分批获取状态
  useEffect(() => {
    if (platform && id) {
      getFetchStatus(platform, id).then(res => {
        setFetchStatus(res || null)
      }).catch((e) => console.error('获取分批状态失败:', e))
    }
  }, [platform, id])

  const loadVideos = async () => {
    if (!platform || !id) return
    setLoading(true)
    try {
      const offset = (page - 1) * PAGE_SIZE
      const res = await fetchChannelVideos(platform, id, PAGE_SIZE, offset)
      setVideos(res?.items || [])
      setTotal(res?.total || 0)
    } catch (e) {
      console.error('加载频道视频失败:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleFetch = async () => {
    if (!sub) return
    setFetching(true)
    setProgressText('正在启动获取...')
    stopPolling()

    try {
      const res = await refreshSubscription(sub.id) as any
      const progressId = res?.progress_id
      if (!progressId) {
        setFetching(false)
        toast.error('启动获取失败')
        return
      }

      // 开始轮询进度
      pollCountRef.current = 0
      pollingRef.current = setInterval(async () => {
        pollCountRef.current += 1
        // 超时熔断：超过 MAX_POLL_COUNT 次自动停止
        if (pollCountRef.current > MAX_POLL_COUNT) {
          stopPolling()
          setFetching(false)
          toast.error('获取超时，请稍后重试')
          return
        }
        try {
          const p = await fetchRefreshProgress(progressId) as any
          if (!p) {
            // 连续多次 null 也熔断
            if (pollCountRef.current > 10) {
              stopPolling()
              setFetching(false)
              toast.error('无法获取进度，请稍后重试')
            }
            return
          }

          if (p.status === 'running') {
            const page = p.current_page || 0
            const count = p.fetched_count || 0
            setProgressText(page > 0 ? `正在获取第 ${page} 页，已获取 ${count} 条...` : '正在获取...')
          } else if (p.status === 'completed') {
            stopPolling()
            setFetching(false)
            const added = p.added_count || 0
            const totalCount = p.total_count || 0
            setPage(1)
            // 先加载视频，然后找出新增的条目
            const offset = 0
            const videoRes = await fetchChannelVideos(platform!, id!, PAGE_SIZE, offset)
            const newVideos = videoRes?.items || []
            setVideos(newVideos)
            setTotal(videoRes?.total || 0)
            if (added > 0) {
              // 记录新增条目 ID（按时间排序，最新的 added 个，排除已查看的）
              const sortedByTime = [...newVideos].sort((a, b) =>
                new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
              )
              const addedIds = new Set(
                sortedByTime.slice(0, added)
                  .filter(v => !v.is_seen)
                  .map(v => String(v.id))
              )
              setNewItemIds(addedIds)
              const channelName = sub?.channel_name || '博主'
              toast.custom((t) => (
                <div
                  onClick={() => { toast.dismiss(t); setFilter('fresh'); }}
                  className="animate-bounce-in cursor-pointer flex items-center gap-3 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg hover:bg-green-700 transition-colors max-w-sm"
                >
                  <span className="text-2xl">🎉</span>
                  <div className="flex-1">
                    <div className="font-semibold">博主【{channelName}】更新了 {added} 条新内容</div>
                    <div className="text-xs text-green-100">点击查看最新作品</div>
                  </div>
                </div>
              ), { duration: 8000 })
            } else {
              toast.success('刷新完成，暂无新内容')
            }
          } else if (p.status === 'failed') {
            stopPolling()
            setFetching(false)
            const errMsg = p.error || '未知错误'
            const isCookieError = typeof errMsg === 'string' && errMsg.includes('Cookie')
            if (isCookieError) {
              toast.error('Cookie 已失效，请在「设置 → 基础数据设置」重新配置对应平台 Cookie', { duration: 8000 })
            } else {
              toast.error(`获取失败: ${errMsg}`)
            }
            loadVideos()
          }
        } catch {
          stopPolling()
          setFetching(false)
          toast.error('查询进度失败')
        }
      }, 2000)

    } catch {
      setFetching(false)
      toast.error('启动获取失败')
    }
  }

  // 加载更多（分批获取）
  const handleLoadMore = async () => {
    if (!platform || !id) return
    setLoadingMore(true)
    try {
      const res = await fetchMoreVideos(platform, id)
      if (res?.queued) {
        toast.success(res.message || '加载更多任务已提交')
        // 刷新分批状态
        const statusRes = await getFetchStatus(platform, id)
        setFetchStatus(statusRes || null)
        // 刷新视频列表
        loadVideos()
      } else if (res?.complete) {
        toast.success('所有视频已加载完成')
        setFetchStatus({ ...fetchStatus!, has_more: false, status: 'complete' })
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || '加载更多失败')
    } finally {
      setLoadingMore(false)
    }
  }

  // 标记视频已查看并移除高亮
  const handleMarkSeen = async (item: FeedItem) => {
    if (!item.channel_video_id) return
    try {
      await markChannelVideoSeen(item.channel_video_id)
      setNewItemIds(prev => {
        const next = new Set(prev)
        next.delete(String(item.id))
        return next
      })
    } catch {
      // 忽略错误，不影响用户体验
    }
  }

  const handleGenerate = async (item: FeedItem) => {
    if (!item.content_url) {
      toast.error('无法获取视频链接')
      return
    }

    // 标记已查看，移除高亮
    handleMarkSeen(item)

    if (modelList.length === 0) {
      toast.error('请先在设置中添加模型')
      navigate('/settings/model')
      return
    }

    // 检查是否有现成笔记
    if (item.note_available && item.available_task_id) {
      setPreviewLoading(true)
      try {
        const noteData = await quickViewNote(item.available_task_id)
        setPreviewNote({ markdown: noteData?.markdown || '', title: noteData?.title || item.title })
      } catch {
        // 快速查看失败，继续正常生成
      } finally {
        setPreviewLoading(false)
      }
      return // 先显示预览弹窗，用户可以选择是否克隆
    }

    const selectedModel = modelList[0]
    setGeneratingId(item.id)
    try {
      const payload = {
        video_url: item.content_url,
        platform: platform || 'bilibili',
        quality: 'medium',
        model_name: selectedModel.model_name,
        provider_id: String(selectedModel.provider_id),
        style: style || 'minimal',
        format: selectedFormats || [],
        extras: extras || '',
        video_understanding: videoUnderstanding || false,
        video_interval: videoInterval || 4,
        grid_size: [gridCols || 3, gridRows || 3],
        screenshot: selectedFormats?.includes('screenshot') || false,
        link: selectedFormats?.includes('link') || false,
        output_language: outputLanguage || 'zh',
      }

      const response = await generateNote(payload)

      if (response && response.task_id) {
        addPendingTask(response.task_id, platform || 'bilibili', payload)
        toast.success('笔记生成任务已提交！')
        loadVideos()
      }
    } catch {
      // request.ts 拦截器已显示错误 toast
    } finally {
      setGeneratingId(null)
    }
  }

  const handleQuickView = async (item: FeedItem) => {
    if (!item.available_task_id) return
    setPreviewLoading(true)
    try {
      const noteData = await quickViewNote(item.available_task_id)
      setPreviewNote({ markdown: noteData?.markdown || '', title: noteData?.title || item.title })
    } catch {
      toast.error('加载笔记失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleCloneNote = async (item: FeedItem) => {
    if (!item.content_url) {
      toast.error('无法获取视频链接')
      return
    }
    // 直接调用生成接口，后端会自动检测并复用
    setGeneratingId(item.id)
    try {
      const payload = {
        video_url: item.content_url,
        platform: platform || 'bilibili',
        quality: 'medium',
        model_name: modelList[0]?.model_name || '',
        provider_id: String(modelList[0]?.provider_id || ''),
        style: style || 'minimal',
      }
      const response = await generateNote(payload)
      if (response && response.task_id) {
        addPendingTask(response.task_id, platform || 'bilibili', payload)
        toast.success('笔记已保存到我的笔记！')
        setPreviewNote(null)
        loadVideos()
      }
    } catch {
      toast.error('保存笔记失败')
    } finally {
      setGeneratingId(null)
    }
  }

  const filtered = videos.filter(v => {
    if (search && !v.title?.includes(search)) return false
    if (filter === 'fresh') return newItemIds.has(String(v.id))
    if (filter === 'summarized') return !!v.task_id
    if (filter === 'unsummarized') return !v.task_id
    return true
  })

  // 切换筛选时清除"新内容"高亮
  const handleFilterChange = (newFilter: 'all' | 'summarized' | 'unsummarized' | 'fresh') => {
    setFilter(newFilter)
    if (newFilter !== 'fresh') {
      setNewItemIds(new Set())
    }
  }

  // 判断是否为空数据状态（已加载完毕，无内容，无正在获取）
  const isEmpty = !loading && total === 0 && !fetching

  return (
    <div className="flex flex-col h-full">
      {/* 桌面端返回按钮 */}
      {!isMobile && (
        <div className="shrink-0 px-6 pt-4">
          <button onClick={() => navigate('/channels')} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </button>
        </div>
      )}

      {/* 频道信息卡片 */}
      <div className="shrink-0 mx-4 md:mx-6 mb-4 flex flex-col rounded-lg bg-background p-4 shadow-md md:flex-row">
        <div className="mb-4 flex w-full flex-row items-center gap-4">
          {sub?.avatar_url ? (
            <img src={sub.avatar_url} alt="" referrerPolicy="no-referrer" className="mb-auto size-16 rounded-full md:size-48" />
          ) : (
            <div className="mb-auto size-16 rounded-full bg-muted flex items-center justify-center md:size-48">
              {platformIcon[platform || '']}
            </div>
          )}
          <div className="flex h-full flex-col justify-between">
            <h2 className="mb-2 text-lg font-bold md:text-3xl">{sub?.channel_name || '频道详情'}</h2>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground mb-3 md:mb-4">
              <div className="flex items-center gap-2">
                {platformIcon[platform || '']} {platformLabel[platform || '']}
                {sub?.unique_id && (
                  <span className="font-medium text-foreground">抖音号：{sub.unique_id}</span>
                )}
              </div>
              {sub?.channel_url && (
                <a href={sub.channel_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary inline-flex items-center gap-1">
                  <ExternalLink className="size-3" />{sub.channel_url}
                </a>
              )}
            </div>
            {features.subscribersDisplay && subscribersTotal > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <AvatarGroup>
                  {subscribers.slice(0, 4).map(s => (
                    <Avatar key={s.user_id}>
                      <AvatarFallback>{s.username.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {subscribersTotal > 4 && <AvatarGroupCount>{subscribersTotal - 4}</AvatarGroupCount>}
                </AvatarGroup>
                <span className="text-xs text-muted-foreground">{subscribersTotal} 人订阅</span>
              </div>
            )}
            <div className="flex w-full flex-row items-center gap-2">
              <Button className="flex-1" onClick={handleFetch} disabled={!sub || fetching}>
                {fetching ? (
                  <><LoaderCircle className="size-4 mr-1 animate-spin" />{progressText || '获取中...'}</>
                ) : total > 0 ? (
                  <><RefreshCw className="size-4 mr-1" />刷新</>
                ) : (
                  <><Download className="size-4 mr-1" />获取内容</>
                )}
              </Button>
              <Button
                variant={sub ? "outline" : "secondary"}
                className={`flex-1 ${!sub ? 'hover:text-pink-400' : ''}`}
                onClick={() => sub ? unsubscribe(sub.id) : subscribe(
                  // 未订阅时用 platform+id 构造频道 URL
                  platform === 'bilibili' ? `https://space.bilibili.com/${id}` :
                  platform === 'youtube' ? `https://www.youtube.com/channel/${id}` :
                  platform === 'douyin' ? `https://www.douyin.com/user/${id}` :
                  platform === 'xiaohongshu' ? `https://www.xiaohongshu.com/user/profile/${id}` :
                  platform === 'kuaishou' ? `https://www.kuaishou.com/profile/${id}` : id
                )}
                disabled={fetching}
              >
                {sub ? <><UserCheck className="size-3" />已订阅</> : <><UserPlus className="size-3" />订阅更新</>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 搜索和筛选栏 */}
      <div className="shrink-0 px-4 md:px-6 py-3 flex gap-3 items-center flex-wrap">
        <Input placeholder="搜索标题..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 md:flex-none md:max-w-sm" />
        <select className="rounded-md border px-2 md:px-3 py-1.5 md:py-2 text-sm bg-background" value={filter} onChange={e => handleFilterChange(e.target.value as any)}>
          <option value="all">全部</option>
          {newItemIds.size > 0 && (
            <option value="fresh">新 ({newItemIds.size})</option>
          )}
          <option value="summarized">已总结</option>
          <option value="unsummarized">未总结</option>
        </select>
        {/* 数量统计 - 桌面端显示 */}
        <span className="text-sm text-muted-foreground hidden md:inline">共 {total} 条</span>
        {/* 视图切换 - 桌面端显示 */}
        <div className="hidden md:flex items-center gap-1">
          <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('grid')}>
            <LayoutGrid className="size-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="icon" onClick={() => setViewMode('list')}>
            <List className="size-4" />
          </Button>
        </div>
        {/* 分批获取状态提示 + 加载更多按钮 */}
        {features.batchFetch && fetchStatus && fetchStatus.total > 0 && (
          <div className="flex items-center gap-2 md:ml-auto">
            <span className="text-sm text-muted-foreground">
              {isMobile ? `${fetchStatus.fetched}/${fetchStatus.total}` : `已获取 ${fetchStatus.fetched}/${fetchStatus.total} 个视频`}
            </span>
            {fetchStatus.has_more && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore || fetching}
              >
                {loadingMore ? (
                  <><LoaderCircle className="size-3.5 mr-1 animate-spin" />加载中...</>
                ) : (
                  <>{isMobile ? '更多' : '加载更多'}</>
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto px-4 md:px-6">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">加载中...</div>
        ) : fetching ? (
          <div className="text-center py-20">
            <LoaderCircle className="size-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">{progressText || '正在获取订阅内容...'}</p>
          </div>
        ) : isEmpty ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">暂未获取内容</p>
            <Button onClick={handleFetch} disabled={!sub}>
              <Download className="size-4 mr-1" />获取内容
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Search /></EmptyMedia>
              <EmptyTitle>暂无匹配内容</EmptyTitle>
              <EmptyDescription>尝试调整筛选条件</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : viewMode === 'grid' ? (
          <div className={`grid gap-4 p-2 ${
            features.portraitVideo
              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
          }`}>
            {filtered.map(item => (
              <div key={item.id} className={`rounded-lg overflow-hidden border bg-card hover:shadow-md transition-shadow group ${
                newItemIds.has(String(item.id)) ? 'ring-2 ring-amber-400 bg-amber-50' : ''
              }`}>
                <div className={`relative bg-muted ${features.portraitVideo ? 'aspect-[9/16]' : 'aspect-video'} cursor-pointer`} onClick={() => handleMarkSeen(item)}>
                  {item.cover_url && <img src={item.cover_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                  {features.videoDuration && item.duration && (
                    <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white px-1.5 py-0.5 rounded text-[10px]">
                      {formatDuration(item.duration)}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="text-sm font-medium line-clamp-2 min-h-[2.5rem] cursor-pointer" onClick={() => handleMarkSeen(item)}>{item.title}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{timeAgo(item.published_at)}</span>
                    {item.task_id ? (
                      <span className="text-green-500 text-xs">已有笔记</span>
                    ) : item.note_available ? (
                      <span className="inline-flex items-center gap-0.5 text-green-500 text-xs cursor-pointer hover:underline" onClick={() => handleQuickView(item)}>
                        <FileText className="size-3" />可复用
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">暂无</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    {item.task_id && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => navigate(`/note/${item.task_id}`)}>
                        <Eye className="size-3.5" />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex-1"
                      onClick={() => handleGenerate(item)}
                      disabled={!!generatingId}>
                      {generatingId === item.id && <LoaderCircle className="size-3 animate-spin mr-1" />}
                      {generatingId === item.id ? '生成中...' : item.task_id ? '重新生成' : '生成笔记'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted">
              <th className="px-4 py-2 text-left font-medium w-28">封面</th>
              <th className="px-4 py-2 text-left font-medium">标题</th>
              <th className="px-4 py-2 text-center font-medium w-20">笔记</th>
              <th className="px-4 py-2 text-left font-medium w-20">发布</th>
              <th className="px-4 py-2 text-right font-medium w-24">操作</th>
            </tr></thead>
            <tbody>
              {filtered.map(item => (
                <tr key={item.id} className={`border-b hover:bg-accent/30 ${
                  newItemIds.has(String(item.id)) ? 'bg-amber-50 ring-1 ring-amber-300' : ''
                }`}>
                  <td className="px-4 py-2">
                    <div className="w-24 h-14 bg-muted rounded overflow-hidden relative cursor-pointer" onClick={() => handleMarkSeen(item)}>
                      {item.cover_url && <img src={item.cover_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                      {features.videoDuration && item.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                          {formatDuration(item.duration)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium cursor-pointer" onClick={() => handleMarkSeen(item)}>{item.title}</span>
                    <div className="text-xs text-muted-foreground mt-1">{item.author}</div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {item.task_id ? (
                      <span className="text-green-500 text-xs">已有笔记</span>
                    ) : item.note_available ? (
                      <span className="inline-flex items-center gap-1 text-green-500 text-xs cursor-pointer hover:underline" onClick={() => handleQuickView(item)}>
                        <FileText className="size-3" />可复用
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">暂无</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{timeAgo(item.published_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.task_id && (
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/note/${item.task_id}`)}>
                          <Eye className="size-4" />
                        </Button>
                      )}
                      {item.note_available && !item.task_id && (
                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => handleQuickView(item)}>
                          <Eye className="size-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="outline"
                        onClick={() => handleGenerate(item)}
                        disabled={generatingId === item.id}>
                        {generatingId === item.id && <LoaderCircle className="size-4 animate-spin mr-1" />}
                        {generatingId === item.id ? '生成中...' : item.task_id ? '重新生成' : '生成笔记'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页器 */}
      {totalPages > 1 && (
        <div className="px-4 md:px-6 py-4 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (page <= 3) {
                  pageNum = i + 1
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = page - 2 + i
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      onClick={() => setPage(pageNum)}
                      isActive={page === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* 笔记预览弹窗 */}
      {previewNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewNote(null)}>
          <div className="bg-background rounded-lg shadow-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="font-bold">{previewNote.title || '笔记预览'}</h3>
              <button className="text-muted-foreground hover:text-foreground" onClick={() => setPreviewNote(null)}>✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <MarkdownRenderer content={previewNote.markdown} />
            </div>
            <div className="px-4 py-3 border-t flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreviewNote(null)}>关闭</Button>
              <Button onClick={() => {
                const item = videos.find(v => v.available_task_id && previewNote)
                if (item) handleCloneNote(item)
              }}>保存到我的笔记</Button>
            </div>
          </div>
        </div>
      )}

      {/* 加载中遮罩 */}
      {previewLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <LoaderCircle className="size-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}
