import { useMemo } from 'react'
import { CalendarDays, ChartNoAxesColumn, Clock3, Film, Layers3 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AuthorStatsItem {
  created_at?: string | null
  duration?: number | string | null
  platform?: string | null
  title?: string | null
  format?: string | null
  [key: string]: unknown
}

export interface AuthorStats {
  total: number
  spanDays: number
  spanText: string
  frequencyPerWeek: number
  peakDay: { date: string; count: number } | null
  activeDays: number
  timeBuckets: Record<string, number>
  platforms: Record<string, number>
  formats: Record<string, number>
  avgDurationSec: number | null
}

const TIME_BUCKETS = [
  [0, 6, '凌晨(0-6)'],
  [6, 12, '上午(6-12)'],
  [12, 18, '下午(12-18)'],
  [18, 24, '晚间(18-24)'],
] as const

const PLATFORM_LABELS: Record<string, string> = {
  douyin: '抖音',
  bilibili: 'B站',
  youtube: 'YouTube',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  cctv: '央视',
  local: '本地',
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function finiteDuration(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const duration = typeof value === 'string' && value.trim() === '' ? NaN : Number(value)
  return Number.isFinite(duration) ? duration : null
}

export function computeAuthorStats(items: AuthorStatsItem[]): AuthorStats {
  const safeItems = Array.isArray(items) ? items : []
  const dated = safeItems.map(item => parseDate(item?.created_at)).filter((date): date is Date => date !== null)
  const dayCounts = new Map<string, number>()
  const timeBuckets = Object.fromEntries(TIME_BUCKETS.map(([, , label]) => [label, 0]))

  for (const date of dated) {
    const key = dateKey(date)
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1)
    const bucket = TIME_BUCKETS.find(([start, end]) => date.getHours() >= start && date.getHours() < end)
    if (bucket) timeBuckets[bucket[2]] += 1
  }

  const chronologicalDays = [...dayCounts.keys()].sort()
  const peakDay = chronologicalDays.reduce<{ date: string; count: number } | null>((peak, date) => {
    const count = dayCounts.get(date) ?? 0
    return !peak || count > peak.count ? { date, count } : peak
  }, null)
  const spanDays = dated.length
    ? Math.round((Math.max(...dated.map(d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))) - Math.min(...dated.map(d => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())))) / 86400000)
    : 0
  const frequency = safeItems.length ? safeItems.length / Math.max(spanDays / 7, 1 / 7) : 0
  const durations = safeItems.map(item => finiteDuration(item?.duration)).filter((value): value is number => value !== null)

  const countBy = (values: unknown[], mapper: (value: unknown) => string = value => typeof value === 'string' ? value : '') => {
    const counts: Record<string, number> = {}
    for (const value of values) {
      const key = mapper(value)
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }

  return {
    total: safeItems.length,
    spanDays,
    spanText: dated.length ? `${spanDays}天` : '未知',
    frequencyPerWeek: Number(frequency.toFixed(1)),
    peakDay,
    activeDays: dayCounts.size,
    timeBuckets,
    platforms: countBy(safeItems.map(item => item?.platform), value => PLATFORM_LABELS[String(value ?? '')] ?? String(value ?? '')),
    formats: countBy(safeItems.map(item => item?.format ?? (finiteDuration(item?.duration) === null ? '图文/实况' : '视频')), value => String(value ?? '')),
    avgDurationSec: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
  }
}

function Distribution({ values }: { values: Record<string, number> }) {
  return <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
    {Object.entries(values).map(([label, count]) => <span key={label}>{label} {count}</span>)}
  </div>
}

export function AuthorStatsBar({ items, generatedCount }: { items: AuthorStatsItem[]; generatedCount?: number }) {
  const stats = useMemo(() => computeAuthorStats(items), [items])
  return (
    <section className="rounded-lg border bg-card px-3 py-3 md:px-4" aria-label="内容统计">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex items-start gap-2 min-w-0">
          <Layers3 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-sm font-medium">共 {stats.total} 条内容{generatedCount !== undefined && <span className="ml-1 text-xs text-muted-foreground">已生成 {generatedCount}</span>}</p><p className="text-xs text-muted-foreground">时间范围：{stats.spanText}</p></div>
        </div>
        <div className="flex items-start gap-2 min-w-0">
          <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-sm font-medium">频率 {stats.frequencyPerWeek}/周</p><p className="text-xs text-muted-foreground">峰值日：{stats.peakDay ? `${stats.peakDay.date}（${stats.peakDay.count}）` : '未知'}</p></div>
        </div>
        <div className="flex items-start gap-2 min-w-0">
          <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-sm font-medium">活跃 {stats.activeDays} 天</p>{stats.peakDay ? <Distribution values={stats.timeBuckets} /> : <p className="text-xs text-muted-foreground">时间段：未知</p>}</div>
        </div>
        <div className="flex items-start gap-2 min-w-0">
          <ChartNoAxesColumn className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="min-w-0"><p className="text-sm font-medium">平台分布</p><Distribution values={stats.platforms} /><div className={cn('mt-1 flex items-center gap-1 text-xs text-muted-foreground')}><Film className="size-3" /><Distribution values={stats.formats} /></div></div>
        </div>
      </div>
    </section>
  )
}
