import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedThemeMode = 'light' | 'dark'

type ThemeContextValue = {
  mode: ThemeMode
  resolvedMode: ResolvedThemeMode
  setMode: (mode: ThemeMode) => void
}

const THEME_STORAGE_KEY = 'videonote-theme-mode'
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const ThemeContext = createContext<ThemeContextValue | null>(null)

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system'
  }

  try {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(storedMode) ? storedMode : 'system'
  } catch {
    return 'system'
  }
}

function getSystemTheme(): ResolvedThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia(DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}

function applyTheme(resolvedMode: ResolvedThemeMode) {
  const root = document.documentElement
  root.classList.toggle('dark', resolvedMode === 'dark')
  root.style.colorScheme = resolvedMode

  const themeColor = resolvedMode === 'dark' ? '#2D2D2D' : '#F8FAFC'
  let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')

  if (!themeColorMeta) {
    themeColorMeta = document.createElement('meta')
    themeColorMeta.name = 'theme-color'
    document.head.appendChild(themeColorMeta)
  }

  themeColorMeta.content = themeColor
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getStoredThemeMode)
  const [systemMode, setSystemMode] = useState<ResolvedThemeMode>(getSystemTheme)

  const resolvedMode = mode === 'system' ? systemMode : mode

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY)
    const updateSystemMode = () => setSystemMode(mediaQuery.matches ? 'dark' : 'light')

    updateSystemMode()
    mediaQuery.addEventListener('change', updateSystemMode)

    return () => mediaQuery.removeEventListener('change', updateSystemMode)
  }, [])

  useEffect(() => {
    applyTheme(resolvedMode)
  }, [resolvedMode])

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode)

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode)
    } catch {
      // The visual mode still updates even when persistence is unavailable.
    }
  }, [])

  const value = useMemo(
    () => ({
      mode,
      resolvedMode,
      setMode,
    }),
    [mode, resolvedMode, setMode]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useThemeMode() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useThemeMode must be used within ThemeProvider')
  }

  return context
}
