// components/LazyImage.tsx
import { useInView } from 'react-intersection-observer'
import { FC, useState, useEffect, useRef } from 'react'
import clsx from 'clsx'

interface LazyImageProps {
    src: string
    alt?: string
    className?: string
    placeholder?: string
    maxRetries?: number
}

const LazyImage: FC<LazyImageProps> = ({
    src,
    alt,
    className,
    placeholder = '/placeholder.png',
    maxRetries = 2
}) => {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState(false)
    const [imgSrc, setImgSrc] = useState<string>(placeholder)
    const retryCount = useRef(0)
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (inView && src) {
            setImgSrc(src)
            setError(false)
            setLoaded(false)
            retryCount.current = 0
        }
    }, [inView, src])

    // 清理定时器
    useEffect(() => {
        return () => {
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current)
            }
        }
    }, [])

    const handleError = () => {
        if (retryCount.current < maxRetries) {
            // 重试：添加时间戳避免缓存
            retryCount.current += 1
            const separator = src.includes('?') ? '&' : '?'
            const retrySrc = `${src}${separator}_retry=${retryCount.current}_${Date.now()}`
            console.log(`图片加载重试 (${retryCount.current}/${maxRetries}):`, retrySrc)

            retryTimeoutRef.current = setTimeout(() => {
                setImgSrc(retrySrc)
            }, 500) // 500ms 后重试
        } else {
            // 超过重试次数，显示占位图
            console.error('图片加载失败，已达到最大重试次数:', src)
            setError(true)
            setImgSrc(placeholder)
        }
    }

    return (
        <div ref={ref} className="h-10 w-12 flex-shrink-0">
            <img
                src={error ? placeholder : imgSrc}
                alt={alt || '封面'}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={handleError}
                className="h-full w-full rounded-md object-cover"
                style={{
                    display: 'block',
                    opacity: loaded || error ? 1 : 0.5,
                    transition: 'opacity 0.3s ease-in-out',
                    backgroundColor: '#f3f4f6'
                }}
            />
        </div>
    )
}

export default LazyImage
