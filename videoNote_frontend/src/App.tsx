import { useEffect, ReactNode, Suspense, lazy } from 'react'
import { HomePage } from './pages/HomePage/Home.tsx'
import { useTaskPolling } from '@/hooks/useTaskPolling.ts'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Index from '@/pages/Index.tsx'
import NotFoundPage from '@/pages/NotFoundPage'
import LoginPage from '@/pages/LoginPage'
import { LoaderCircle } from 'lucide-react'

// 懒加载页面（优化首屏加载）
const SettingPage = lazy(() => import('@/pages/SettingPage/index.tsx'))
const Model = lazy(() => import('@/pages/SettingPage/Model.tsx'))
const ProviderForm = lazy(() => import('@/components/Form/modelForm/Form.tsx'))
const AboutPage = lazy(() => import('@/pages/SettingPage/about.tsx'))
const ProfilePage = lazy(() => import('@/pages/SettingPage/Profile.tsx'))
const SiyuanSettings = lazy(() => import('@/pages/SettingPage/Siyuan.tsx'))
const ObsidianSettings = lazy(() => import('@/pages/SettingPage/Obsidian.tsx'))
const WebDAVSettings = lazy(() => import('@/pages/SettingPage/WebDAV.tsx'))
const Downloader = lazy(() => import('@/pages/SettingPage/Downloader.tsx'))
const DownloaderForm = lazy(() => import('@/components/Form/DownloaderForm/Form.tsx'))
const TaskQueueSettings = lazy(() => import('@/pages/SettingPage/TaskQueue.tsx'))
const UsersPage = lazy(() => import('@/pages/SettingPage/Users.tsx'))
const SubscriptionSettings = lazy(() => import('@/pages/SettingPage/Subscription'))
const NoteListPage = lazy(() => import('./pages/NoteListPage'))
const AuthorsPage = lazy(() => import('./pages/AuthorsPage'))
const NoteDetailPage = lazy(() => import('@/pages/NoteDetailPage'))
const FeedPage = lazy(() => import('@/pages/FeedPage'))
const ChannelsPage = lazy(() => import('@/pages/ChannelsPage'))
const ChannelDetailPage = lazy(() => import('@/pages/ChannelDetailPage'))
const AuthorDetailPage = lazy(() => import('./pages/AuthorDetailPage'))
const LibraryPage = lazy(() => import('@/pages/LibraryPage'))
const CollectionDetail = lazy(() => import('@/pages/LibraryPage/CollectionDetail'))

import { TooltipProvider } from '@/components/ui/tooltip'

