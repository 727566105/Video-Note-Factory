import * as React from "react"
import { useLocation } from "react-router-dom"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/authStore"
import { useNavigate } from "react-router-dom"
import { LogOut, Settings } from "lucide-react"

// 页面标题映射
const pageTitleMap: Record<string, string> = {
  "/": "快捷添加",
  "/notes": "笔记列表",
  "/feed": "动态",
  "/channels": "频道管理",
  "/authors": "博主",
}

function getPageTitle(pathname: string): string {
  // 精确匹配
  if (pageTitleMap[pathname]) return pageTitleMap[pathname]
  // 动态路由匹配
  if (pathname.startsWith("/notes/") && pathname !== "/notes") return "笔记详情"
  if (pathname.startsWith("/channel/")) return "频道详情"
  if (pathname.startsWith("/authors/") && pathname !== "/authors") return "博主详情"
  if (pathname.startsWith("/settings")) return "设置"
  return "VideoNote"
}

export function SiteHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-2 border-b bg-background px-4 md:hidden">
      {/* 中间：页面标题 */}
      <h1 className="flex-1 text-center font-medium text-sm truncate">
        {getPageTitle(location.pathname)}
      </h1>

      {/* 右侧：用户头像下拉菜单 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs">
                {user?.username?.slice(0, 2).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            设置
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}