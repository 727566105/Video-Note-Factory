import { useNavigate, useLocation } from 'react-router-dom'
import { Home, NotebookPen, Rss, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { path: '/', label: '首页', icon: <Home className="size-5" /> },
  { path: '/notes', label: '笔记', icon: <NotebookPen className="size-5" /> },
  { path: '/feed', label: '动态', icon: <Rss className="size-5" /> },
  { path: '/settings', label: '设置', icon: <Settings className="size-5" /> },
]

export function MobileBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background border-t border-border",
        "flex items-center justify-around",
        "h-14 pb-[env(safe-area-inset-bottom)]",
        "md:hidden"
      )}
      role="tablist"
      aria-label="主导航"
    >
      {navItems.map((item) => (
        <button
          key={item.path}
          role="tab"
          aria-selected={isActive(item.path)}
          aria-label={item.label}
          onClick={() => navigate(item.path)}
          className={cn(
            "flex flex-col items-center justify-center",
            "flex-1 h-full",
            "transition-colors duration-200",
            isActive(item.path)
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {item.icon}
          <span className="text-xs mt-0.5">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}