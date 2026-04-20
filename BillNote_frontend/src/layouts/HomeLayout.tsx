import React, { FC } from 'react'
import { SlidersHorizontal, ChevronLeft, ChevronRight, History as HistoryIcon, FileText, Eye } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Button } from '@/components/ui/button'
import logo from '@/assets/icon.svg'

interface IProps {
  NoteForm: React.ReactNode
  Preview: React.ReactNode
  History: React.ReactNode
}

const HomeLayout: FC<IProps> = ({ NoteForm, Preview, History }) => {
  const [, setShowSettings] = useState(false)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [middlePanelCollapsed, setMiddlePanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)

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

      {/* 三栏布局 - 所有设备 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板 - 笔记表单 */}
        <div
          className={`relative shrink-0 flex flex-col border-r border-neutral-200 bg-white transition-all duration-300 ${
            leftPanelCollapsed ? 'w-0 md:w-12' : 'w-full md:w-80 lg:w-96'
          }`}
        >
          {!leftPanelCollapsed && (
            <>
              {/* 折叠按钮 - 展开状态 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-16 z-20 h-8 w-6 rounded-md border bg-white shadow-md hover:bg-gray-50"
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-3 py-2 md:px-4 md:py-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-gray-700">创建笔记</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-3 md:p-4">{NoteForm}</div>
              </div>
            </>
          )}

          {leftPanelCollapsed && (
            <>
              {/* 折叠按钮 - 收起状态 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-16 z-20 h-8 w-6 rounded-md border bg-white shadow-md hover:bg-gray-50"
                onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="hidden flex-col items-center gap-4 py-4 md:flex">
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
            </>
          )}
        </div>

        {/* 中间面板 - 历史记录 */}
        <div
          className={`relative shrink-0 flex flex-col border-r border-neutral-200 bg-white transition-all duration-300 ${
            middlePanelCollapsed ? 'w-0 md:w-12' : 'w-full md:w-64 lg:w-80'
          }`}
        >
          {!middlePanelCollapsed && (
            <>
              {/* 折叠按钮 - 展开状态 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-28 z-20 h-8 w-6 rounded-md border bg-white shadow-md hover:bg-gray-50"
                onClick={() => setMiddlePanelCollapsed(!middlePanelCollapsed)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-3 py-2 md:px-4 md:py-3">
                <HistoryIcon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-gray-700">历史记录</span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">{History}</div>
            </>
          )}

          {middlePanelCollapsed && (
            <>
              {/* 折叠按钮 - 收起状态 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -right-3 top-28 z-20 h-8 w-6 rounded-md border bg-white shadow-md hover:bg-gray-50"
                onClick={() => setMiddlePanelCollapsed(!middlePanelCollapsed)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="hidden flex-col items-center gap-4 py-4 md:flex">
                <HistoryIcon className="h-5 w-5 text-gray-400" />
              </div>
            </>
          )}
        </div>

        {/* 右侧面板 - 预览 */}
        <div
          className={`relative flex flex-1 flex-col bg-white transition-all duration-300 ${
            rightPanelCollapsed ? 'w-0 md:w-12' : ''
          }`}
        >
          {!rightPanelCollapsed && (
            <>
              {/* 折叠按钮 - 展开状态 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -left-3 top-40 z-20 h-8 w-6 rounded-md border bg-white shadow-md hover:bg-gray-50"
                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-3 py-2 md:px-4 md:py-3">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-gray-700">预览</span>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">{Preview}</div>
            </>
          )}

          {rightPanelCollapsed && (
            <>
              {/* 折叠按钮 - 收起状态 */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute -left-3 top-40 z-20 h-8 w-6 rounded-md border bg-white shadow-md hover:bg-gray-50"
                onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="hidden flex-col items-center gap-4 py-4 md:flex">
                <Eye className="h-5 w-5 text-gray-400" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default HomeLayout
