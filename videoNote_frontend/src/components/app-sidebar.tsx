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
  Settings,
  User,
  Users,
  LogOut,
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
  SidebarMenuBadge,
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
import { useSubscriptionStore } from "@/store/subscriptionStore"
import { useAuthStore } from "@/store/authStore"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navigate = useNavigate()
  const location = useLocation()
  const { state, setOpen, toggleSidebar } = useSidebar()
  const { unreadCount, fetchUnreadCount } = useSubscriptionStore()
  const authUser = useAuthStore(state => state.user)

  React.useEffect(() => { fetchUnreadCount() }, [fetchUnreadCount])

  const setOpenRef = React.useRef(setOpen)
  React.useEffect(() => { setOpenRef.current = setOpen }, [setOpen])

  // 响应式：跨越 1200px 断点时自动折叠/展开
  React.useEffect(() => {
    const mql = window.matchMedia('(max-width: 1199px)')
    setOpenRef.current(!mql.matches)
    const handler = (e: MediaQueryListEvent) => {
      setOpenRef.current(!e.matches)
    }
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const user = {
    name: authUser?.username || '未登录',
    email: '',
    avatar: '',
  }

  return (
    <Sidebar {...props} className="border-r border-border" collapsible="icon">
      {/* ===== HEADER ===== */}
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between">
              <SidebarMenuButton
                size="lg"
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => navigate("/")}
              >
                <Sparkles className="w-5 h-5 text-foreground shrink-0" />
                <span className="text-base font-semibold text-foreground">VideoNote</span>
              </SidebarMenuButton>
              <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
                <button
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                  onClick={toggleSidebar}
                >
                  <PanelLeftClose className="w-[18px] h-[18px] text-muted-foreground" />
                </button>
              </div>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 搜索框 — 展开态 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-md border border-border/50 group-data-[collapsible=icon]:hidden">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm text-sidebar-foreground">全局搜索</span>
        </div>

        {/* 快捷添加笔记 */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center justify-center gap-2 px-3 py-2 mt-2 bg-[#0087ff] text-white rounded-md hover:bg-[#0087ff]/90 transition-colors w-full group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:mt-2"
        >
          <StickyNote className="w-4 h-4 shrink-0" />
          <span className="text-sm font-normal group-data-[collapsible=icon]:hidden">快捷添加笔记</span>
        </button>
      </SidebarHeader>

      {/* ===== CONTENT ===== */}
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>资源</SidebarGroupLabel>
          <SidebarMenu className="flex flex-col gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/notes"}
                onClick={() => navigate("/notes")}
              >
                <NotebookPen />
                <span>笔记列表</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Library />
                <span>知 - 资源库 (2)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Box />
                <span>行 - 产出物</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>探索</SidebarGroupLabel>
          <SidebarMenu className="flex flex-col gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/feed"}
                onClick={() => navigate("/feed")}
              >
                <Rss />
                <span>动态</span>
                {unreadCount > 0 && <SidebarMenuBadge>{unreadCount}</SidebarMenuBadge>}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname === "/channels"}
                onClick={() => navigate("/channels")}
              >
                <Activity />
                <span>频道管理</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => alert('暂无开发')}>
                <Flame />
                <span>热门</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={location.pathname.startsWith("/authors")}
                onClick={() => navigate("/authors")}
              >
                <Users />
                <span>博主</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      {/* ===== FOOTER ===== */}
      <SidebarFooter className="p-4">
        <div className="group-data-[collapsible=icon]:hidden">
          <TaskQueuePanel />
        </div>
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
