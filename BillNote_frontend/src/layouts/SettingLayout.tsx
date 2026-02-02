import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import { Link, Outlet } from 'react-router-dom'
import { SlidersHorizontal, Menu as MenuIcon, X } from 'lucide-react'
import React, { useState } from 'react'
import logo from '@/assets/icon.svg'
import { Button } from '@/components/ui/button'

interface ISettingLayoutProps {
  Menu: React.ReactNode
}

const SettingLayout = ({ Menu }: ISettingLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: 'var(--color-muted)',
      }}
    >
      {/* 移动端顶部导航栏 */}
      <header className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl">
            <img src={logo} alt="logo" className="h-full w-full object-contain" />
          </div>
          <div className="text-lg font-bold text-gray-800">设置</div>
        </div>
        <Link to={'/'}>
          <SlidersHorizontal className="h-5 w-5 cursor-pointer text-muted-foreground hover:text-primary" />
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100% - 3.5rem)' }}>
        {/* 移动端侧边栏 - 可折叠 */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[280px] transform border-r border-neutral-200 bg-white transition-transform duration-300 ease-in-out
            lg:relative lg:z-0 lg:w-[300px] lg:translate-x-0
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
          style={{ top: '3.5rem', height: 'calc(100% - 3.5rem)' }}
        >
          {/* 桌面端 Header */}
          <header className="hidden h-16 items-center justify-between border-b px-6 lg:flex">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl">
                <img src={logo} alt="logo" className="h-full w-full object-contain" />
              </div>
              <div className="text-2xl font-bold text-gray-800">BiliNote</div>
            </div>
            <div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Link to={'/'}>
                      <SlidersHorizontal className="cursor-pointer text-muted-foreground hover:text-primary" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>返回首页</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </header>

          {/* 菜单内容 */}
          <div className="h-full overflow-auto p-4 lg:h-[calc(100%-4rem)]">
            <div onClick={() => setMobileMenuOpen(false)}>{Menu}</div>
          </div>
        </aside>

        {/* 遮罩层 - 仅移动端 */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            style={{ top: '3.5rem' }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* 右侧内容区域 */}
        <main className="h-full flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default SettingLayout
