"use client"

import * as React from "react"
import {
  PanelLeft,
  Search,
  StickyNote,
  Library,
  Box,
  Activity,
  Rss,
  Flame,
  NotebookPen,
  Users,
} from "lucide-react"

import { useNavigate, useLocation } from "react-router-dom"
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
    <Sidebar {...props} collapsible="icon">
      {/* ===== HEADER ===== */}
      <SidebarHeader>
        {/* Logo */}
        <SidebarMenu>
          <SidebarMenuItem>
            {/* 展开态: 完整 Logo + 切换按钮 */}
            <SidebarMenuButton
              size="lg"
              className="h-12 cursor-pointer group-data-[collapsible=icon]:hidden"
              onClick={() => navigate("/")}
            >
              <div className="flex aspect-square size-8 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary shadow-sm shadow-primary/20">
                <img src="/logo.png" alt="VideoNote" className="size-8 object-cover" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold tracking-tight">VideoNote</span>
                <span className="truncate text-xs text-sidebar-foreground/55">AI 视频笔记</span>
              </div>
              <div
                role="button"
                tabIndex={0}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-medium outline-none transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground -ml-1"
                onClick={(e) => { e.stopPropagation(); toggleSidebar() }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleSidebar() } }}
              >
                <PanelLeft className="size-4" />
                <span className="sr-only">Toggle Sidebar</span>
              </div>
            </SidebarMenuButton>
            {/* 折叠态: 仅切换按钮 */}
            <button
              className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium outline-none transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:inline-flex"
              onClick={toggleSidebar}
            >
              <PanelLeft className="size-4" />
              <span className="sr-only">Toggle Sidebar</span>
            </button>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 搜索 — 展开态为输入框，折叠态消失 */}
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 rounded-xl border border-sidebar-border bg-sidebar-accent/65 px-3 py-2 shadow-xs">
            <Search className="size-4 text-sidebar-foreground/60 shrink-0" />
            <input
              type="text"
              placeholder="全局搜索"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-sidebar-foreground/60"
            />
          </div>
        </div>

        {/* 快捷添加笔记 */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="快捷添加笔记"
              onClick={() => navigate("/")}
            >
              <StickyNote />
              <span>快捷添加笔记</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ===== CONTENT ===== */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>资源</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="笔记列表"
                isActive={location.pathname === "/notes"}
                onClick={() => navigate("/notes")}
              >
                <NotebookPen />
                <span>笔记列表</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="合集"
                isActive={location.pathname.startsWith("/library")}
                onClick={() => navigate("/library")}
              >
                <Library />
                <span>合集</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="行 - 产出物">
                <Box />
                <span>行 - 产出物</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>探索</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="动态"
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
                tooltip="频道管理"
                isActive={location.pathname === "/channels"}
                onClick={() => navigate("/channels")}
              >
                <Activity />
                <span>频道管理</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="热门" onClick={() => alert('暂无开发')}>
                <Flame />
                <span>热门</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="博主"
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
      <SidebarFooter>
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
