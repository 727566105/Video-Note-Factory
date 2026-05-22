"use client"

import * as React from "react"
import {
  Sparkles,
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
    <Sidebar {...props} className="border-r border-border" collapsible="icon">
      {/* ===== HEADER ===== */}
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:p-2">
        {/* Logo */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="VideoNote"
              className="cursor-pointer"
              onClick={() => {
                if (state === "collapsed") {
                  toggleSidebar()
                } else {
                  navigate("/")
                }
              }}
            >
              <Sparkles className="size-5" />
              <span className="text-base font-semibold">VideoNote</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 搜索 + 快捷添加 */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="全局搜索">
              <Search />
              <span>全局搜索</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="快捷添加笔记"
              className="bg-[#0087ff] text-white hover:bg-[#0087ff]/90 active:bg-[#0087ff]/80 data-[active=true]:bg-[#0087ff]"
              onClick={() => navigate("/")}
            >
              <StickyNote />
              <span>快捷添加笔记</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* ===== CONTENT ===== */}
      <SidebarContent className="px-2">
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
              <SidebarMenuButton tooltip="知 - 资源库">
                <Library />
                <span>知 - 资源库 (2)</span>
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
      <SidebarFooter className="p-4 group-data-[collapsible=icon]:p-2">
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
