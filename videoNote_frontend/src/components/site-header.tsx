import * as React from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/authStore"
import { useNavigate, useLocation } from "react-router-dom"
import {
  ArrowLeft,
  LogOut,
  Settings,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useTaskStore } from "@/store/taskStore"

// 页面标题映射（一级和二级列表页面）
const pageTitleMap: Record<string, string> = {
  '/notes': '笔记列表',
  '/feed': '动态',
  '/channels': '频道管理',
  '/authors': '博主',
  '/settings': '设置',
  '/library': '资源库',
  '/output': '产出物',
  '/hot': '热门',
}

// 判断是否是未实现的路由（显示带返回按钮的标题）
function isNotFoundPage(pathname: string): boolean {
  // 首页不是 404
  if (pathname === '/') return false
  // 详情页路径模式匹配成功就不是 404
  if (pathname.match(/^\/notes\/[^/]+$/)) return false
  if (pathname.match(/^\/channel\/[^/]+\/[^/]+$/)) return false
  if (pathname.match(/^\/authors\/[^/]+$/)) return false
  // 设置子页面路径模式匹配成功就不是 404
  if (pathname.match(/^\/settings\/[^/]+$/)) return false
  if (pathname.match(/^\/settings\/model\/[^/]+$/)) return false
  if (pathname.match(/^\/settings\/download\/[^/]+$/)) return false
  // 其他路径都是 404（包括 /library、/output、/hot 等未实现的路由）
  return true
}

// 判断是否是详情页（需要显示返回按钮）
function isDetailPage(pathname: string): boolean {
  // 笔记详情
  if (pathname.match(/^\/notes\/[^/]+$/)) return true
  // 频道详情
  if (pathname.match(/^\/channel\/[^/]+\/[^/]+$/)) return true
  // 博主详情
  if (pathname.match(/^\/authors\/[^/]+$/)) return true
  // 设置子页面（不包括设置根目录）
  if (pathname.startsWith('/settings/') && pathname !== '/settings') return true
  return false
}

// 判断是否是一级页面（首页显示 Logo）
function isHomePage(pathname: string): boolean {
  return pathname === '/'
}

// 获取页面标题
function getPageTitle(pathname: string): string {
  // 直接匹配
  if (pageTitleMap[pathname]) return pageTitleMap[pathname]

  // 设置子页面
  if (pathname.startsWith('/settings/')) {
    const subPage = pathname.replace('/settings/', '')
    // 处理带 ID 的路径（如 /settings/model/123）
    const mainPage = subPage.split('/')[0]
    const subPageTitles: Record<string, string> = {
      'model': '模型设置',
      'download': '下载配置',
      'siyuan': '思源笔记',
      'webdav': 'WebDAV 备份',
      'about': '关于',
      'profile': '个人资料',
      'subscription': '订阅设置',
      'users': '用户管理',
      'taskqueue': '任务队列',
      'transcriber': '转写器配置',
      'prompt': '提示词设置',
    }
    return subPageTitles[mainPage] || '设置'
  }

  // 兜底：未知路径显示"页面不存在"
  return '页面不存在'
}

export function SiteHeader() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore(state => state.user)
  const logout = useAuthStore(state => state.logout)
  const tasks = useTaskStore(state => state.tasks)

  const handleLogout = () => {
    useTaskStore.getState().clearTasks()
    logout()
    navigate("/login")
  }

  const pathname = location.pathname
  const isHome = isHomePage(pathname)
  const isDetail = isDetailPage(pathname)
  const isNotFound = isNotFoundPage(pathname)

  // 获取详情页标题
  const getDetailTitle = (): string => {
    // 笔记详情
    if (pathname.match(/^\/notes\/[^/]+$/)) {
      const taskId = pathname.replace('/notes/', '')
      const task = tasks.find(t => t.id === taskId)
      return task?.title || '笔记详情'
    }
    // 频道详情
    if (pathname.match(/^\/channel\/[^/]+\/[^/]+$/)) {
      return '频道详情'
    }
    // 博主详情
    if (pathname.match(/^\/authors\/[^/]+$/)) {
      return '视频列表'
    }
    // 设置子页面
    return getPageTitle(pathname)
  }

  // 处理返回
  const handleBack = () => {
    // 404 页面返回首页
    if (isNotFound) {
      navigate('/')
      return
    }
    // 检查是否从博主详情页来的笔记详情
    if (pathname.startsWith('/notes/') && location.state?.from === 'authors') {
      navigate('/authors')
    } else if (pathname.startsWith('/notes/')) {
      navigate('/notes')
    } else if (pathname.startsWith('/channel/')) {
      navigate('/channels')
    } else if (pathname.startsWith('/authors/')) {
      navigate('/authors')
    } else if (pathname.startsWith('/settings/')) {
      navigate('/settings')
    } else {
      navigate(-1)
    }
  }

  return (
    <header className="shrink-0 h-14 bg-background border-b md:hidden">
      <div className="flex items-center justify-between h-full px-4">
        {/* 左侧：根据页面类型动态显示 */}
        {isHome ? (
          // 首页：Logo + 应用名
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 shrink-0"
          >
            <img
              src="/logo.png"
              alt="VideoNote"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="font-semibold text-base text-foreground">VideoNote</span>
          </button>
        ) : isDetail || isNotFound ? (
          // 详情页或 404 页：返回箭头 + 标题
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="font-medium text-base text-foreground truncate">
              {isNotFound ? getPageTitle(pathname) : getDetailTitle()}
            </span>
          </div>
        ) : (
          // 二级列表页：页面标题
          <span className="font-semibold text-base text-foreground">
            {getPageTitle(pathname)}
          </span>
        )}

        {/* 右侧：用户头像下拉菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shrink-0">
              <Avatar className="h-8 w-8 border border-border">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                  {user?.username?.slice(0, 2).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
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

            <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
