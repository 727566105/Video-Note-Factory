import { useEffect, useRef, useState, useCallback } from 'react'
import { LoaderCircle } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'

interface PullToRefreshProps {
  children: React.ReactNode
  onRefresh: () => Promise<void>
  threshold?: number // 下拉触发距离，默认 80px
}

/**
 * 下拉刷新组件
 * 在页面顶部下拉触发刷新操作
 */
export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
}: PullToRefreshProps) {
  const isMobile = useIsMobile()
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const isPullingRef = useRef(false)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await onRefresh()
    } finally {
      setIsRefreshing(false)
      setPullDistance(0)
    }
  }, [onRefresh])

  useEffect(() => {
    if (!isMobile) return

    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      // 只在滚动到顶部且未刷新时触发
      if (container.scrollTop === 0 && !isRefreshing) {
        startYRef.current = e.touches[0].clientY
        isPullingRef.current = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshing) return
      const deltaY = e.touches[0].clientY - startYRef.current
      // 只响应向下拉
      if (deltaY > 0) {
        // 限制最大下拉距离为阈值的 1.5 倍
        setPullDistance(Math.min(deltaY, threshold * 1.5))
      }
    }

    const handleTouchEnd = () => {
      if (!isPullingRef.current) return
      isPullingRef.current = false

      if (pullDistance >= threshold) {
        // 达到阈值，触发刷新
        handleRefresh()
      } else {
        // 未达到阈值，回弹
        setPullDistance(0)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, threshold, pullDistance, isRefreshing, handleRefresh])

  // 非移动端直接返回 children
  if (!isMobile) {
    return <>{children}</>
  }

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      {/* 刷新指示器 */}
      <div
        className="flex items-center justify-center text-muted-foreground"
        style={{
          height: pullDistance,
          opacity: Math.min(pullDistance / threshold, 1),
        }}
      >
        {isRefreshing ? (
          <LoaderCircle className="size-5 animate-spin" />
        ) : pullDistance >= threshold ? (
          <span className="text-xs">释放刷新</span>
        ) : (
          <span className="text-xs">下拉刷新</span>
        )}
      </div>
      {/* 内容 */}
      <div
        style={{
          transform: `translateY(${isRefreshing ? threshold : pullDistance}px)`,
          transition: isRefreshing ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}