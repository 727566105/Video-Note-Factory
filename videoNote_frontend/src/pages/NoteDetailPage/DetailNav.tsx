import { cn } from '@/lib/utils'
import { useState } from 'react'

type NavKey = 'summary' | 'custom' | 'learn' | 'create' | 'upload' | 'help'

const navItems: { key: NavKey; label: string }[] = [
  { key: 'summary', label: '总结' },
  { key: 'custom', label: '自定义' },
  { key: 'learn', label: '学习' },
  { key: 'create', label: '创作' },
]

const bottomItems: { key: NavKey; label: string }[] = [
  { key: 'upload', label: '上传' },
  { key: 'help', label: '帮助' },
]

const icons: Record<NavKey, React.ReactNode> = {
  summary: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  ),
  custom: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  learn: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 5 9 5 12 0v-5" />
    </svg>
  ),
  create: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  help: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
}

export default function DetailNav() {
  const [active, setActive] = useState<NavKey>('summary')

  return (
    <div className="w-16 h-full flex flex-col items-center py-4 bg-background/95 backdrop-blur border-l border-border">
      {/* 顶部导航 */}
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <button
            key={item.key}
            onClick={() => setActive(item.key)}
            className={cn(
              'flex flex-col items-center justify-center w-12 h-14 rounded-xl transition-colors',
              active === item.key
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            )}
          >
            {icons[item.key]}
            <span className="text-[10px] mt-1">{item.label}</span>
          </button>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="w-8 h-px bg-border my-2" />

      {/* 底部导航 */}
      <div className="flex flex-col gap-1">
        {bottomItems.map((item) => (
          <button
            key={item.key}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            {icons[item.key]}
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </button>
        ))}
      </div>

      {/* 活跃指示条 */}
      {active === 'summary' && (
        <div className="absolute right-0 top-[52px] w-0.5 h-16 bg-pink-400 rounded-full" />
      )}
    </div>
  )
}