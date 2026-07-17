import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Subscription } from '@/services/subscription'

interface Props {
  sub: Pick<Subscription, 'last_fetch_status' | 'last_fetch_count' | 'last_fetch_error' | 'last_fetch_at'>
  className?: string
}

/** 订阅上次拉取结果状态徽标（四态：success/empty/failed/cookie_expired） */
export function FetchStatusBadge({ sub, className }: Props) {
  const { last_fetch_status, last_fetch_count, last_fetch_error, last_fetch_at } = sub

  if (!last_fetch_status) {
    return <span className={cn('text-xs text-muted-foreground', className)}>未检查</span>
  }

  const time = last_fetch_at ? new Date(last_fetch_at).toLocaleString() : ''

  const badge = (() => {
    switch (last_fetch_status) {
      case 'success':
        return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">新增 {last_fetch_count ?? 0} 条</Badge>
      case 'empty':
        return <Badge variant="secondary" className="bg-gray-100 text-gray-500 hover:bg-gray-100">无新内容</Badge>
      case 'failed':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">失败</Badge>
      case 'cookie_expired':
        return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Cookie 失效</Badge>
    }
  })()

  // 失败/Cookie 失效时用 tooltip 展示原因；成功/无新内容用 tooltip 展示时间
  const tooltipText = (() => {
    if (last_fetch_status === 'cookie_expired') {
      return last_fetch_error || 'Cookie 已过期，请在设置页重新配置'
    }
    if (last_fetch_status === 'failed') {
      return last_fetch_error || '拉取失败'
    }
    return time ? `上次拉取：${time}` : ''
  })()

  if (!tooltipText) {
    return <span className={className}>{badge}</span>
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('cursor-help inline-flex', className)}>{badge}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
