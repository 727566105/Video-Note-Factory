import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, ExternalLink, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { fetchChannelVideos, refreshSubscription } from '@/services/subscription'
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

export default function ChannelDetailPage() {
  const { platform, id } = useParams<{ platform: string; id: string }>()
  const navigate = useNavigate()
  const { subscriptions } = useSubscriptionStore()
  const [videos, setVideos] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'summarized' | 'new'>('all')
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const { modelList, loadEnabledModels } = useModelStore()
  const { addPendingTask } = useTaskStore()
  const { style, outputLanguage, videoUnderstanding, videoInterval, gridCols, gridRows, selectedFormats, extras } = useSummarySettingsStore()

  const sub = subscriptions.find(s => s.platform === platform && s.platform_id === id)

  useEffect(() => {
    if (platform && id) loadVideos()
    loadEnabledModels()
  }, [platform, id])

  const loadVideos = async () => {
    if (!platform || !id) return
    setLoading(true)
    try {
      const res = await fetchChannelVideos(platform, id)
      setVideos(res || [])
    } catch { } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    if (!sub) return
    try {
      await refreshSubscription(sub.id)
      toast.success('刷新成功')
      loadVideos()
    } catch {
      toast.error('刷新失败')
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b flex items-center gap-4">
        <button onClick={() => navigate('/channels')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          {sub?.avatar_url ? <img src={sub.avatar_url} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-full" /> :
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              {platformIcon[platform || '']}
            </div>}
          <div>
            <h1 className="text-lg font-bold">{sub?.channel_name || '频道详情'}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {platformIcon[platform || '']} {platformLabel[platform || '']}
              {sub?.channel_url && (
                <a href={sub.channel_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={!sub || loading}>
            <RefreshCw className="w-4 h-4 mr-1" />刷新
          </Button>
        </div>
      </div>

      <div className="px-6 py-3 flex gap-3">
        <Input placeholder="搜索标题..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
        <select className="rounded-md border px-3 py-2 text-sm bg-background" value={filter} onChange={e => setFilter(e.target.value as any)}>
          <option value="all">全部</option>
          <option value="summarized">已总结</option>
          <option value="new">未总结</option>
        </select>
      </div>

      <div className="flex-1 overflow-auto px-6">
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">加载中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">暂无内容</div>
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
                    {item.task_id ? (
                      <Button size="sm" variant="outline"
                        onClick={() => navigate(`/notes/${item.task_id}`)}>查看</Button>
                    ) : (
                      <Button size="sm"
                        onClick={() => handleGenerate(item)}
                        disabled={generatingId === item.id}>
                        {generatingId === item.id && <LoaderCircle className="w-4 h-4 animate-spin mr-1" />}
                        {generatingId === item.id ? '生成中...' : '生成笔记'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}