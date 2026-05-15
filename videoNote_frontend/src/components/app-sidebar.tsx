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
  NotebookPen,
  LogOut,
  Settings,
  User,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NavUser } from "@/components/nav-user"
import { TaskQueuePanel } from "@/components/TaskQueuePanel"

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
      ) : null}
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
        /* ====== 折叠态 — 图标与展开态一一对应 ====== */
        <div className="flex flex-col h-full animate-in fade-in-0 duration-300">
          <SidebarHeader className="flex flex-col items-center gap-2 !p-2 !pt-3">
            {/* 1. Sparkles logo / 展开按钮 */}
            <button
              onClick={toggleSidebar}
              className="group/icon relative w-5 h-5 cursor-pointer mb-2"
            >
              <Sparkles className="w-5 h-5 text-foreground absolute inset-0 transition-opacity group-hover/icon:opacity-0" />
              <PanelLeft className="w-5 h-5 text-foreground absolute inset-0 opacity-0 transition-opacity group-hover/icon:opacity-100" />
            </button>
            {/* 2. Search 全局搜索 */}
            <button className="flex items-center justify-center w-10 h-10 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors">
              <Search className="w-[18px] h-[18px] text-sidebar-foreground" />
            </button>
            {/* 3. StickyNote 快捷添加笔记 */}
            <button
              onClick={() => navigate("/")}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0087ff] hover:bg-[#0087ff]/90 transition-colors"
            >
              <StickyNote className="w-[18px] h-[18px] text-white" />
            </button>
          </SidebarHeader>

          <div className="flex justify-center py-1">
            <div className="w-8 h-px bg-border" />
          </div>

          <SidebarContent className="flex flex-col items-center gap-1 !px-0 !overflow-hidden !py-2">
            {/* 4. NotebookPen 笔记列表 */}
            <button
              className={cn(
                "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                location.pathname === "/notes"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "hover:bg-accent text-sidebar-foreground"
              )}
              onClick={() => navigate("/notes")}
            >
              <NotebookPen className="w-[18px] h-[18px]" />
            </button>
            {/* 5. Library 资源库 */}
            <button className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent text-sidebar-foreground transition-colors">
              <Library className="w-[18px] h-[18px]" />
            </button>
            {/* 6. Box 产出物 */}
            <button className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent text-sidebar-foreground transition-colors">
              <Box className="w-[18px] h-[18px]" />
            </button>
          </SidebarContent>

          <div className="flex justify-center py-1">
            <div className="w-8 h-px bg-border" />
          </div>

          <SidebarContent className="flex flex-col items-center gap-1 !px-0 !overflow-hidden !py-2">
            {/* 7. Activity 动态 */}
            <button className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent text-sidebar-foreground transition-colors">
              <Activity className="w-[18px] h-[18px]" />
            </button>
            {/* 8. Rss 订阅 */}
            <button className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent text-sidebar-foreground transition-colors">
              <Rss className="w-[18px] h-[18px]" />
            </button>
            {/* 9. Flame 热门 */}
            <button className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-accent text-sidebar-foreground transition-colors">
              <Flame className="w-[18px] h-[18px]" />
            </button>
          </SidebarContent>

          <SidebarFooter className="flex flex-col items-center !p-0 !pb-3 mt-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-8 h-8 rounded-md bg-orange-500 flex items-center justify-center cursor-pointer hover:bg-orange-600 transition-colors">
                  <span className="text-white text-xs font-semibold">
                    {user.name.slice(0, 2)}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-56 rounded-lg">
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <div className="w-8 h-8 rounded-md bg-orange-500 flex items-center justify-center">
                      <span className="text-xs font-semibold text-white">
                        {user.name.slice(0, 2)}
                      </span>
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{user.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    个人资料
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer" onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    设置
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </div>
      ) : (
        /* ====== 展开态 ====== */
        <div className="flex flex-col h-full animate-in fade-in-0 duration-300">
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
            <TaskQueuePanel />
            <NavUser
              user={{
                name: user.name,
                email: user.email,
                avatar: user.avatar || undefined,
              }}
            />
          </SidebarFooter>
        </div>
      )}
      <SidebarRail />
    </Sidebar>
  )
}
