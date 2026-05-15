"use client"

import * as React from "react"
import {
  Sparkles,
  PanelLeft,
  PanelLeftClose,
  Search,
  ChevronDown,
  StickyNote,
  Library,
  Box,
  Activity,
  Rss,
  Flame,
  MoreHorizontal,
  NotebookPen,
  MessageCircle,
  Package,
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
  useSidebar,
} from "@/components/ui/sidebar"
import { NavUser } from "@/components/nav-user"

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
  const { state, toggleSidebar } = useSidebar()

  const user = {
    name: "王旭洋",
    email: "user@example.com",
    avatar: "",
  }

  return (
    <Sidebar {...props} className="border-r border-border" collapsible="icon">
      {state === "collapsed" ? (
        /* ====== 折叠态 — 匹配 Pencil 侧边栏缩小版 ====== */
        <>
          <SidebarHeader className="flex flex-col items-center gap-4 !p-3 !pt-3 !pb-0">
            <button
              onClick={toggleSidebar}
              className="group/icon relative w-5 h-5 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-foreground absolute inset-0 transition-opacity group-hover/icon:opacity-0" />
              <PanelLeft className="w-5 h-5 text-foreground absolute inset-0 opacity-0 transition-opacity group-hover/icon:opacity-100" />
            </button>
            <div className="flex flex-col items-center gap-2 w-full">
              <button className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-accent">
                <Search className="w-[18px] h-[18px] text-sidebar-foreground" />
              </button>
              <button
                onClick={() => navigate("/")}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-accent transition-colors"
              >
                <StickyNote className="w-[18px] h-[18px] text-sidebar-foreground" />
              </button>
              <button className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-accent transition-colors">
                <MessageCircle className="w-[18px] h-[18px] text-sidebar-accent-foreground" />
              </button>
            </div>
          </SidebarHeader>

          <div className="flex justify-center py-2">
            <div className="w-8 h-px bg-border" />
          </div>

          <SidebarContent className="flex flex-col items-center gap-2 !px-0 !overflow-hidden">
            <button
              className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent transition-colors"
              onClick={() => navigate("/notes")}
            >
              <Library className="w-[18px] h-[18px] text-sidebar-foreground" />
            </button>
            <button className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent transition-colors">
              <Package className="w-[18px] h-[18px] text-sidebar-foreground" />
            </button>
          </SidebarContent>

          <SidebarFooter className="flex flex-col items-center !p-0 !pt-0 !pb-3">
            <div className="w-8 h-8 rounded-md bg-orange-500 flex items-center justify-center">
              <span className="text-white text-xs font-semibold">
                {user.name.slice(0, 2)}
              </span>
            </div>
          </SidebarFooter>
        </>
      ) : (
        /* ====== 展开态 ====== */
        <>
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
                <button
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                  onClick={toggleSidebar}
                >
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

            <SidebarGroup>
              <SidebarGroupLabel>探索</SidebarGroupLabel>
              <SidebarMenu className="flex flex-col gap-1">
                <SidebarMenuItem>
                  <NavItem
                    icon={<Activity className="w-4 h-4" />}
                    label="动态 (Beta)"
                    onClick={() => alert('暂无开发')}
                  />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <NavItem
                    icon={<Rss className="w-4 h-4" />}
                    label="订阅"
                    hasDropdown
                    onClick={() => alert('暂无开发')}
                  />
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <NavItem
                    icon={<Flame className="w-4 h-4" />}
                    label="热门"
                    hasDropdown
                    onClick={() => alert('暂无开发')}
                  />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4">
            <div className="flex items-center justify-between px-3 py-1.5 mb-3 bg-background rounded-full border border-border">
              <span className="text-xs text-foreground">已完成 1/2</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </div>
            <NavUser
              user={{
                name: user.name,
                email: user.email,
                avatar: user.avatar || undefined,
              }}
            />
          </SidebarFooter>
        </>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
