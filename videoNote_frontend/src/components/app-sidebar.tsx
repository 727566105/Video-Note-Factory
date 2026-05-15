"use client"

import * as React from "react"
import {
  Sparkles,
  Edit,
  PanelLeftClose,
  Search,
  ChevronDown,
  Settings,
  StickyNote,
  Library,
  Box,
  Activity,
  Rss,
  Flame,
  FolderPlus,
  MoreHorizontal,
  NotebookPen,
} from "lucide-react"
import { useNavigate, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"

// 导航项属性
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
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-accent text-sidebar-foreground"
      )}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      {hasDropdown ? (
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
      ) : (
        <MoreHorizontal className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </button>
  )
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const location = useLocation()

  const user = {
    name: "王旭洋",
    email: "user@example.com",
    avatar: "",
  }

  return (
    <Sidebar {...props} className="border-r border-border">
      <SidebarHeader className="p-4">
        {/* Logo 区域 */}
        <div className="flex items-center justify-between h-10 mb-3">
          <SidebarMenuButton
            size="lg"
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <Sparkles className="w-5 h-5 text-foreground" />
            <span className="text-base font-semibold text-foreground">VideoNote</span>
          </SidebarMenuButton>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-accent rounded-md transition-colors">
              <Edit className="w-[18px] h-[18px] text-muted-foreground" />
            </button>
            <button className="p-1 hover:bg-accent rounded-md transition-colors">
              <PanelLeftClose className="w-[18px] h-[18px] text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 全局搜索 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-md border border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-sidebar-foreground">全局搜索</span>
        </div>

        {/* 快捷添加笔记按钮 */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-[#0087ff] text-white rounded-md hover:bg-[#0087ff]/90 transition-colors"
        >
          <StickyNote className="w-4 h-4" />
          <span className="text-sm font-normal">快捷添加笔记</span>
        </button>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {/* 资源组 */}
        <SidebarGroup>
          <SidebarGroupLabel>资源</SidebarGroupLabel>
          <SidebarMenu className="flex flex-col gap-1">
            <SidebarMenuItem>
              <NavItem
                icon={<NotebookPen className="w-4 h-4" />}
                label="笔记列表"
                active={location.pathname === "/notes"}
                onClick={() => navigate("/notes")}
              />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <NavItem icon={<Library className="w-4 h-4" />} label="知 - 资源库 (2)" hasDropdown />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <NavItem icon={<Box className="w-4 h-4" />} label="行 - 产出物" hasDropdown />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* 探索分组 */}
        <SidebarGroup>
          <SidebarGroupLabel>探索</SidebarGroupLabel>
          <SidebarMenu className="flex flex-col gap-1">
            <SidebarMenuItem>
              <NavItem icon={<Activity className="w-4 h-4" />} label="动态 (Beta)" />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <NavItem icon={<Rss className="w-4 h-4" />} label="订阅" hasDropdown />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <NavItem icon={<Flame className="w-4 h-4" />} label="热门" hasDropdown />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* 合集分组 */}
        <SidebarGroup>
          <SidebarGroupLabel>合集</SidebarGroupLabel>
          <SidebarMenu className="flex flex-col gap-1">
            <SidebarMenuItem>
              <NavItem icon={<FolderPlus className="w-4 h-4" />} label="新合集" />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <div className="px-3 py-2">
                <span className="text-sm text-muted-foreground italic">暂无合集，试试新建一个？</span>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {/* 进度徽章 */}
        <div className="flex items-center justify-between px-3 py-1.5 mb-3 bg-background rounded-full border border-border">
          <span className="text-xs text-foreground">已完成 1/2</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </div>

        {/* 用户栏 */}
        <NavUser
          user={{
            name: user.name,
            email: user.email,
            avatar: user.avatar || undefined,
          }}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
