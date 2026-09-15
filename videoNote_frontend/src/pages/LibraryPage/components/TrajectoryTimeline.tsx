import { useMemo } from 'react'
import { cn } from '@/lib/utils'

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

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatItemTime(dateStr: string | null): { dateKey: string; monthDay: string; time: string } {
  if (!dateStr) return { dateKey: 'unknown', monthDay: '未知', time: '' }
  const d = new Date(dateStr)
  return {
    dateKey: toDateKey(d),
    monthDay: `${d.getMonth() + 1}月${d.getDate()}日`,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  }
}

/** 相对日期：今天/昨天，否则返回空 */
function relativeDay(dateKey: string): string | null {
  const today = new Date()
  if (dateKey === toDateKey(today)) return '今天'
  if (dateKey === toDateKey(new Date(today.getTime() - 86400000))) return '昨天'
  return null
}

interface TimeGroup {
  dateKey: string
  monthDay: string
  items: TimelineItem[]
}

export function TrajectoryTimeline({ items, onSelect }: TrajectoryTimelineProps) {
  const groups = useMemo<TimeGroup[]>(() => {
    const sorted = [...items].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0
      return ta - tb
    })
    const map = new Map<string, TimeGroup>()
    for (const item of sorted) {
      const { dateKey, monthDay } = formatItemTime(item.created_at)
      if (!map.has(dateKey)) map.set(dateKey, { dateKey, monthDay, items: [] })
      map.get(dateKey)!.items.push(item)
    }
    return [...map.values()]
  }, [items])

  if (groups.length === 0) {
    return <p className="text-center text-muted-foreground py-8">暂无内容</p>
  }

  return (
    <div className="relative">
      {/* 时间轴标题 */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-medium">时间轴</span>
        <span className="text-xs text-muted-foreground">{items.length} 个内容</span>
        <div className="ml-auto flex gap-1">
          {Object.entries(PLATFORM_COLORS).map(([key, color]) => {
            const hasItems = items.some(i => i.platform === key)
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

      {/* 垂直时间线（按日期分组） */}
      <div className="relative pl-6">
        {/* 主线 */}
        <div className="absolute left-[5px] top-1 bottom-1 w-[2px] bg-border" />

        <div className="space-y-6">
          {groups.map(group => {
            const color = PLATFORM_COLORS[group.items[0]?.platform || ''] || '#6b7280'
            const rel = relativeDay(group.dateKey)
            const isToday = rel === '今天'
            return (
              <div key={group.dateKey} className="relative">
                {/* 节点圆点 */}
                <span
                  className="absolute -left-6 top-1 size-3 rounded-full border-2 border-background"
                  style={{ background: color }}
                />

                {/* 日期节点标题 */}
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={cn(
                      'text-[15px] font-bold leading-none',
                      isToday && 'text-[color:var(--platform)]'
                    )}
                    style={isToday ? ({ '--platform': color } as React.CSSProperties) : undefined}
                  >
                    {group.monthDay}
                    {rel && <span className="ml-1.5">{rel}</span>}
                  </span>
                  <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                    {group.items.length} 条内容
                  </span>
                </div>

                {/* 组内卡片 */}
                <div className="space-y-2">
                  {group.items.map(item => {
                    const { time } = formatItemTime(item.created_at)
                    const itemColor = PLATFORM_COLORS[item.platform || ''] || '#6b7280'
                    return (
                      <div
                        key={item.id}
                        className="group flex gap-3 cursor-pointer rounded-lg border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
                        onClick={() => onSelect?.(item.task_id)}
                      >
                        {/* 封面（高度跟随内容，与卡片一致） */}
                        <div className="relative w-[72px] shrink-0 self-stretch min-h-[54px] bg-muted">
                          {item.cover_url ? (
                            <img
                              src={item.cover_url}
                              alt={item.title || ''}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-[10px] text-muted-foreground">无封面</span>
                            </div>
                          )}
                          <div
                            className="absolute top-1 left-1 px-1 py-px rounded text-[9px] text-white leading-tight"
                            style={{ background: itemColor }}
                          >
                            {PLATFORM_LABELS[item.platform || ''] || item.platform}
                          </div>
                        </div>

                        {/* 信息区 */}
                        <div className="flex-1 min-w-0 py-1.5 pr-3">
                          <h4 className="text-[13px] font-medium text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                            {item.title || '无标题'}
                          </h4>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-[11px] font-semibold" style={{ color: itemColor }}>
                              {time}
                            </span>
                            <span className="text-[11px] text-muted-foreground/70">
                              {item.author || '未知作者'}
                            </span>
                          </div>
                          {item.note_summary && (
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/90 line-clamp-2">
                              {item.note_summary}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
