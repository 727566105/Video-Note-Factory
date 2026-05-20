import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu as MenuIcon, X } from 'lucide-react'
import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ISettingLayoutProps {
  Menu: React.ReactNode
}

const SettingLayout = ({ Menu }: ISettingLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen w-full flex-col bg-muted">

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={`
            shrink-0 w-[280px] border-r border-border bg-background transition-all duration-300 ease-in-out
            lg:block lg:w-[375px]
            ${mobileMenuOpen ? 'block' : 'hidden'}
          `}
        >
          {/* 侧边栏顶部：移动端菜单按钮 + 用户 dropdown */}
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <MenuIcon className="size-5" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors">
                  <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <span className="text-xs font-medium">{user?.username?.slice(0, 2) || 'U'}</span>
                  </div>
                  <span className="hidden md:inline">{user?.username}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setLogoutDialogOpen(true)} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 size-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* 菜单内容 */}
          <div className="h-full overflow-auto p-4">
            <div onClick={() => setMobileMenuOpen(false)}>{Menu}</div>
          </div>
        </aside>

        {/* 遮罩层 - 仅移动端 */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* 右侧内容区域 */}
        <main className="flex-1 overflow-auto bg-background">
          <Outlet />
        </main>
      </div>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>退出登录</DialogTitle>
            <DialogDescription>确定要退出登录吗？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={() => { setLogoutDialogOpen(false); handleLogout() }}>确认退出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SettingLayout
