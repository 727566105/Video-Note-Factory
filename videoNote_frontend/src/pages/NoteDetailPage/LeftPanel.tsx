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
} from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SummarySettings, type LocalSummaryValues } from '@/components/SummarySettings'
import { ModelSelectDialog } from '@/components/ModelSelectDialog'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo } from '@/components/Icons/platform'
import { useSystemStore } from '@/store/configStore'
import type { Task } from '@/store/taskStore'
import type { LocalSettings } from './RightPanel'
import { getBaseURL } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const SUBSCRIBABLE_PLATFORMS = ['bilibili', 'youtube', 'douyin', 'kuaishou']

interface LeftPanelProps {
  task: Task
  localSettings: LocalSettings
  onSettingsChange: (settings: LocalSettings) => void
}

export default function LeftPanel({ task, localSettings, onSettingsChange }: LeftPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [isEmbedActive, setIsEmbedActive] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)
  const [subscribing, setSubscribing] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null)
  const coverRef = useRef<HTMLImageElement>(null)
  const navigate = useNavigate()
  const setPanelSwapped = useSystemStore(state => state.setPanelSwapped)
  const { subscribe, subscriptions } = useSubscriptionStore()

  // 获取发布人名字
  const getAuthor = (): string => {
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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 顶栏工具按钮 */}
      <div className="flex items-center justify-between px-4 py-2 overflow-x-auto">
        <ButtonGroup>
          <ButtonGroup className="hidden sm:flex">
            <Button variant="outline" size="sm" onClick={() => navigate('/notes')} aria-label="返回笔记列表">
              <ArrowLeft className="size-4" />
              返回
            </Button>
          </ButtonGroup>
          <ButtonGroup className="flex sm:hidden">
            <Button variant="outline" size="icon-sm" onClick={() => navigate('/notes')} aria-label="返回笔记列表">
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="原视频链接">
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

      {/* 视频播放器 */}
      <div className="px-4 py-2">
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
              {(embedUrl || videoUrl) && (
                <button
                  onClick={() => {
                    if (embedUrl) {
                      setIsEmbedActive(true)
                    } else if (videoUrl) {
                      window.open(videoUrl, '_blank', 'noopener,noreferrer')
                    }
                  }}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                    <Play className="w-8 h-8 text-white ml-1" />
                  </div>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 视频信息 */}
      <div className="px-4 py-2 flex flex-col gap-3">
        {/* 面包屑 */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <button
            onClick={() => navigate('/notes')}
            className="hover:text-foreground transition-colors"
          >
            首页
          </button>
          {(task.author_name || authorDisplay !== task.platform) && (
            <>
              <span>/</span>
              <button
                onClick={() => {
                  const aid = task.author_id || (task.audioMeta?.raw_info as Record<string, unknown>)?.owner?.mid || (task.audioMeta?.raw_info as Record<string, unknown>)?.uploader_id
                  if (aid) navigate(`/authors/${aid}`)
                }}
                className="hover:text-foreground transition-colors"
              >
                {task.author_name || authorDisplay}
              </button>
            </>
          )}
          <span>/</span>
          <span className="text-foreground truncate max-w-[200px]">{title}</span>
        </div>
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
      </div>

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
        }}
        onLocalChange={(values) => {
          onSettingsChange({
            ...localSettings,
            style: values.style ?? localSettings.style,
            outputLanguage: values.outputLanguage ?? localSettings.outputLanguage,
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
    local: <LocalLogo className="w-10 h-10" />,
    local_audio: <AudioLogo className="w-10 h-10" />,
  }
  return iconMap[platform] ?? <LocalLogo className="w-10 h-10" />
}

