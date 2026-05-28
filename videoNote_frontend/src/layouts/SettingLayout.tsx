import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import React from 'react'
import { Menu as MenuIcon, ArrowLeft, Server, Download, Settings, Cloud, Info, UserCog, ListTodo, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuthStore } from '@/store/authStore'

interface ISettingLayoutProps {
  Menu: React.ReactNode
}

// 移动端设置菜单项（普通用户可访问）
const mobileSettingItems = [
  { path: '/settings/siyuan', label: '思源笔记', icon: <Cloud className="size-4" /> },
  { path: '/settings/webdav', label: 'WebDAV 备份', icon: <Cloud className="size-4" /> },
  { path: '/settings/about', label: '关于', icon: <Info className="size-4" /> },
]

// 管理员设置菜单项（需要管理员权限）
const adminSettingItems = [
  { path: '/settings/model', label: '模型设置', icon: <Server className="size-4" /> },
  { path: '/settings/download', label: '下载配置', icon: <Download className="size-4" /> },
  { path: '/settings/subscription', label: '订阅设置', icon: <Bell className="size-4" /> },
  { path: '/settings/users', label: '用户管理', icon: <UserCog className="size-4" /> },
  { path: '/settings/taskqueue', label: '任务队列', icon: <ListTodo className="size-4" /> },
]

const SettingLayout = ({ Menu }: ISettingLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useAuthStore(state => state.isAdmin())

  // 等待组件挂载后再判断 isMobile（避免 SSR/初始状态问题）
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // 判断是否在设置子页面（不是设置根目录）
  const isInSubSetting = location.pathname !== '/settings' && location.pathname.startsWith('/settings')

  // 未挂载时显示加载状态
  if (!mounted) {
    return <div className="flex h-full items-center justify-center bg-background">
      <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  }

  // 移动端：直接显示设置列表（SiteHeader 会显示标题）
  if (isMobile) {
    // 如果在设置根目录，显示设置列表
    if (!isInSubSetting) {
      return (
        <div className="flex flex-col h-full bg-background">
          {/* 设置列表 */}
          <div className="flex-1 overflow-auto p-4">
            {/* 基础设置 */}
            <div className="space-y-1">
              {mobileSettingItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            {/* 管理员设置 */}
            {isAdmin && (
              <div className="mt-4">
                <h3 className="text-xs text-muted-foreground px-4 mb-2">管理员</h3>
                <div className="space-y-1">
                  {adminSettingItems.map((item) => (
                    <button
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      className="flex items-center gap-3 w-full px-4 py-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        {item.icon}
                      </div>
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )
    }

    // 如果在子设置页面，显示子页面内容（SiteHeader 会显示返回按钮和标题）
    return (
      <div className="flex flex-col h-full bg-background">
        {/* 子页面内容 */}
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    )
  }

  // 桌面端：原有布局
  // 桌面端访问 /settings 时重定向到 about
  if (!isMobile && !isInSubSetting) {
    return <Navigate to="/settings/about" replace />
  }

  return (
    <div className="flex h-full w-full flex-col bg-muted">
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={`
            shrink-0 w-[280px] border-r border-border bg-background transition-all duration-300 ease-in-out
            lg:block lg:w-[375px]
            ${mobileMenuOpen ? 'block fixed inset-y-0 left-0 z-50' : 'hidden'}
          `}
        >
          <div className="h-full overflow-auto p-4">
            <div onClick={() => setMobileMenuOpen(false)}>{Menu}</div>
          </div>
        </aside>

        {/* 遮罩层 */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* 右侧内容区域 */}
        <main className="flex-1 overflow-auto bg-background">
          <div className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-border bg-background sticky top-0 z-30">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} aria-label="打开设置菜单">
              <MenuIcon className="size-5" />
            </Button>
            <span className="font-medium">设置</span>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default SettingLayout