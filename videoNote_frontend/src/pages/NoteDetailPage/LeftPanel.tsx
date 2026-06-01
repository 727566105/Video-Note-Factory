import {
  Monitor,
  ArrowLeftRight,
  ArrowLeft,
  Globe,
  Settings2,
  Sparkles,
  Play,
  X,
  Headphones,
  Rss,
  ChevronDown,
  Loader2,
  Download,
  Link,
} from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SummarySettings, type LocalSummaryValues } from '@/components/SummarySettings'
import { ModelSelectDialog } from '@/components/ModelSelectDialog'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo, XiaohongshuLogo, CCTVLogo } from '@/components/Icons/platform'
import { useSystemStore } from '@/store/configStore'
import { useTaskStore, type Task } from '@/store/taskStore'
import type { LocalSettings } from './RightPanel'
import { getBaseURL } from '@/utils/api'
import request from '@/utils/request'
import { useAuthStore } from '@/store/authStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MediaGallery } from '@/components/MediaGallery'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { TagEditorPopover } from '@/components/TagEditorPopover'
import { useIsMobile } from '@/hooks/use-mobile'

const SUBSCRIBABLE_PLATFORMS = ['bilibili', 'youtube', 'douyin', 'kuaishou']

// 平台名称映射
const platformLabel: Record<string, string> = {
  bilibili: 'B站',
  youtube: 'YouTube',
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  local: '本地视频',
  local_audio: '本地音频',
}

interface LeftPanelProps {
  task: Task
  localSettings: LocalSettings
  onSettingsChange: (settings: LocalSettings) => void
}

