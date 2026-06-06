"use client"

import {
  LogOut,
  Monitor,
  Moon,
  User,
  Settings,
  Sun,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { useThemeMode, type ThemeMode } from "@/components/ThemeProvider"

const themeLabels: Record<ThemeMode, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

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
  const { mode, setMode } = useThemeMode()
  const navigate = useNavigate()

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
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate('/settings/profile')}
              >
                <User className="mr-2 h-4 w-4" />
                个人资料
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate('/settings')}
              >
                <Settings className="mr-2 h-4 w-4" />
                设置中心
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <Monitor className="mr-2 h-4 w-4" />
                  外观模式
                  <span className="ml-auto text-xs text-muted-foreground">{themeLabels[mode]}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-40">
                  <DropdownMenuRadioGroup value={mode} onValueChange={value => setMode(value as ThemeMode)}>
                    <DropdownMenuRadioItem value="system" className="cursor-pointer">
                      <Monitor className="mr-2 h-4 w-4" />
                      跟随系统
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="light" className="cursor-pointer">
                      <Sun className="mr-2 h-4 w-4" />
                      浅色
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark" className="cursor-pointer">
                      <Moon className="mr-2 h-4 w-4" />
                      深色
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
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
