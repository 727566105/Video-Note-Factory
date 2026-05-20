import { Outlet } from 'react-router-dom'
import React, { useState } from 'react'

interface ISettingLayoutProps {
  Menu: React.ReactNode
}

const SettingLayout = ({ Menu }: ISettingLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    </div>
  )
}

export default SettingLayout
