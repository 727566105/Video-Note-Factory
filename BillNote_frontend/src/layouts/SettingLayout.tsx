import { Link, Outlet } from 'react-router-dom'
import { ArrowLeft, Menu as MenuIcon, X } from 'lucide-react'
import React, { useState } from 'react'
import logo from '@/assets/logo.png'
import { Button } from '@/components/ui/button'

interface ISettingLayoutProps {
  Menu: React.ReactNode
}

const SettingLayout = ({ Menu }: ISettingLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen w-full flex-col" style={{ backgroundColor: 'var(--color-muted)' }}>
      {/* 顶部导航栏 - 全平台可见 */}
      <header className="flex h-12 items-center justify-between border-b border-neutral-200 bg-white px-3 md:h-14 md:px-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </Button>
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg md:h-8 md:w-8">
            <img src={logo} alt="logo" className="h-full w-full object-contain" />
          </div>
          <div className="text-base font-bold text-gray-800 md:text-lg">设置</div>
        </div>
        <Link to={'/'}>
          <ArrowLeft className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary md:h-5 md:w-5" />
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <aside
          className={`
            shrink-0 w-[280px] border-r border-neutral-200 bg-white transition-all duration-300 ease-in-out
            lg:block lg:w-[375px]
            ${mobileMenuOpen ? 'block' : 'hidden'}
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
        <main className="flex-1 overflow-auto bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default SettingLayout
