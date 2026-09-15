import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export interface GuideStep {
  element: string
  title: string
  description: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

interface GuideOverlayProps {
  steps: GuideStep[]
  currentStep: number
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

export function GuideOverlay({ steps, currentStep, onNext, onPrev, onClose }: GuideOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const popoverRef = useRef<HTMLDivElement>(null)
  const step = steps[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === steps.length - 1

  const updatePosition = useCallback(() => {
    const el = document.querySelector(step.element) as HTMLElement | null
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect(r)

    requestAnimationFrame(() => {
      const pop = popoverRef.current
      if (!pop) return
      const popRect = pop.getBoundingClientRect()
      const side = step.side || 'bottom'
      const align = step.align || 'center'
      const GAP = 12

      let top = 0
      let left = 0

      if (side === 'bottom') {
        top = r.bottom + GAP
      } else if (side === 'top') {
        top = r.top - popRect.height - GAP
      } else if (side === 'left') {
        top = r.top + r.height / 2 - popRect.height / 2
        left = r.left - popRect.width - GAP
      } else if (side === 'right') {
        top = r.top + r.height / 2 - popRect.height / 2
        left = r.right + GAP
      }

      if (side === 'top' || side === 'bottom') {
        if (align === 'start') left = r.left
        else if (align === 'end') left = r.right - popRect.width
        else left = r.left + r.width / 2 - popRect.width / 2
      }

      const vw = window.innerWidth
      const vh = window.innerHeight
      left = Math.max(8, Math.min(left, vw - popRect.width - 8))
      top = Math.max(8, Math.min(top, vh - popRect.height - 8))

      setPopoverPos({ top, left })
    })
  }, [step.element, step.side, step.align])

  useEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const highlightStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: rect.top - 4,
        left: rect.left - 4,
        width: rect.width + 8,
        height: rect.height + 8,
        borderRadius: 8,
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
        zIndex: 999999,
        transition: 'all 0.3s ease',
      }
    : { display: 'none' }

  return createPortal(
    <div className="fixed inset-0" style={{ zIndex: 999998 }}>
      {/* Highlight mask */}
      <div style={highlightStyle} />

      {/* Popover */}
      <div
        ref={popoverRef}
        className="fixed w-72"
        style={{ top: popoverPos.top, left: popoverPos.left, zIndex: 1000000, transition: 'all 0.3s ease' }}
      >
        <Card className="gap-3 py-4 shadow-lg">
          <CardHeader className="gap-0 pb-0">
            <CardTitle className="text-sm">{step.title}</CardTitle>
            <CardDescription className="mt-1 text-xs leading-relaxed">{step.description}</CardDescription>
          </CardHeader>
          <CardFooter className="flex items-center justify-between pt-0">
            <span className="text-xs text-muted-foreground">{currentStep + 1} / {steps.length}</span>
            <div className="flex items-center gap-2">
              {!isFirst && (
                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs" onClick={onPrev}>
                  上一步
                </Button>
              )}
              <Button size="sm" className="h-7 px-3 text-xs" onClick={isLast ? onClose : onNext}>
                {isLast ? '知道了' : '下一步'}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 rounded-full p-1.5 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        style={{ zIndex: 1000001 }}
      >
        <X className="h-5 w-5" />
      </button>
    </div>,
    document.body
  )
}
