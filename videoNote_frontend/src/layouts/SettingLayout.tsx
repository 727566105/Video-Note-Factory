import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import React from 'react'
import { Cloud, Info, Server, Download, UserCog, ListTodo, Bell } from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { useAuthStore } from '@/store/authStore'

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

const SettingLayout = () => {
  const [mounted, setMounted] = React.useState(false)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const isAdmin = useAuthStore(state => state.isAdmin())

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isInSubSetting = location.pathname !== '/settings' && location.pathname.startsWith('/settings')

  if (!mounted) {
    return <div className="flex h-full items-center justify-center bg-background">
      <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  }

  // 桌面端访问 /settings 时重定向到 about
  if (!isMobile && !isInSubSetting) {
    return <Navigate to="/settings/about" replace />
  }

  // 移动端：设置根目录显示列表
  if (isMobile && !isInSubSetting) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 overflow-auto p-4">
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

  // 桌面端子页面 / 移动端子页面：直接显示内容
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}

export default SettingLayout
