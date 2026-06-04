"use client"

import {
  LogOut,
  User,
  BotMessageSquare,
  HardDriveDownload,
  Info,
  BookOpen,
  Cloud,
  ListOrdered,
  Users,
  Rss,
  UserCog,
  Settings,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuthStore } from "@/store/authStore"
import { useTaskStore } from "@/store/taskStore"
import { useNavigate } from "react-router-dom"

export function NavUser({
  user,
}: {
  user: {
    name: string
    email: string
    avatar?: string
  }
}) {
  const { isMobile } = useSidebar()
  const logout = useAuthStore(state => state.logout)
  const isAdmin = useAuthStore(state => state.isAdmin())
  const navigate = useNavigate()

  const adminItems = [
    { path: '/settings/model', label: 'AI 模型设置', icon: <BotMessageSquare className="mr-2 h-4 w-4" /> },
    { path: '/settings/taskqueue', label: '任务队列', icon: <ListOrdered className="mr-2 h-4 w-4" /> },
    { path: '/settings/download', label: '下载配置', icon: <HardDriveDownload className="mr-2 h-4 w-4" /> },
    { path: '/settings/subscription', label: '订阅设置', icon: <Rss className="mr-2 h-4 w-4" /> },
  ]

  const commonItems = [
    { path: '/settings/users', label: '用户管理', icon: <UserCog className="mr-2 h-4 w-4" /> },
  ]

  const baseItems = [
    { path: '/settings/siyuan', label: '思源笔记', icon: <BookOpen className="mr-2 h-4 w-4" /> },
    { path: '/settings/webdav', label: 'WebDAV 备份', icon: <Cloud className="mr-2 h-4 w-4" /> },
    { path: '/settings/about', label: '关于', icon: <Info className="mr-2 h-4 w-4" /> },
  ]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
            >
              {/* 头像 */}
              <div className="w-8 h-8 rounded-md bg-[#f97316] flex items-center justify-center">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-md object-cover"
                  />
                ) : (
                  <span className="text-xs font-semibold text-white">
                    {user.name.slice(0, 2)}
                  </span>
                )}
              </div>

              {/* 用户信息 */}
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold text-sidebar-foreground">
                  {user.name}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-[#ec4899] bg-[#fce7f3] px-2 py-0.5 rounded">
                    非会员
                  </span>
                </div>
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <Settings className="size-4 text-muted-foreground" />
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <div className="w-8 h-8 rounded-md bg-[#f97316] flex items-center justify-center">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full rounded-md object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-white">
                      {user.name.slice(0, 2)}
                    </span>
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            <DropdownMenuGroup>
              <DropdownMenuItem className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                个人资料
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />

            {/* 管理员设置 */}
            {isAdmin && (
              <DropdownMenuGroup>
                {adminItems.map(item => (
                  <DropdownMenuItem
                    key={item.path}
                    className="cursor-pointer"
                    onClick={() => navigate(item.path)}
                  >
                    {item.icon}
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}

            {/* 普通设置 */}
            <DropdownMenuGroup>
              {commonItems.map(item => (
                <DropdownMenuItem
                  key={item.path}
                  className="cursor-pointer"
                  onClick={() => navigate(item.path)}
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ))}
              {baseItems.map(item => (
                <DropdownMenuItem
                  key={item.path}
                  className="cursor-pointer"
                  onClick={() => navigate(item.path)}
                >
                  {item.icon}
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => { useTaskStore.getState().clearTasks(); logout(); navigate('/login') }}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
