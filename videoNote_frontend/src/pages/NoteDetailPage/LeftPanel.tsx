import {
  Monitor,
  ArrowLeftRight,
  Download,
  Globe,
  Settings2,
  Sparkles,
  Play,
  X,
  Headphones,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { SummarySettings } from '@/components/SummarySettings'
import { ModelSelectDialog } from '@/components/ModelSelectDialog'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo } from '@/components/Icons/platform'
import type { Task } from '@/store/taskStore'

const getBaseURL = () => (String(import.meta.env.VITE_API_BASE_URL || 'api')).replace(/\/$/, '')

interface LeftPanelProps {
  task: Task
}

export default function LeftPanel({ task }: LeftPanelProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [isEmbedActive, setIsEmbedActive] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)

  const rawCoverUrl = task.audioMeta?.cover_url || ''
  const isLocal = task.platform === 'local' || task.platform === 'local_audio'
  const coverUrl = isLocal || !rawCoverUrl ? rawCoverUrl : `${getBaseURL()}/api/image_proxy?url=${encodeURIComponent(rawCoverUrl)}`
  const title = task.audioMeta?.title || '未命名笔记'
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
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
        <ToolBtn icon={<Monitor className="w-4 h-4" />} />
        <ToolBtn icon={<ArrowLeftRight className="w-4 h-4" />} />
        <ToolBtn icon={<Headphones className="w-4 h-4" />} variant="secondary" onClick={async () => {
          try {
            const raw = localStorage.getItem('auth-storage')
            const token = raw ? JSON.parse(raw).state?.token : ''
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
          } catch { /* ignore */ }
        }} />
        <ToolBtn icon={<Globe className="w-4 h-4" />} />
        <ToolBtn icon={<Settings2 className="w-4 h-4" />} label="总结设置" onClick={() => setSettingsOpen(true)} />
        <ToolBtn icon={<Sparkles className="w-4 h-4" />} label="默认模型" onClick={() => setModelOpen(true)} />
      </div>

      {/* 视频播放器 */}
      <div className="px-4 py-2">
        <div className="relative aspect-video bg-muted rounded-xl overflow-hidden group">
          {isEmbedActive && embedUrl ? (
            <>
              <iframe
                src={embedUrl}
                scrolling="no"
                className="w-full h-full border-0"
                allowFullScreen
              />
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
                  src={coverUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                  onError={() => setCoverFailed(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50">
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

        {/* 控制栏 */}
        <div className="flex items-center justify-between py-2 text-xs text-muted-foreground">
          <span>{isEmbedActive && embedUrl ? '嵌入播放器' : '视频播放器'}</span>
          {videoUrl && (
            <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              在网页中打开
            </a>
          )}
        </div>
      </div>

      {/* 视频信息 */}
      <div className="px-4 py-2 flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground leading-snug">{title}</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{task.platform}</span>
        </div>
      </div>

      {/* 聊天输入框 */}
      <div className="mt-auto px-4 py-3">
        <div className="flex items-center h-11 rounded-lg border border-border bg-background px-4">
          <span className="text-sm text-muted-foreground">聊天窗口</span>
        </div>
      </div>

      <SummarySettings open={settingsOpen} onOpenChange={setSettingsOpen} />
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
  return <>{iconMap[platform] || <LocalLogo className="w-10 h-10" />}</>
}

function ToolBtn({
  icon,
  label,
  variant = 'outline',
  onClick,
}: {
  icon: React.ReactNode
  label?: string
  variant?: 'outline' | 'secondary'
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-8 px-2 rounded-md text-foreground text-xs whitespace-nowrap transition-colors ${
        variant === 'secondary'
          ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          : 'bg-background border border-border hover:bg-accent'
      }`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}
