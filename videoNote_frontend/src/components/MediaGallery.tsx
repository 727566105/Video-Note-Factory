import { useState, useRef, useEffect, useCallback } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import type { Swiper as SwiperType } from 'swiper'
import { Navigation, Pagination } from 'swiper/modules'
import { cn } from '@/lib/utils'
import { getBaseURL } from '@/utils/api'
import request from '@/utils/request'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'

interface MediaGalleryProps {
  taskId: string
  contentType: 'article' | 'live_photo'
  className?: string
}

interface MediaData {
  content_type: string
  images: string[]
  live_photos: { index: number; video_url: string }[]
  cover_url: string
}

export function MediaGallery({ taskId, contentType, className }: MediaGalleryProps) {
  const [mediaData, setMediaData] = useState<MediaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const swiperRef = useRef<HTMLDivElement>(null)
  const swiperInstance = useRef<SwiperType | null>(null)

  const goNext = useCallback(() => swiperInstance.current?.slideNext(), [])
  const goPrev = useCallback(() => swiperInstance.current?.slidePrev(), [])

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        setLoading(true)
        const data = await request.get<MediaData>(`/note_media/${taskId}`)
        setMediaData(data)
        setError(null)
      } catch (err) {
        setError('加载媒体失败')
        console.error('Failed to fetch media:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [taskId])

  if (loading) {
    return (
      <div className={cn('flex flex-col gap-3 p-4', className)}>
        <div className="w-full aspect-[4/3] bg-muted rounded-lg animate-pulse" />
        <div className="w-full aspect-[4/3] bg-muted rounded-lg animate-pulse" />
        <div className="w-full aspect-[4/3] bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  if (error || !mediaData) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <span className="text-muted-foreground text-sm">{error || '无媒体数据'}</span>
      </div>
    )
  }

  if (mediaData.images.length === 0) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <span className="text-muted-foreground text-sm">暂无图片</span>
      </div>
    )
  }

  const isLivePhoto = mediaData.content_type === 'live_photo' && mediaData.live_photos.length > 0
  const total = mediaData.images.length
  const showNavigation = total > 1

  const pagClass = `media-pag-${taskId}`

  return (
    <div ref={swiperRef} className={cn('relative group/media', className)}>
      <Swiper
        modules={[Pagination]}
        pagination={{
          el: `.${pagClass}`,
          type: 'bullets',
          bulletClass: 'media-pagination-dot',
          bulletActiveClass: 'media-pagination-dot-active',
          clickable: true,
        }}
        onSwiper={(swiper) => { swiperInstance.current = swiper }}
        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
        className="media-swiper rounded-lg"
        loop={total > 2}
        slidesPerView={1}
        spaceBetween={0}
      >
        {mediaData.images.map((imageUrl, idx) => {
          const livePhoto = mediaData.live_photos.find(lp => lp.index === idx + 1)
          const fullUrl = imageUrl.startsWith('/') ? `${getBaseURL()}${imageUrl}` : imageUrl

          return (
            <SwiperSlide key={idx}>
              <LivePhotoItem
                imageUrl={fullUrl}
                videoUrl={livePhoto?.video_url ? (livePhoto.video_url.startsWith('/') ? `${getBaseURL()}${livePhoto.video_url}` : livePhoto.video_url) : null}
                isLivePhoto={isLivePhoto && !!livePhoto}
              />
            </SwiperSlide>
          )
        })}
      </Swiper>

      {/* 分数指示器 */}
      <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-black/50 text-white text-xs font-medium backdrop-blur-sm">
        {activeIndex + 1}/{total}
      </div>

      {/* 左箭头 */}
      {showNavigation && activeIndex > 0 && (
        <div
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/media:opacity-100 transition-opacity cursor-pointer"
          onClick={goPrev}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </div>
        </div>
      )}

      {/* 右箭头 */}
      {showNavigation && activeIndex < total - 1 && (
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover/media:opacity-100 transition-opacity cursor-pointer"
          onClick={goNext}
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur-sm transition-colors">
            <ChevronRight className="w-5 h-5" />
          </div>
        </div>
      )}

      {/* 底部分页圆点 */}
      {showNavigation && (
        <div className={cn(pagClass, 'flex items-center justify-center gap-1.5 mt-2')} />
      )}
    </div>
  )
}

interface LivePhotoItemProps {
  imageUrl: string
  videoUrl: string | null
  isLivePhoto: boolean
}

function LivePhotoItem({ imageUrl, videoUrl, isLivePhoto }: LivePhotoItemProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [pressTimer, setPressTimer] = useState<number | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const handlePressStart = () => {
    if (!isLivePhoto || !videoUrl) return
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
  }, [])

  return (
    <div
      className="relative w-full aspect-[4/3] bg-muted select-none"
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      onTouchCancel={handlePressEnd}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
    >
      <img
        src={imageUrl}
        alt="图片"
        className={cn(
          'w-full h-full object-contain transition-opacity duration-300',
          isPlaying ? 'opacity-0' : 'opacity-100'
        )}
        loading="lazy"
      />

      {isLivePhoto && videoUrl && (
        <video
          ref={videoRef}
          src={videoUrl}
          className={cn(
            'absolute inset-0 w-full h-full object-contain transition-opacity duration-300',
            isPlaying ? 'opacity-100' : 'opacity-0'
          )}
          muted
          playsInline
          loop={false}
        />
      )}

      {isLivePhoto && (
        <div className={cn(
          'absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-medium transition-opacity',
          isPlaying ? 'opacity-0' : 'opacity-100'
        )}>
          LIVE
        </div>
      )}

      {isLivePhoto && !isPlaying && (
        <div className="absolute bottom-2 right-2 text-xs text-white/70 bg-black/40 px-1.5 py-0.5 rounded">
          长按播放
        </div>
      )}
    </div>
  )
}
