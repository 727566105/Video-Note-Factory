import { Outlet } from 'react-router-dom'
import React, { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ISettingLayoutProps {
  Menu: React.ReactNode
}

const SettingLayout = ({ Menu }: ISettingLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
          {/* 移动端菜单触发按钮 */}
          <div className="lg:hidden flex items-center gap-2 px-4 py-3 border-b border-border bg-background sticky top-0 z-30">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} aria-label="打开设置菜单">
              <Menu className="size-5" />
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
