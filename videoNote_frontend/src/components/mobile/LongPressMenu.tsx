import { useState, useRef, useEffect } from 'react'

interface MenuItem {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  destructive?: boolean // 是否为危险操作（红色高亮）
}

interface LongPressMenuProps {
  children: React.ReactNode
  items: MenuItem[]
  onPress?: () => void // 短按回调
  delay?: number // 长按触发延迟，默认 500ms
}

/**
 * 长按操作菜单组件
 * 长按触发底部弹出菜单，短按触发 onPress 回调
 */
export function LongPressMenu({ children, items, onPress, delay = 500 }: LongPressMenuProps) {
  const [showMenu, setShowMenu] = useState(false)
  const pressTimerRef = useRef<number | null>(null)
  const isLongPressRef = useRef(false)

  const handleTouchStart = () => {
    isLongPressRef.current = false
    pressTimerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true
      setShowMenu(true)
    }, delay)
  }

  const handleTouchEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    // 如果不是长按，触发短按回调
    if (!isLongPressRef.current && onPress) {
      onPress()
    }
  }

  const handleTouchMove = () => {
    // 滑动时取消长按计时
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current)
      }
    }
  }, [])

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className="cursor-pointer"
      >
        {children}
      </div>

      {/* 菜单遮罩层 */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50 bg-black/50 animate-in fade-in duration-200"
          onClick={() => setShowMenu(false)}
        >
          {/* 底部菜单面板 */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-xl p-4 pb-[env(safe-area-inset-bottom)] animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2">
              {items.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    item.onClick()
                    setShowMenu(false)
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    item.destructive
                      ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
                      : 'hover:bg-accent'
                  }`}
                >
                  {item.icon && <span className="size-5">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            {/* 取消按钮 */}
            <button
              onClick={() => setShowMenu(false)}
              className="mt-2 w-full px-4 py-3 rounded-lg bg-accent text-center transition-colors hover:bg-accent/80"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </>
  )
}