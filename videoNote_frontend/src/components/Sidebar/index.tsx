import { Sparkles, Edit, PanelLeftClose, Search, ChevronDown, Settings, StickyNote, Library, Box, Activity, Rss, Flame, FolderPlus, MoreHorizontal, NotebookPen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate, useLocation } from 'react-router-dom'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <aside className={cn("w-[280px] h-full bg-[#f6f6f6] flex flex-col gap-2 p-4", className)}>
      {/* 顶部标题区 */}
      <div className="flex items-center justify-between h-10">
        <div
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => navigate('/')}
        >
          <Sparkles className="w-5 h-5 text-foreground" />
          <span className="text-base font-semibold text-foreground">VideoNote</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1 hover:bg-accent rounded-md transition-colors">
            <Edit className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
          <button className="p-1 hover:bg-accent rounded-md transition-colors">
            <PanelLeftClose className="w-[18px] h-[18px] text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* 全局搜索 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-border/50">
        <Search className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm text-sidebar-foreground">全局搜索</span>
      </div>

      {/* 快捷添加笔记按钮 */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center justify-center gap-2 px-3 py-2 bg-[#0087ff] text-white rounded-md hover:bg-[#0087ff]/90 transition-colors"
      >
        <StickyNote className="w-4 h-4" />
        <span className="text-sm font-normal">快捷添加笔记</span>
      </button>

      {/* 资源组 */}
      <div className="flex flex-col gap-1 hover:bg-sidebar-accent rounded-md transition-colors">
        <NavItem
          icon={<NotebookPen className="w-4 h-4" />}
          label="笔记列表"
          active={location.pathname === '/notes'}
          hasDropdown
          onClick={() => navigate('/notes')}
        />
        <NavItem icon={<Library className="w-4 h-4" />} label="知 - 资源库 (2)" hasDropdown />
        <NavItem icon={<Box className="w-4 h-4" />} label="行 - 产出物" hasDropdown />
      </div>

      {/* 探索分组 */}
      <div className="flex flex-col">
        <div className="px-3 py-1">
          <span className="text-xs text-muted-foreground">探索</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <NavItem icon={<Activity className="w-4 h-4" />} label="动态 (Beta)" />
          <NavItem icon={<Rss className="w-4 h-4" />} label="订阅" hasDropdown />
          <NavItem icon={<Flame className="w-4 h-4" />} label="热门" hasDropdown />
        </div>
      </div>

      {/* 合集分组 */}
      <div className="flex flex-col">
        <div className="px-3 py-1">
          <span className="text-xs text-muted-foreground">合集</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <NavItem icon={<FolderPlus className="w-4 h-4" />} label="新合集" />
          <div className="px-3 py-2">
            <span className="text-sm text-muted-foreground italic">暂无合集，试试新建一个？</span>
          </div>
        </div>
      </div>

      {/* 间隔区 */}
      <div className="flex-1" />

      {/* 进度徽章 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-background rounded-full border border-border">
        <span className="text-xs text-foreground">已完成 1/2</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </div>

      {/* 用户栏 */}
      <div className="flex items-center gap-2 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer">
        <div className="w-8 h-8 rounded-md bg-[#f97316] flex items-center justify-center">
          <span className="text-xs font-semibold text-white">旭洋</span>
        </div>
        <div className="flex flex-col gap-0.5 flex-1">
          <span className="text-sm font-medium text-sidebar-foreground">王旭洋</span>
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-[#ec4899] bg-[#fce7f3] px-2 py-0.5 rounded">非会员</span>
          </div>
        </div>
        <Settings className="w-4 h-4 text-muted-foreground" />
      </div>
    </aside>
  )
}

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  hasDropdown?: boolean
  onClick?: () => void
}

function NavItem({ icon, label, active, hasDropdown, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full px-3 py-2 rounded-md transition-colors group",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-accent text-sidebar-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {hasDropdown ? (
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-opacity" />
      ) : (
        <MoreHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}
