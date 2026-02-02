// components/LazyImage.tsx
import { useInView } from 'react-intersection-observer'
import { FC, useState, useEffect } from 'react'
import clsx from 'clsx'

interface LazyImageProps {
    src: string
    alt?: string
    className?: string
    placeholder?: string
}

const LazyImage: FC<LazyImageProps> = ({ src, alt, className, placeholder = '/placeholder.png' }) => {
    const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState(false)
    const [imgSrc, setImgSrc] = useState<string>(placeholder)

    useEffect(() => {
        if (inView && src) {
            setImgSrc(src)
        }
    }, [inView, src])

    return (
        <div ref={ref} className="h-10 w-12 flex-shrink-0">
            <img
                src={error ? placeholder : imgSrc}
                alt={alt || '封面'}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={() => {
                    console.error('Image load error:', imgSrc)
                    setError(true)
                    setImgSrc(placeholder)
                }}
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
