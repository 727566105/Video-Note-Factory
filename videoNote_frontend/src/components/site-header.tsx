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
import { LogOut, Settings, ChevronDown } from "lucide-react"
import logoImg from "@/../public/logo.png"

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

  const pageTitle = getPageTitle(location.pathname)

  return (
    <header className="sticky top-0 z-50 h-14 bg-background border-b md:hidden">
      <div className="flex items-center justify-between h-full px-4">
        {/* 左侧：Logo + 应用名 */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 shrink-0"
        >
          <img
            src={logoImg}
            alt="VideoNote"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="font-semibold text-base text-foreground">VideoNote</span>
        </button>

        {/* 右侧：页面标题下拉 + 用户头像 */}
        <div className="flex items-center gap-3">
          {/* 页面标题下拉（仅显示当前页面名称） */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <span className="text-sm font-medium text-foreground truncate max-w-[100px]">
                  {pageTitle}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => navigate("/")}>
                快捷添加
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/notes")}>
                笔记列表
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/feed")}>
                动态
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/authors")}>
                博主
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/channels")}>
                频道管理
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 用户头像下拉菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
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
        </div>
      </div>
    </header>
  )
}