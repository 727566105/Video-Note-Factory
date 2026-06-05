import { Check, Monitor, Moon, Sun } from 'lucide-react'
import type { ComponentType } from 'react'
import { useThemeMode, type ThemeMode } from '@/components/ThemeProvider'

type ThemeOption = {
  value: ThemeMode
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const themeOptions: ThemeOption[] = [
  {
    value: 'system',
    label: '跟随系统',
    description: '自动匹配设备外观',
    icon: Monitor,
  },
  {
    value: 'light',
    label: '浅色',
    description: '明亮清爽的工作台',
    icon: Sun,
  },
  {
    value: 'dark',
    label: '深色',
    description: '柔和深灰，夜间更舒适',
    icon: Moon,
  },
]

export function ThemeModeSelector({ compact = false }: { compact?: boolean }) {
  const { mode, setMode, resolvedMode } = useThemeMode()

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className={compact ? 'flex items-center justify-between gap-3' : 'space-y-1'}>
        <div>
          <h2 className="text-sm font-semibold text-foreground">外观模式</h2>
          <p className="text-xs leading-5 text-muted-foreground">
            当前{resolvedMode === 'dark' ? '深色' : '浅色'}显示
          </p>
        </div>
      </div>

      <div className={compact ? 'grid grid-cols-3 gap-1' : 'grid gap-2'}>
        {themeOptions.map(option => {
          const Icon = option.icon
          const active = mode === option.value

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={[
                'group relative flex rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                compact
                  ? 'min-h-[66px] flex-col items-center justify-center gap-1.5 px-1.5 py-2'
                  : 'min-h-[72px] items-center gap-3 px-3 py-3',
                active
                  ? 'border-primary/55 bg-primary/10 text-foreground shadow-sm'
                  : 'border-border/70 bg-background/80 text-muted-foreground hover:border-primary/30 hover:bg-background hover:text-foreground',
              ].join(' ')}
            >
              <span
                className={[
                  'flex shrink-0 items-center justify-center rounded-lg transition-colors',
                  compact ? 'size-8' : 'size-9',
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-primary',
                ].join(' ')}
              >
                <Icon className="size-4" />
              </span>

              <span className={compact ? 'min-w-0 text-center' : 'min-w-0 flex-1'}>
                <span className={compact ? 'block whitespace-nowrap text-xs font-medium' : 'block text-sm font-medium'}>
                  {option.label}
                </span>
                {!compact && (
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </span>

              {active && !compact && (
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
