import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { ArrowLeft, PlayCircle } from 'lucide-react'
import { getAuthorVideos, type AuthorVideo } from '@/services/author'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo } from '@/components/Icons/platform'
import { cn } from '@/lib/utils'
import { getBaseURL } from '@/utils/api'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

const platformIcons: Record<string, React.ReactNode> = {
  bilibili: <BiliBiliLogo className="size-4" />,
  youtube: <YoutubeLogo className="size-4" />,
  douyin: <DouyinLogo className="size-4" />,
  kuaishou: <KuaishouLogo className="size-4" />,
}

const formatDuration = (s?: number | null) => {
  if (!s) return ''
  const m = Math.floor(s / 60)
  return `${m} 分钟`
}

export default function AuthorDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const [videos, setVideos] = useState<AuthorVideo[]>([])
  const [loading, setLoading] = useState(true)

  // 记录来源页面，用于返回时跳转
  const fromAuthors = location.state?.from === 'authors'

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getAuthorVideos(id)
      .then(({ videos }) => setVideos(videos || []))
      .catch(() => setVideos([]))
      .finally(() => setLoading(false))
  }, [id])

  // 点击视频进入详情页，传递来源信息
  const handleVideoClick = (taskId: string) => {
    navigate(`/notes/${taskId}`, { state: { from: 'authors', authorId: id } })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* 桌面端显示标题栏 */}
      {!isMobile && (
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate('/authors')}>
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-2xl font-bold">视频列表</h1>
          <span className="text-muted-foreground text-sm">{videos.length} 个视频</span>
        </div>
      )}

      {/* 移动端只显示视频数量 */}
      {isMobile && videos.length > 0 && (
        <div className="text-sm text-muted-foreground mb-4">
          {videos.length} 个视频
        </div>
      )}

      <div className="flex flex-col gap-3 md:gap-4">
        {videos.map((video) => (
          <button
            key={video.task_id}
            onClick={() => handleVideoClick(video.task_id)}
            className="flex items-center gap-3 md:gap-4 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left"
          >
            <div className="w-20 md:w-24 h-14 md:h-16 rounded-md overflow-hidden bg-muted shrink-0">
              {video.cover_url ? (
                <img
                  src={`${getBaseURL()}/api/image_proxy?url=${encodeURIComponent(video.cover_url)}`}
                  alt={video.title || ''}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PlayCircle className="size-6 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-medium truncate",
                video.status === 'SUCCESS' ? '' : 'text-muted-foreground'
              )}>
                {video.title || '未命名'}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                {platformIcons[video.platform]}
                <span>{video.platform}</span>
                {video.duration && <span>{formatDuration(video.duration)}</span>}
              </div>
            </div>
            <div className={cn(
              "text-xs px-2 py-1 rounded-full shrink-0",
              video.status === 'SUCCESS' ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
              video.status === 'FAILED' ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" :
              "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            )}>
              {video.status === 'SUCCESS' ? '已完成' : video.status === 'FAILED' ? '失败' : '处理中'}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}