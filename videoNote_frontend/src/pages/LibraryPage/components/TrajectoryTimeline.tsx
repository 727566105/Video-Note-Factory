import { useMemo } from 'react'

interface TimelineItem {
  id: string
  task_id: string
  title: string
  cover_url: string | null
  platform: string | null
  author: string | null
  created_at: string | null
  note_summary?: string | null
}

interface TrajectoryTimelineProps {
  items: TimelineItem[]
  onSelect?: (taskId: string) => void
}

const PLATFORM_COLORS: Record<string, string> = {
  douyin: '#fe2c55',
  xiaohongshu: '#ff2442',
  bilibili: '#00a1d6',
  youtube: '#ff0000',
  kuaishou: '#e6162d',
  cctv: '#1e83d6',
  local: '#6b7280',
}

const PLATFORM_LABELS: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  bilibili: 'B站',
  youtube: 'YouTube',
  kuaishou: '快手',
  cctv: '央视',
  local: '本地',
}

function formatDate(dateStr: string | null): { date: string; time: string } {
  if (!dateStr) return { date: '未知', time: '' }
  const d = new Date(dateStr)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return { date, time }
}

export function TrajectoryTimeline({ items, onSelect }: TrajectoryTimelineProps) {
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return ta - tb
    })
  }, [items])

  if (sortedItems.length === 0) {
    return <p className="text-center text-muted-foreground py-8">暂无内容</p>
  }

  return (
    <div className="relative">
      {/* 时间轴标题 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium">时间轴</span>
        <span className="text-xs text-muted-foreground">{sortedItems.length} 个内容</span>
        <div className="ml-auto flex gap-1">
          {Object.entries(PLATFORM_COLORS).map(([key, color]) => {
            const hasItems = sortedItems.some(i => i.platform === key)
            if (!hasItems) return null
            return (
              <span key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="size-2 rounded-full" style={{ background: color }} />
                {PLATFORM_LABELS[key] || key}
              </span>
            )
          })}
        </div>
      </div>

      {/* 垂直时间线 */}
      <div className="relative pl-6">
        {/* 主线 */}
        <div className="absolute left-[5px] top-1 bottom-1 w-[2px] bg-border" />

        <div className="space-y-4">
          {sortedItems.map(item => {
            const { date, time } = formatDate(item.created_at)
            const platform = item.platform || 'unknown'
            const color = PLATFORM_COLORS[platform] || '#6b7280'

            return (
              <div key={item.id} className="relative">
                {/* 圆点 */}
                <span
                  className="absolute -left-6 top-4 size-3 rounded-full border-2 border-background"
                  style={{ background: color }}
                />

                {/* 横向卡片 */}
                <div
                  className="group flex gap-4 cursor-pointer rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
                  onClick={() => onSelect?.(item.task_id)}
                >
                  {/* 封面 */}
                  <div className="relative w-[130px] h-[100px] shrink-0 bg-muted">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.title || ''}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">无封面</span>
                      </div>
                    )}
                    <div
                      className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] text-white"
                      style={{ background: color }}
                    >
                      {PLATFORM_LABELS[platform] || platform}
                    </div>
                  </div>

                  {/* 信息区 */}
                  <div className="flex-1 min-w-0 py-2.5 pr-3">
                    {/* 时间 + 作者 */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {date} {time}
                      </span>
                      <span className="text-[11px] text-muted-foreground/70">
                        {item.author || '未知作者'}
                      </span>
                    </div>

                    {/* 标题 */}
                    <h4 className="mt-1 text-[13px] font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title || '无标题'}
                    </h4>

                    {/* 摘要（多行显示） */}
                    {item.note_summary && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/90 line-clamp-5">
                        {item.note_summary}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