// 懒加载页面 loading 组件
function PageLoader() {
  return <div className="flex items-center justify-center h-full"><LoaderCircle className="size-8 animate-spin text-primary" /></div>
}
import { systemCheck } from '@/services/system.ts'
import { useCheckBackend } from '@/hooks/useCheckBackend.ts'
import HomeSkeleton from '@/components/HomeSkeleton'
import { useTaskStore } from '@/store/taskStore/index.ts'
import { useAuthStore } from '@/store/authStore'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { useModelStore } from '@/store/modelStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { fetchUserPreferences } from '@/services/userPreferences'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav'
import { SwipeBackHandler } from '@/components/mobile/SwipeBackHandler'
import { useIsMobile } from '@/hooks/use-mobile'

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated())
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: ReactNode }) {
  const isAdmin = useAuthStore(state => state.isAdmin())
  if (!isAdmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

function AuthenticatedApp({ children }: { children: ReactNode }) {
  useTaskPolling(3000)
  const { initialized } = useCheckBackend()
  const loadTasksFromBackend = useTaskStore(state => state.loadTasksFromBackend)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (initialized) {
      systemCheck()
      loadTasksFromBackend()
      // 加载订阅数据，供全局共享
      useSubscriptionStore.getState().fetchSubscriptions()
      // 从云端加载用户偏好
      fetchUserPreferences().then(prefs => {
        if (prefs.summary) {
          useSummarySettingsStore.getState().loadFromServer(prefs.summary)
        }
        if (prefs.model) {
          useModelStore.getState().loadFromServer(prefs.model)
        }
      }).catch((e) => console.error('加载用户偏好失败:', e))
    }
  }, [initialized, loadTasksFromBackend])

  if (!initialized) {
    return <HomeSkeleton />
  }

  // 移动端布局：底部导航 + 无侧边栏 + 滑动返回手势
  if (isMobile) {
    return (
      <TooltipProvider delayDuration={0}>
        <SwipeBackHandler>
          <div className="flex h-dvh flex-col bg-background">
            <SiteHeader />
            <div className="flex-1 min-h-0 overflow-auto">
              {children}
            </div>
            <MobileBottomNav />
          </div>
        </SwipeBackHandler>
      </TooltipProvider>
    )
  }

  // 桌面端布局：侧边栏结构
  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="h-full overflow-hidden bg-background">
        <div className="h-full overflow-auto p-3">
          <div className="app-surface h-full min-h-0 overflow-hidden rounded-2xl border border-border/70">
          {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AuthenticatedApp><Index /></AuthenticatedApp></ProtectedRoute>}>
            <Route index element={<HomePage />} />
            <Route path="notes" element={<Suspense fallback={<PageLoader />}><NoteListPage /></Suspense>} />
            <Route path="notes/:id" element={<Suspense fallback={<PageLoader />}><NoteDetailPage /></Suspense>} />
            <Route path="feed" element={<Suspense fallback={<PageLoader />}><FeedPage /></Suspense>} />
            <Route path="channels" element={<Suspense fallback={<PageLoader />}><ChannelsPage /></Suspense>} />
            <Route path="channel/:platform/:id" element={<Suspense fallback={<PageLoader />}><ChannelDetailPage /></Suspense>} />
            <Route path="authors" element={<Suspense fallback={<PageLoader />}><AuthorsPage /></Suspense>} />
            <Route path="authors/:id" element={<Suspense fallback={<PageLoader />}><AuthorDetailPage /></Suspense>} />
            <Route path="library" element={<Suspense fallback={<PageLoader />}><LibraryPage /></Suspense>} />
            <Route path="library/:id" element={<Suspense fallback={<PageLoader />}><CollectionDetail /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingPage /></Suspense>}>
              {/* 移动端由 SettingLayout 显示设置列表，桌面端重定向由 SettingLayout 内部处理 */}
              <Route path="model" element={<AdminRoute><Suspense fallback={<PageLoader />}><Model /></Suspense></AdminRoute>}>
                <Route path="new" element={<Suspense fallback={<PageLoader />}><ProviderForm isCreate /></Suspense>} />
                <Route path=":id" element={<Suspense fallback={<PageLoader />}><ProviderForm /></Suspense>} />
              </Route>
              <Route path="download" element={<AdminRoute><Suspense fallback={<PageLoader />}><Downloader /></Suspense></AdminRoute>}>
                <Route path=":id" element={<Suspense fallback={<PageLoader />}><DownloaderForm /></Suspense>} />
              </Route>
              <Route path="taskqueue" element={<AdminRoute><Suspense fallback={<PageLoader />}><TaskQueueSettings /></Suspense></AdminRoute>} />
              <Route path="siyuan" element={<Suspense fallback={<PageLoader />}><SiyuanSettings /></Suspense>} />
              <Route path="obsidian" element={<Suspense fallback={<PageLoader />}><ObsidianSettings /></Suspense>} />
              <Route path="webdav" element={<Suspense fallback={<PageLoader />}><WebDAVSettings /></Suspense>} />
              <Route path="about" element={<Suspense fallback={<PageLoader />}><AboutPage /></Suspense>} />
              <Route path="profile" element={<Suspense fallback={<PageLoader />}><ProfilePage /></Suspense>} />
              <Route path="subscription" element={<AdminRoute><Suspense fallback={<PageLoader />}><SubscriptionSettings /></Suspense></AdminRoute>} />
              <Route path="users" element={<Suspense fallback={<PageLoader />}><UsersPage /></Suspense>} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
