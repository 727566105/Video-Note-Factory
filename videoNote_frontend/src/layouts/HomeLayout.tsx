import React, { FC, useState } from 'react'
import { LogOut, SlidersHorizontal } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import TaskStatusBar from '@/components/TaskStatusBar.tsx'
import logo from '@/assets/logo.png'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface IProps {
  NoteForm: React.ReactNode
  Preview: React.ReactNode
  History: React.ReactNode
}

const HomeLayout: FC<IProps> = ({ NoteForm, Preview, History }) => {
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  const navigate = useNavigate()
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 移动端顶部导航栏 */}
      <header className="flex h-12 items-center justify-between border-b border-neutral-200 bg-white px-3 md:h-14 md:px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg md:h-8 md:w-8">
            <img src={logo} alt="logo" className="h-full w-full object-contain" />
          </div>
          <div className="text-base font-bold text-gray-800 md:text-lg">videoNote <span className="text-xs font-normal text-gray-400">v2.5.1</span></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-gray-500 md:inline">{user?.username}</span>
          <Link to={'/settings'}>
            <SlidersHorizontal className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary md:h-5 md:w-5" />
          </Link>
          <button onClick={() => setLogoutDialogOpen(true)} title="退出登录">
            <LogOut className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-red-500 md:h-5 md:w-5" />
          </button>
        </div>
      </header>

      {/* 三栏布局 */}
      <TaskStatusBar />
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板 - 笔记表单 */}
        <div className="shrink-0 flex flex-col border-r border-neutral-200 bg-white w-full md:w-80 lg:w-96">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="p-3 md:p-4">{NoteForm}</div>
          </div>
        </div>

        {/* 中间面板 - 历史记录 */}
        <div className="shrink-0 flex flex-col border-r border-neutral-200 bg-white w-full md:w-64 lg:w-80">
          <div className="flex-1 min-h-0 overflow-hidden">{History}</div>
        </div>

        {/* 右侧面板 - 预览 */}
        <div className="flex flex-1 flex-col bg-white">
          <div className="flex-1 min-h-0 overflow-hidden">{Preview}</div>
        </div>
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

export default HomeLayout