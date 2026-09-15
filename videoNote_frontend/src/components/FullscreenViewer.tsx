import { useState, useRef, useEffect, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FullscreenViewerProps {
  open: boolean
  onClose: () => void
  images: string[]
  livePhotos?: { index: number; video_url: string }[]
  initialIndex?: number
}

export function FullscreenViewer({ open, onClose, images, livePhotos = [], initialIndex = 0 }: FullscreenViewerProps) {
  const [current, setCurrent] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isPlaying, setIsPlaying] = useState(false)
  const [pressTimer, setPressTimer] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 切换图片时重置缩放
  useEffect(() => {
    if (open) {
      setCurrent(initialIndex)
      setScale(1)
      setTranslate({ x: 0, y: 0 })
      setIsPlaying(false)
    }
  }, [open, initialIndex])

  const total = images.length
  const livePhoto = livePhotos.find(lp => lp.index === current + 1)
  const isLivePhoto = !!livePhoto

  const goNext = useCallback(() => {
    if (current < total - 1) {
      setCurrent(c => c + 1)
      setScale(1)
      setTranslate({ x: 0, y: 0 })
      setIsPlaying(false)
    }
  }, [current, total])

  const goPrev = useCallback(() => {
    if (current > 0) {
      setCurrent(c => c - 1)
      setScale(1)
      setTranslate({ x: 0, y: 0 })
      setIsPlaying(false)
    }
  }, [current])

  const handleZoom = (delta: number) => {
    setScale(s => Math.max(0.5, Math.min(s + delta, 5)))
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.2 : 0.2
    handleZoom(delta)
  }

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (scale <= 1) return
    const point = 'touches' in e ? e.touches[0] : e
    setIsDragging(true)
    setDragStart({ x: point.clientX - translate.x, y: point.clientY - translate.y })
  }

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return
    const point = 'touches' in e ? e.touches[0] : e
    setTranslate({
      x: point.clientX - dragStart.x,
      y: point.clientY - dragStart.y,
    })
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  // 实况照片长按播放
  const handlePressStart = () => {
    if (!isLivePhoto) return
    const timer = window.setTimeout(() => {
      setIsPlaying(true)
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play()
      }
    }, 200)
    setPressTimer(timer)
  }

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer)
      setPressTimer(null)
    }
    if (isPlaying) {
      setIsPlaying(false)
      if (videoRef.current) {
        videoRef.current.pause()
      }
    }
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handleEnded = () => {
      setIsPlaying(false)
      video.currentTime = 0
    }
    video.addEventListener('ended', handleEnded)
    return () => video.removeEventListener('ended', handleEnded)
  }, [current])

  // 键盘导航
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === '+' || e.key === '=') handleZoom(0.3)
      else if (e.key === '-') handleZoom(-0.3)
      else if (e.key === '0') { setScale(1); setTranslate({ x: 0, y: 0 }) }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, goNext, goPrev])

  // 双击切换缩放
  const handleDoubleClick = () => {
    if (scale > 1) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
    } else {
      setScale(2.5)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="w-screen h-screen max-w-none p-0 bg-black border-none rounded-none [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* 顶部工具栏 */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
          <span className="text-white/80 text-sm font-medium">
            {current + 1} / {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleZoom(-0.3)}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleZoom(0.3)}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 图片区域 */}
        <div
          ref={containerRef}
          className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onMouseDown={(e) => { handleDragStart(e); handlePressStart() }}
          onMouseMove={handleDragMove}
          onMouseUp={(e) => { handleDragEnd(e); handlePressEnd() }}
          onMouseLeave={() => { handleDragEnd(); handlePressEnd() }}
          onTouchStart={(e) => { handleDragStart(e); handlePressStart() }}
          onTouchMove={handleDragMove}
          onTouchEnd={(e) => { handleDragEnd(e); handlePressEnd() }}
          onDoubleClick={handleDoubleClick}
        >
          <img
            src={images[current]}
            alt=""
            className="max-w-full max-h-full object-contain select-none pointer-events-none"
            style={{
              transform: `scale(${scale}) translate(${translate.x / scale}px, ${translate.y / scale}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
            draggable={false}
          />

          {/* 实况照片视频层 */}
          {isLivePhoto && (
            <video
              ref={videoRef}
              src={livePhoto.video_url}
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                opacity: isPlaying ? 1 : 0,
                transition: 'opacity 0.3s',
              }}
              muted
              playsInline
              loop={false}
            />
          )}
        </div>

        {/* 实况照片提示 */}
        {isLivePhoto && (
          <>
            <div className={cn(
              'absolute top-14 left-4 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-medium transition-opacity z-20',
              isPlaying ? 'opacity-0' : 'opacity-100'
            )}>
              LIVE
            </div>
            {!isPlaying && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-xs text-white/70 bg-black/40 px-2 py-1 rounded z-20">
                长按播放实况照片
              </div>
            )}
          </>
        )}

        {/* 左右箭头 */}
        {current > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {current < total - 1 && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full bg-black/30 hover:bg-black/50 text-white transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
