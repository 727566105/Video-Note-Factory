import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ExternalLink, LoaderCircle, UserPlus, UserCheck, Download, Search } from 'lucide-react'
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
import { fetchChannelVideos, refreshSubscription, fetchRefreshProgress } from '@/services/subscription'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo } from '@/components/Icons/platform'
import type { FeedItem } from '@/services/subscription'
import { useModelStore } from '@/store/modelStore'
import { useTaskStore } from '@/store/taskStore'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { generateNote } from '@/services/note'
import toast from 'react-hot-toast'

const platformLabel: Record<string, string> = { bilibili: 'B站', youtube: 'YouTube', douyin: '抖音' }
const platformIcon: Record<string, React.ReactNode> = {
  bilibili: <BiliBiliLogo className="w-5 h-5" />,
  youtube: <YoutubeLogo className="w-5 h-5" />,
  douyin: <DouyinLogo className="w-5 h-5" />,
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

const PAGE_SIZE = 20

export default function ChannelDetailPage() {
  const { platform, id } = useParams<{ platform: string; id: string }>()
  const navigate = useNavigate()
  const { subscriptions, subscribe, unsubscribe, fetchSubscriptions } = useSubscriptionStore()
  const [videos, setVideos] = useState<FeedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'summarized' | 'new'>('all')
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  // 异步获取进度状态
  const [fetching, setFetching] = useState(false)
  const [progressText, setProgressText] = useState('')
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { modelList, loadEnabledModels } = useModelStore()
  const { addPendingTask } = useTaskStore()
  const { style, outputLanguage, videoUnderstanding, videoInterval, gridCols, gridRows, selectedFormats, extras } = useSummarySettingsStore()

  const sub = subscriptions.find(s => s.platform === platform && s.platform_id === id)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => {
    fetchSubscriptions()
    loadEnabledModels()
    return () => stopPolling()
  }, [])

  useEffect(() => {
    if (platform && id) loadVideos()
  }, [platform, id, page])

  const loadVideos = async () => {
    if (!platform || !id) return
    setLoading(true)
    try {
      const offset = (page - 1) * PAGE_SIZE
      const res = await fetchChannelVideos(platform, id, PAGE_SIZE, offset)
      setVideos(res?.items || [])
      setTotal(res?.total || 0)
    } catch { } finally {
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
      pollingRef.current = setInterval(async () => {
        try {
          const p = await fetchRefreshProgress(progressId) as any
          if (!p) return

          if (p.status === 'running') {
            const page = p.current_page || 0
            const count = p.fetched_count || 0
            setProgressText(page > 0 ? `正在获取第 ${page} 页，已获取 ${count} 条...` : '正在获取...')
          } else if (p.status === 'completed') {
            stopPolling()
            setFetching(false)
            const added = p.added_count || 0
            const total = p.total_count || 0
            toast.success(`获取完成，新增 ${added} 条，总计 ${total} 条`)
            setPage(1)
            loadVideos()
          } else if (p.status === 'failed') {
            stopPolling()
            setFetching(false)
            toast.error(`获取失败: ${p.error || '未知错误'}`)
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

  const handleGenerate = async (item: FeedItem) => {
    if (!item.content_url) {
      toast.error('无法获取视频链接')
      return
    }

    if (modelList.length === 0) {
      toast.error('请先在设置中添加模型')
      navigate('/settings/model')
      return
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
      toast.error('生成笔记失败，请稍后重试')
    } finally {
      setGeneratingId(null)
    }
  }

  const filtered = videos.filter(v => {
    if (search && !v.title?.includes(search)) return false
    if (filter === 'summarized') return !!v.task_id
    if (filter === 'new') return !v.task_id
    return true
  })

  // 判断是否为空数据状态（已加载完毕，无内容，无正在获取）
  const isEmpty = !loading && total === 0 && !fetching

  return (
    <div className="flex flex-col h-full">
      {/* 返回按钮 */}
      <div className="px-6 pt-4">
        <button onClick={() => navigate('/channels')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* 频道信息卡片 */}
      <div className="mx-6 mb-4 flex flex-col rounded-lg bg-background p-4 shadow-md md:flex-row">
        <div className="mb-4 flex w-full flex-row items-center gap-4">
          {sub?.avatar_url ? (
            <img src={sub.avatar_url} alt="" referrerPolicy="no-referrer" className="mb-auto size-20 rounded-full md:size-48" />
          ) : (
            <div className="mb-auto size-20 rounded-full bg-muted flex items-center justify-center md:size-48">
              {platformIcon[platform || '']}
            </div>
          )}
          <div className="flex h-full flex-col justify-between">
            <h2 className="mb-2 text-lg font-bold sm:text-3xl">{sub?.channel_name || '频道详情'}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
              {platformIcon[platform || '']} {platformLabel[platform || '']}
              {sub?.channel_url && (
                <a href={sub.channel_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />{sub.channel_url}
                </a>
              )}
            </div>
            <div className="flex w-full flex-row items-center gap-2">
              <Button className="flex-1" onClick={handleFetch} disabled={!sub || fetching}>
                {fetching ? (
                  <><LoaderCircle className="w-4 h-4 mr-1 animate-spin" />{progressText || '获取中...'}</>
                ) : total > 0 ? (
                  <><RefreshCw className="w-4 h-4 mr-1" />刷新</>
                ) : (
                  <><Download className="w-4 h-4 mr-1" />获取内容</>
                )}
              </Button>
              <Button
                variant={sub ? "outline" : "secondary"}
                className={`flex-1 ${!sub ? 'hover:text-pink-400' : ''}`}
                onClick={() => sub ? unsubscribe(sub.id) : (sub?.channel_url && subscribe(sub.channel_url))}
                disabled={fetching}
              >
                {sub ? <><UserCheck className="size-3" />已订阅</> : <><UserPlus className="size-3" />订阅更新</>}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-3 flex gap-3">
        <Input placeholder="搜索标题..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <select className="rounded-md border px-3 py-2 text-sm bg-background" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="all">全部</option>
          <option value="summarized">已总结</option>
          <option value="new">未总结</option>
        </select>
        <span className="text-sm text-muted-foreground ml-2">共 {total} 条</span>
      </div>

      <div className="flex-1 overflow-auto px-6">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">加载中...</div>
        ) : fetching ? (
          <div className="text-center py-20">
            <LoaderCircle className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">{progressText || '正在获取订阅内容...'}</p>
          </div>
        ) : isEmpty ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">暂未获取内容</p>
            <Button onClick={handleFetch} disabled={!sub}>
              <Download className="w-4 h-4 mr-1" />获取内容
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
                <tr key={item.id} className="border-b hover:bg-accent/30">
                  <td className="px-4 py-2">
                    <div className="w-24 h-14 bg-muted rounded overflow-hidden relative">
                      {item.cover_url && <img src={item.cover_url} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" />}
                      {item.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
                          {formatDuration(item.duration)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-medium">{item.title}</span>
                    <div className="text-xs text-muted-foreground mt-1">{item.author}</div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {item.task_id ? (
                      <span className="text-green-500 text-xs">已有笔记</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">暂无</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{timeAgo(item.published_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline"
                        onClick={() => handleGenerate(item)}
                        disabled={generatingId === item.id}>
                        {generatingId === item.id && <LoaderCircle className="w-4 h-4 animate-spin mr-1" />}
                        {generatingId === item.id ? '生成中...' : item.task_id ? '重新生成' : '生成笔记'}
                      </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 分页器 */}
      {totalPages > 1 && (
        <div className="px-6 py-4 flex justify-center">
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
    </div>
  )
}
