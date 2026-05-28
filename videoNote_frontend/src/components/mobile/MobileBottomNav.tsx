import { useNavigate, useLocation } from 'react-router-dom'
import { Home, FolderOpen, Compass, NotebookPen, Library, Box, Rss, Activity, Flame, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

// 首页直接跳转，资源和探索弹出菜单
const mainNavItems: NavItem[] = [
  { path: '/', label: '首页', icon: <Home className="size-5" /> },
]

interface MenuItem {
  path: string
  label: string
  icon: React.ReactNode
}

interface MenuCategory {
  title: string
  items: MenuItem[]
}

export function MobileBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [resourceOpen, setResourceOpen] = useState(false)
  const [exploreOpen, setExploreOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(path)
  }

  const handleNavClick = (path: string) => {
    if (location.pathname !== path) {
      navigate(path)
    }
  }

  // 资源菜单
  const resourceItems: MenuItem[] = [
    { path: '/notes', label: '笔记列表', icon: <NotebookPen className="size-4" /> },
    { path: '/library', label: '资源库', icon: <Library className="size-4" /> },
    { path: '/output', label: '产出物', icon: <Box className="size-4" /> },
  ]

  // 探索菜单
  const exploreItems: MenuItem[] = [
    { path: '/feed', label: '动态', icon: <Rss className="size-4" /> },
    { path: '/channels', label: '频道管理', icon: <Activity className="size-4" /> },
    { path: '/hot', label: '热门', icon: <Flame className="size-4" /> },
    { path: '/authors', label: '博主', icon: <Users className="size-4" /> },
  ]

  // 判断资源/探索是否激活
  const isResourceActive = resourceItems.some(item => location.pathname.startsWith(item.path))
  const isExploreActive = exploreItems.some(item => location.pathname.startsWith(item.path))

  const handleMenuClick = (path: string) => {
    navigate(path)
    setResourceOpen(false)
    setExploreOpen(false)
  }

  return (
    <nav
      className={cn(
        "shrink-0",
        "bg-background border-t border-border",
        "flex items-center justify-around",
        "h-14 pb-[env(safe-area-inset-bottom)]",
        "md:hidden"
      )}
      role="tablist"
      aria-label="主导航"
    >
      {/* 首页 */}
      <button
        role="tab"
        aria-selected={isActive('/')}
        aria-label="首页"
        onClick={() => handleNavClick('/')}
        className={cn(
          "flex flex-col items-center justify-center",
          "flex-1 h-full",
          "transition-colors duration-200",
          "touch-manipulation",
          isActive('/')
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground active:text-primary"
        )}
      >
        <Home className="size-5" />
        <span className="text-xs mt-0.5">首页</span>
      </button>

      {/* 资源 - 弹出菜单 */}
      <Sheet open={resourceOpen} onOpenChange={setResourceOpen}>
        <SheetTrigger asChild>
          <button
            role="tab"
            aria-selected={isResourceActive}
            aria-label="资源"
            className={cn(
              "flex flex-col items-center justify-center",
              "flex-1 h-full",
              "transition-colors duration-200",
              "touch-manipulation",
              isResourceActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground active:text-primary"
            )}
          >
            <FolderOpen className="size-5" />
            <span className="text-xs mt-0.5">资源</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl px-4 pb-6">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="grid grid-cols-3 gap-3">
            {resourceItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleMenuClick(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center",
                  "py-4 px-2 rounded-xl",
                  "bg-muted/50 hover:bg-muted",
                  "transition-colors duration-200",
                  "touch-manipulation",
                  location.pathname.startsWith(item.path) && "bg-primary/10 text-primary"
                )}
              >
                {item.icon}
                <span className="text-xs mt-2">{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* 探索 - 弹出菜单 */}
      <Sheet open={exploreOpen} onOpenChange={setExploreOpen}>
        <SheetTrigger asChild>
          <button
            role="tab"
            aria-selected={isExploreActive}
            aria-label="探索"
            className={cn(
              "flex flex-col items-center justify-center",
              "flex-1 h-full",
              "transition-colors duration-200",
              "touch-manipulation",
              isExploreActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground active:text-primary"
            )}
          >
            <Compass className="size-5" />
            <span className="text-xs mt-0.5">探索</span>
          </button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-auto rounded-t-2xl px-4 pb-6">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
          <div className="grid grid-cols-4 gap-3">
            {exploreItems.map((item) => (
              <button
                key={item.path}
                onClick={() => handleMenuClick(item.path)}
                className={cn(
                  "flex flex-col items-center justify-center",
                  "py-4 px-2 rounded-xl",
                  "bg-muted/50 hover:bg-muted",
                  "transition-colors duration-200",
                  "touch-manipulation",
                  location.pathname.startsWith(item.path) && "bg-primary/10 text-primary"
                )}
              >
                {item.icon}
                <span className="text-xs mt-2">{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}