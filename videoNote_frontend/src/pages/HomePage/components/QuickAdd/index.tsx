import { useState } from 'react'
import { Sparkles, Link, SlidersHorizontal, Compass, Upload, Cloud, Clipboard, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { videoPlatforms } from '@/constant/note.ts'
import { SummarySettings } from '@/components/SummarySettings'

type TabType = 'link' | 'explore' | 'upload' | 'cloud'

interface QuickAddProps {
  className?: string
}

export function QuickAdd({ className }: QuickAddProps) {
  const [activeTab, setActiveTab] = useState<TabType>('link')
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className={cn("flex flex-col items-center justify-center h-full gap-6 p-8", className)}>
      {/* 标题区域 */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold bg-gradient-to-r from-[#FF6B9D] to-[#9B59B6] bg-clip-text text-transparent">
          VideoNote
        </h1>
        <p className="text-lg text-foreground">
          让你的音视频看得快，搜得到，用得好
        </p>
      </div>

      {/* 标签容器 */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1.5 bg-muted p-1.5 rounded-md">
          <TabButton
            icon={<Link className="w-4 h-4" />}
            label="链接"
            isActive={activeTab === 'link'}
            onClick={() => setActiveTab('link')}
          />
          <TabButton
            icon={<Compass className="w-4 h-4" />}
            label="探索"
            isActive={activeTab === 'explore'}
            onClick={() => setActiveTab('explore')}
          />
          <TabButton
            icon={<Upload className="w-4 h-4" />}
            label="上传"
            isActive={activeTab === 'upload'}
            onClick={() => setActiveTab('upload')}
          />
          <TabButton
            icon={<Cloud className="w-4 h-4" />}
            label="网盘"
            isActive={activeTab === 'cloud'}
            onClick={() => setActiveTab('cloud')}
          />
        </div>
      </div>

      {/* 输入框容器 */}
      <div className="w-full max-w-[800px] flex flex-col gap-4">
        <div className="flex flex-col border-2 border-border rounded-xl bg-background overflow-hidden">
          {/* 输入框 */}
          <div className="p-4">
            <textarea
              placeholder="请输入视频网站链接"
              className="w-full h-20 resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
            />
          </div>

          {/* 操作栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-4">
              <button
                className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground transition-colors"
                onClick={() => setSettingsOpen(true)}
              >
                <SlidersHorizontal className="w-4 h-4" />
                总结设置
              </button>
              <button className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground transition-colors">
                <Sparkles className="w-4 h-4" />
                默认模型
              </button>
              {/* 平台选择下拉器 */}
              <Select>
                <SelectTrigger className="w-auto h-auto border-0 bg-transparent p-0 gap-1.5 text-sm text-foreground hover:text-foreground focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                  <SelectValue placeholder="平台选择" />
                </SelectTrigger>
                <SelectContent>
                  {videoPlatforms?.map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4">{p.logo()}</div>
                        <span>{p.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 text-sm text-foreground hover:text-foreground transition-colors">
                <Clipboard className="w-4 h-4" />
                快速粘贴
              </button>
            </div>
          </div>
        </div>

        {/* 生成笔记按钮 */}
        <div className="flex justify-center">
          <Button
            className="w-[280px] h-12 rounded-3xl bg-foreground text-primary-foreground hover:bg-foreground/90 flex items-center gap-2 text-base font-medium"
          >
            <Sparkles className="w-5 h-5" />
            生成笔记
          </Button>
        </div>

        {/* 底部链接 */}
        <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Zap className="w-4 h-4" />
            热门链接
          </button>
          <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
            <Link className="w-4 h-4" />
            批量链接
          </button>
        </div>
      </div>

      {/* 总结设置对话框 */}
      <SummarySettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

interface TabButtonProps {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}

function TabButton({ icon, label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-normal transition-all",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "bg-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}
