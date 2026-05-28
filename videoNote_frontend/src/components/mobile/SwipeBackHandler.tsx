import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '@/hooks/use-mobile'

interface SwipeBackHandlerProps {
  children: React.ReactNode
  edgeWidth?: number // 左边缘检测区域宽度，默认 20px
  threshold?: number // 滑动触发距离，默认 100px
}

/**
 * 滑动返回手势组件
 * 从屏幕左边缘向右滑动触发返回上一页
 */
export function SwipeBackHandler({
  children,
  edgeWidth = 20,
  threshold = 100,
}: SwipeBackHandlerProps) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [offset, setOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const isSwipingRef = useRef(false)
  const currentOffsetRef = useRef(0) // 用 ref 存储偏移量，避免 useEffect 重新绑定

  // 触发返回或回弹
  const finishSwipe = useCallback(() => {
    if (!isSwipingRef.current) return
    isSwipingRef.current = false
    setIsAnimating(true)

    if (currentOffsetRef.current > threshold) {
      // 达到阈值，触发返回
      setOffset(0)
      currentOffsetRef.current = 0
      navigate(-1)
    } else {
      // 未达到阈值，回弹
      setOffset(0)
      currentOffsetRef.current = 0
    }
  }, [threshold, navigate])

  useEffect(() => {
    if (!isMobile) return

    const container = containerRef.current
    if (!container) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      // 只在左边缘区域内触发
      if (touch.clientX <= edgeWidth) {
        startXRef.current = touch.clientX
        isSwipingRef.current = true
        currentOffsetRef.current = 0
        setIsAnimating(false)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwipingRef.current) return
      const touch = e.touches[0]
      const deltaX = touch.clientX - startXRef.current
      // 只响应向右滑动
      if (deltaX > 0) {
        currentOffsetRef.current = deltaX
        setOffset(deltaX)
      }
    }

    const handleTouchEnd = () => {
      finishSwipe()
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd)

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, edgeWidth, finishSwipe]) // 移除 offset 依赖，使用 ref 存储偏移量

  // 非移动端直接返回 children
  if (!isMobile) {
    return <>{children}</>
  }

  return (
    <div
      ref={containerRef}
      style={{
        transform: `translateX(${offset}px)`,
        transition: isAnimating ? 'transform 0.3s ease-out' : 'none',
      }}
    >
      {children}
    </div>
  )
}