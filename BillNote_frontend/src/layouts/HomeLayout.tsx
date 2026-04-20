import React, { FC } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Link } from 'react-router-dom'

import logo from '@/assets/icon.svg'

interface IProps {
  NoteForm: React.ReactNode
  Preview: React.ReactNode
  History: React.ReactNode
}

const HomeLayout: FC<IProps> = ({ NoteForm, Preview, History }) => {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* 移动端顶部导航栏 */}
      <header className="flex h-12 items-center justify-between border-b border-neutral-200 bg-white px-3 md:h-14 md:px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg md:h-8 md:w-8">
            <img src={logo} alt="logo" className="h-full w-full object-contain" />
          </div>
          <div className="text-base font-bold text-gray-800 md:text-lg">Video Note Factory</div>
        </div>
        <Link to={'/settings'}>
          <SlidersHorizontal className="h-4 w-4 cursor-pointer text-muted-foreground hover:text-primary md:h-5 md:w-5" />
        </Link>
      </header>

      {/* 三栏布局 */}
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
    </div>
  )
}

export default HomeLayout