export default function LeftPanel({ task, localSettings, onSettingsChange }: LeftPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [isEmbedActive, setIsEmbedActive] = useState(false)
  const [isLocalVideoActive, setIsLocalVideoActive] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null)
  const [remoteDeleted, setRemoteDeleted] = useState(false)
  const [checkingRemote, setCheckingRemote] = useState(false)
  const coverRef = useRef<HTMLImageElement>(null)
  const navigate = useNavigate()
  const setPanelSwapped = useSystemStore(state => state.setPanelSwapped)
  const { subscribe, subscriptions } = useSubscriptionStore()
  const updateTaskContent = useTaskStore(state => state.updateTaskContent)
  const isMobile = useIsMobile()

  // 本地视频文件 URL
  const localVideoUrl = useMemo(() => {
    const videoId = task.audioMeta?.video_id || ''
    const authorId = task.author_id || task.audioMeta?.author_id || ''
    if (!videoId || !authorId) return null
    return `${getBaseURL()}/api/video_file/${task.platform}/${authorId}/${videoId}`
  }, [task.platform, task.audioMeta?.video_id, task.author_id, task.audioMeta?.author_id])

  // 检测远程视频状态
  const checkRemoteStatus = async () => {
    const videoUrlToCheck = videoUrl || task.formData?.video_url || ''
    if (!videoUrlToCheck) return true

    setCheckingRemote(true)
    try {
      const resp = await request.get('/api/check_remote_status', {
        params: { url: videoUrlToCheck }
      })
      const exists = resp.data?.exists ?? false
      setRemoteDeleted(!exists)
      return exists
    } catch {
      setRemoteDeleted(true)
      return false
    } finally {
      setCheckingRemote(false)
    }
  }

  // 获取发布人名字
  const getAuthor = (): string => {
    // 优先使用 author（数据库主字段）
    if (task.author) return task.author
    // 其次使用 author_name（图文笔记和视频笔记都有）
    if (task.author_name) return task.author_name
    // 再次检查 audioMeta.author（视频笔记）
    if (task.audioMeta?.author) return task.audioMeta.author
    const raw = task.audioMeta?.raw_info as Record<string, unknown> | undefined
    if (!raw) return task.platform
    const owner = raw.owner as Record<string, unknown> | undefined
    const author = raw.author as Record<string, unknown> | undefined
    return (owner?.name as string) || (raw.uploader as string) || (raw.channel as string) || (author?.name as string) || task.platform
  }
  const authorDisplay = getAuthor()

  const isAuthorSubscribed = subscriptions.some(s => s.channel_name === authorDisplay)
  const canSubscribe = SUBSCRIBABLE_PLATFORMS.includes(task.platform) && authorDisplay && authorDisplay !== task.platform

  // 从 raw_info 获取视频宽高
  useEffect(() => {
    const raw = task.audioMeta?.raw_info as Record<string, unknown> | null
    if (raw) {
      const width = raw.width as number | undefined
      const height = raw.height as number | undefined
      if (width && height && width > 0 && height > 0) {
        setVideoDimensions({ width, height })
      }
    }
  }, [task.audioMeta?.raw_info])

  // 从封面图片加载后获取宽高（作为备用）
  const handleCoverLoad = () => {
    if (coverRef.current && !videoDimensions) {
      const naturalWidth = coverRef.current.naturalWidth
      const naturalHeight = coverRef.current.naturalHeight
      if (naturalWidth > 0 && naturalHeight > 0) {
        // 抖音封面通常是竖屏格式，不能作为判断依据
        if (task.platform !== 'douyin') {
          setVideoDimensions({ width: naturalWidth, height: naturalHeight })
        }
      }
    }
  }

  // 计算 iframe wrapper 样式 - 根据视频宽高比动态缩放
  const getIframeWrapperStyle = () => {
    const containerHeight = 300
    // 默认假设竖屏视频 9:16
    const defaultRatio = 9 / 16
    
    if (!videoDimensions) {
      // 没有宽高信息，使用默认竖屏比例
      const wrapperHeight = containerHeight / defaultRatio
      const scale = defaultRatio
      return {
        width: '100%',
        height: `${wrapperHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }
    }
    
    const { width, height } = videoDimensions
    const ratio = height / width // 竖屏时 > 1
    
    if (ratio > 1) {
      // 竖屏视频：wrapper 高度按视频比例，缩放适应容器
      const wrapperHeight = containerHeight / (1 / ratio)
      const scale = 1 / ratio
      return {
        width: '100%',
        height: `${wrapperHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
      }
    } else {
      // 横屏视频：使用 aspect-video (16:9) 比例
      return {
        width: '100%',
        height: '100%',
        transform: 'none',
      }
    }
  }

  // 判断是否为竖屏视频
  const isPortraitVideo = () => {
    if (!videoDimensions) return true // 默认假设竖屏
    return videoDimensions.height > videoDimensions.width
  }

  const rawCoverUrl = task.audioMeta?.cover_url || ''
  const isLocal = task.platform === 'local' || task.platform === 'local_audio'
  const coverUrl = isLocal || !rawCoverUrl ? rawCoverUrl : `${getBaseURL()}/api/image_proxy?url=${encodeURIComponent(rawCoverUrl)}`
  const title = task.audioMeta?.title || '未命名笔记'
  const description = task.audioMeta?.description || ''
  const videoId = task.audioMeta?.video_id || ''

  // 判断是否支持嵌入播放器
  const embedUrl = useMemo(() => {
    if (!videoId) return null
    if (task.platform === 'bilibili') {
      return `https://player.bilibili.com/player.html?bvid=${videoId}&autoplay=1&danmaku=1&high_quality=1`
    }
    if (task.platform === 'youtube') {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=1&rel=0`
    }
    if (task.platform === 'douyin') {
      return `https://open.douyin.com/player/video?vid=${videoId}`
    }
    return null
  }, [task.platform, videoId])

  // 从 markdown 中提取原片链接
  const getVideoUrl = () => {
    let md = ''
    if (typeof task.markdown === 'string') {
      md = task.markdown
    } else if (Array.isArray(task.markdown) && task.markdown.length > 0) {
      md = task.markdown[0].content
    }
    if (md) {
      const match = md.match(/\[原片[^\]]*\]\(([^)]+)\)/)
      if (match) return match[1]
    }
    return task.formData?.video_url || ''
  }
  const videoUrl = getVideoUrl()

  // 移动端布局：简洁版本，上下滚动
  if (isMobile) {
    const isMediaType = task.content_type === 'article' || task.content_type === 'live_photo'

    return (
      <div className="flex flex-col">
        {/* 媒体内容区 */}
        <div className="px-3 pt-3">
          {/* 远程删除提示栏 */}
          {remoteDeleted && !isMediaType && (
            <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 flex items-center gap-2">
              <Globe className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <span className="text-xs text-yellow-700 dark:text-yellow-300">
                远程视频已删除，本地文件仍可播放
              </span>
            </div>
          )}

          {/* 图集/实况照片：显示媒体画廊 */}
          {isMediaType ? (
            <MediaGallery
              taskId={task.id}
              contentType={task.content_type as 'article' | 'live_photo'}
              className="px-0 pt-0"
            />
          ) : (
            /* 视频类型：封面 + 播放按钮 */
            <div
              className="relative bg-muted rounded-lg overflow-hidden w-full"
              style={{ aspectRatio: '16/9' }}
            >
              {coverUrl && !coverFailed ? (
                <img
                  src={coverUrl}
                  alt={title}
                  className="w-full h-full object-contain"
                  crossOrigin="anonymous"
                  onError={() => setCoverFailed(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PlatformIcon platform={task.platform} />
                </div>
              )}
              {/* 播放按钮 */}
              {(embedUrl || videoUrl || localVideoUrl) && (
                <button
                  onClick={async () => {
                    if (localVideoUrl) {
                      setIsLocalVideoActive(true)
                      return
                    }
                    await checkRemoteStatus()
                    if (embedUrl) {
                      setIsEmbedActive(true)
                    } else if (videoUrl) {
                      window.open(videoUrl, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/30"
                >
                  <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  </div>
                </button>
              )}
            </div>
          )}

          {/* 嵌入播放器 */}
          {isEmbedActive && embedUrl && (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
              <iframe
                src={embedUrl}
                className="w-full h-full border-0"
                allowFullScreen
              />
              <button
                onClick={() => setIsEmbedActive(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          {/* 本地视频播放器 */}
          {isLocalVideoActive && localVideoUrl && (
            <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
              <video
                src={localVideoUrl}
                className="w-full h-full"
                controls
                autoPlay
              />
              <button
                onClick={() => setIsLocalVideoActive(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* 视频标题 */}
        <div className="px-3 pt-2">
          <h2 className="text-base font-semibold text-foreground leading-snug">{title}</h2>
        </div>

        {/* 视频信息行 */}
        <div className="px-3 pt-1 flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1">
            <PlatformIconSmall platform={task.platform} />
            {platformLabel[task.platform] || task.platform}
          </span>
          {authorDisplay && authorDisplay !== task.platform && (
            <span className="flex items-center gap-1">
              <span>·</span>
              <span className="text-primary font-medium">{authorDisplay}</span>
              {canSubscribe && (
                <button
                  className={cn(
                    'p-1 rounded transition-colors',
                    isAuthorSubscribed ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                  )}
                  onClick={() => subscribe(task.formData?.video_url || '')}
                  disabled={subscribing}
                >
                  <Rss className="w-3.5 h-3.5" />
                </button>
              )}
            </span>
          )}
        </div>

        {/* 操作按钮行 */}
        <div className="px-3 pt-2 pb-3 flex items-center gap-2 flex-wrap">
          {videoUrl && (
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => window.open(videoUrl, '_blank')}>
              <Link className="w-4 h-4 mr-1" />原片
            </Button>
          )}
          {!isMediaType && (
            <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={async () => {
              try {
                const token = useAuthStore.getState().token
                const res = await fetch(`${getBaseURL()}/api/audio/${task.id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                })
                if (!res.ok) throw new Error()
                const blob = await res.blob()
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = (task.audioMeta?.title || '音频') + '.mp3'
                a.click()
                URL.revokeObjectURL(a.href)
              } catch {
                toast.error('下载失败')
              }
            }}>
              <Download className="w-4 h-4 mr-1" />音频
            </Button>
          )}
          <Button variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4 mr-1" />设置
          </Button>
        </div>

        {/* 弹窗 */}
        <SummarySettings
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          settings={localSettings}
          onSave={(vals) => {
            onSettingsChange(vals as LocalSettings)
            setSettingsOpen(false)
          }}
        />
        <ModelSelectDialog open={modelOpen} onOpenChange={setModelOpen} />
      </div>
    )
  }

  // 桌面端布局：原有布局
  const isMediaType = task.content_type === 'article' || task.content_type === 'live_photo'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 顶栏工具按钮 */}
      <div className="flex items-center justify-between px-4 py-2 overflow-x-auto">
        <ButtonGroup>
          <ButtonGroup className="hidden sm:flex">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} aria-label="返回笔记列表">
              <ArrowLeft className="size-4" />
              返回
            </Button>
          </ButtonGroup>
          <ButtonGroup className="flex sm:hidden">
            <Button variant="outline" size="icon-sm" onClick={() => navigate(-1)} aria-label="返回笔记列表">
              <ArrowLeft className="size-4" />
            </Button>
          </ButtonGroup>
          <ButtonGroupSeparator />
          <ButtonGroup>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="视频信息">
                  <Monitor className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>视频信息</TooltipContent>
            </Tooltip>
            {!isMediaType && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="下载音频" onClick={async () => {
                  try {
                    const token = useAuthStore.getState().token
                    const res = await fetch(`${getBaseURL()}/api/audio/${task.id}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    if (!res.ok) throw new Error()
                    const blob = await res.blob()
                    const cd = res.headers.get('content-disposition')
                    let filename = (task.audioMeta?.title || '音频') + '.mp3'
                    if (cd) {
                      const m = cd.match(/filename\*?=(?:UTF-8'')?(.+)/i)
                      if (m) filename = decodeURIComponent(m[1].replace(/["']/g, ''))
                    }
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = filename
                    a.click()
                    URL.revokeObjectURL(a.href)
                  } catch {
                    toast.error('音频下载失败')
                  }
                }}>
                  <Headphones className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载音频</TooltipContent>
            </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="原视频链接" onClick={() => {
                if (videoUrl) {
                  window.open(videoUrl, '_blank', 'noopener,noreferrer')
                } else {
                  toast.error('未找到原始链接')
                }
              }}>
                  <Globe className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>原视频链接</TooltipContent>
            </Tooltip>
          </ButtonGroup>
          <ButtonGroup>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="size-4" />
              总结设置
            </Button>
            <Button variant="outline" size="sm" onClick={() => setModelOpen(true)}>
              <Sparkles className="size-4" />
              默认模型
            </Button>
          </ButtonGroup>
        </ButtonGroup>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="切换面板布局" onClick={() => setPanelSwapped(!useSystemStore.getState().panelSwapped)}>
              <ArrowLeftRight className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>切换面板布局</TooltipContent>
        </Tooltip>
      </div>

      {/* 媒体内容区 */}
      <div className="px-4 py-2 overflow-y-auto">
        {/* 远程删除提示栏 */}
        {remoteDeleted && !isMediaType && (
          <div className="mb-2 px-3 py-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-sm text-yellow-700 dark:text-yellow-300">
              远程视频已删除，本地文件仍可播放
            </span>
          </div>
        )}

        {/* 图集/实况照片：显示媒体画廊 */}
        {isMediaType ? (
          <MediaGallery
            taskId={task.id}
            contentType={task.content_type as 'article' | 'live_photo'}
          />
        ) : (
          /* 视频类型：封面 + 播放按钮 */
          <div
            className="relative bg-muted rounded-xl overflow-hidden group w-full"
            style={{ height: isPortraitVideo() ? '300px' : 'auto', aspectRatio: isPortraitVideo() ? undefined : '16/9' }}
          >
            {isEmbedActive && embedUrl ? (
              <>
                {/* iframe wrapper - 使用缩放适应容器 */}
                <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                  <div style={getIframeWrapperStyle()}>
                    <iframe
                      src={embedUrl}
                      className="w-full h-full border-0"
                      allowFullScreen
                    />
                  </div>
                </div>
                <button
                  onClick={() => setIsEmbedActive(false)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : isLocalVideoActive && localVideoUrl ? (
              <>
                {/* 本地视频播放器 */}
                <video
                  src={localVideoUrl}
                  className="absolute inset-0 w-full h-full object-contain"
                  controls
                  autoPlay
                />
                <button
                  onClick={() => setIsLocalVideoActive(false)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                {coverUrl && !coverFailed ? (
                  <img
                    ref={coverRef}
                    src={coverUrl}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-contain"
                    crossOrigin="anonymous"
                    onError={() => setCoverFailed(true)}
                    onLoad={handleCoverLoad}
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50">
                    <PlatformIcon platform={task.platform} />
                    <span className="text-xs text-muted-foreground">{title}</span>
                  </div>
                )}
                {(embedUrl || videoUrl || localVideoUrl) && (
                  <button
                    onClick={async () => {
                      // 有本地视频优先播放本地
                      if (localVideoUrl) {
                        setIsLocalVideoActive(true)
                        return
                      }
                      // 检测远程状态
                      await checkRemoteStatus()
                      if (embedUrl) {
                        setIsEmbedActive(true)
                      } else if (videoUrl) {
                        window.open(videoUrl, '_blank', 'noopener,noreferrer')
                      }
                    }}
                    disabled={checkingRemote}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-wait"
                  >
                    <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                      {checkingRemote ? (
                        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Play className="w-8 h-8 text-white ml-1" />
                      )}
                    </div>
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 视频信息 */}
      <div className="px-4 py-2 flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground leading-snug">{title}</h2>
        {description && (
          <div className="rounded-lg bg-muted p-2 text-sm text-muted-foreground">
            <p
              className={cn(
                'whitespace-pre-wrap',
                descExpanded ? '' : 'max-h-5 overflow-hidden'
              )}
            >
              {description}
            </p>
            <button
              className="flex items-center justify-end text-muted-foreground hover:text-foreground transition-colors mt-1"
              onClick={() => setDescExpanded(!descExpanded)}
              aria-label={descExpanded ? '收起描述' : '展开描述'}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  descExpanded ? 'rotate-180' : ''
                )}
              />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{authorDisplay}</span>
          {canSubscribe && (
            <Toggle
              size="sm"
              variant="outline"
              pressed={isAuthorSubscribed}
              disabled={subscribing || isAuthorSubscribed}
              onPressedChange={async (pressed) => {
                if (pressed && !subscribing && !isAuthorSubscribed) {
                  setSubscribing(true)
                  try {
                    await subscribe(videoUrl)
                  } finally {
                    setSubscribing(false)
                  }
                }
              }}
              aria-label="订阅频道"
            >
              <Rss className="size-3" />
              {isAuthorSubscribed ? '已订阅' : subscribing ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  订阅中
                </>
              ) : '订阅'}
            </Toggle>
          )}
        </div>
        {/* 标签显示 */}
        {(task.tags?.platform_tags?.length || task.tags?.ai_tags?.length || task.tags?.manual_tags?.length) && (
          <div className="flex gap-1 flex-wrap items-center">
            {task.tags?.platform_tags?.map((tag, i) => (
              <Badge key={`p${i}`} variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-[10px] h-5 px-1.5">
                {tag}
              </Badge>
            ))}
            {task.tags?.ai_tags?.map((tag, i) => (
              <Badge key={`a${i}`} variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 text-[10px] h-5 px-1.5">
                {tag}
              </Badge>
            ))}
            {task.tags?.manual_tags?.map((tag, i) => (
              <Badge key={`m${i}`} variant="outline" className="bg-green-50 text-green-600 border-green-200 text-[10px] h-5 px-1.5">
                {tag}
              </Badge>
            ))}
            <TagEditorPopover
              taskId={task.id}
              tags={task.tags}
              onUpdate={(newTags) => {
                updateTaskContent(task.id, { tags: newTags })
              }}
            />
          </div>
        )}
      </div>

      {!isMediaType && <div className="flex-1" />}

      {/* 聊天输入框 */}
      <div className="mt-auto px-4 py-3">
        <div className="flex items-center h-11 rounded-lg border border-border bg-background px-4">
          <span className="text-sm text-muted-foreground">聊天窗口</span>
        </div>
      </div>

      <SummarySettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode="local"
        localValues={{
          style: localSettings.style,
          outputLanguage: localSettings.outputLanguage,
          videoUnderstanding: localSettings.videoUnderstanding,
          videoInterval: localSettings.videoInterval,
          gridCols: localSettings.gridCols,
          gridRows: localSettings.gridRows,
          selectedFormats: localSettings.selectedFormats,
          extras: localSettings.extras,
        }}
        onLocalChange={(values) => {
          onSettingsChange({
            ...localSettings,
            ...values,
          })
        }}
      />
      <ModelSelectDialog open={modelOpen} onOpenChange={setModelOpen} />
    </div>
  )
}

function PlatformIcon({ platform }: { platform: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    bilibili: <BiliBiliLogo className="w-10 h-10" />,
    youtube: <YoutubeLogo className="w-10 h-10" />,
    douyin: <DouyinLogo className="w-10 h-10" />,
    kuaishou: <KuaishouLogo className="w-10 h-10" />,
    xiaohongshu: <XiaohongshuLogo className="w-10 h-10" />,
    local: <LocalLogo className="w-10 h-10" />,
    local_audio: <AudioLogo className="w-10 h-10" />,
    cctv: <CCTVLogo className="w-10 h-10" />,
  }
  return iconMap[platform] ?? <LocalLogo className="w-10 h-10" />
}

function PlatformIconSmall({ platform }: { platform: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    bilibili: <BiliBiliLogo className="w-4 h-4" />,
    youtube: <YoutubeLogo className="w-4 h-4" />,
    douyin: <DouyinLogo className="w-4 h-4" />,
    kuaishou: <KuaishouLogo className="w-4 h-4" />,
    xiaohongshu: <XiaohongshuLogo className="w-4 h-4" />,
    local: <LocalLogo className="w-4 h-4" />,
    local_audio: <AudioLogo className="w-4 h-4" />,
    cctv: <CCTVLogo className="w-4 h-4" />,
  }
  return iconMap[platform] ?? <LocalLogo className="w-4 h-4" />
}

