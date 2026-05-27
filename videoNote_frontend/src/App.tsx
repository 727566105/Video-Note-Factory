import { useEffect, ReactNode, Suspense, lazy } from 'react'
import { HomePage } from './pages/HomePage/Home.tsx'
import { useTaskPolling } from '@/hooks/useTaskPolling.ts'
import SettingPage from './pages/SettingPage/index.tsx'
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Index from '@/pages/Index.tsx'
import NotFoundPage from '@/pages/NotFoundPage'
import Model from '@/pages/SettingPage/Model.tsx'
import ProviderForm from '@/components/Form/modelForm/Form.tsx'
import AboutPage from '@/pages/SettingPage/about.tsx'
import SiyuanSettings from '@/pages/SettingPage/Siyuan.tsx'
import WebDAVSettings from '@/pages/SettingPage/WebDAV.tsx'
import Downloader from '@/pages/SettingPage/Downloader.tsx'
import DownloaderForm from '@/components/Form/DownloaderForm/Form.tsx'
import TaskQueueSettings from '@/pages/SettingPage/TaskQueue.tsx'
import UsersPage from '@/pages/SettingPage/Users.tsx'
import LoginPage from '@/pages/LoginPage'
import { NoteListPage } from './pages/NoteListPage'
import { AuthorsPage } from './pages/AuthorsPage'
import SubscriptionSettings from '@/pages/SettingPage/Subscription'
// 懒加载重型页面（优化首屏加载）
const NoteDetailPage = lazy(() => import('@/pages/NoteDetailPage'))
const FeedPage = lazy(() => import('@/pages/FeedPage'))
const ChannelsPage = lazy(() => import('@/pages/ChannelsPage'))
const ChannelDetailPage = lazy(() => import('@/pages/ChannelDetailPage'))
const AuthorDetailPage = lazy(() => import('./pages/AuthorDetailPage'))
import { LoaderCircle } from 'lucide-react'

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

  return (
    <SidebarProvider defaultOpen={true}>
      <AppSidebar />
      <SidebarInset className="h-full overflow-hidden">
        <SiteHeader />
        <div className="h-full overflow-auto">
          {children}
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
            <Route path="notes" element={<NoteListPage />} />
            <Route path="notes/:id" element={<Suspense fallback={<PageLoader />}><NoteDetailPage /></Suspense>} />
            <Route path="feed" element={<Suspense fallback={<PageLoader />}><FeedPage /></Suspense>} />
            <Route path="channels" element={<Suspense fallback={<PageLoader />}><ChannelsPage /></Suspense>} />
            <Route path="channel/:platform/:id" element={<Suspense fallback={<PageLoader />}><ChannelDetailPage /></Suspense>} />
            <Route path="authors" element={<AuthorsPage />} />
            <Route path="authors/:id" element={<Suspense fallback={<PageLoader />}><AuthorDetailPage /></Suspense>} />
            <Route path="settings" element={<SettingPage />}>
              <Route index element={<Navigate to="about" replace />} />
              <Route path="model" element={<AdminRoute><Model /></AdminRoute>}>
                <Route path="new" element={<ProviderForm isCreate />} />
                <Route path=":id" element={<ProviderForm />} />
              </Route>
              <Route path="download" element={<AdminRoute><Downloader /></AdminRoute>}>
                <Route path=":id" element={<DownloaderForm />} />
              </Route>
              <Route path="taskqueue" element={<AdminRoute><TaskQueueSettings /></AdminRoute>} />
              <Route path="siyuan" element={<SiyuanSettings />} />
              <Route path="webdav" element={<WebDAVSettings />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="subscription" element={<AdminRoute><SubscriptionSettings /></AdminRoute>} />
              <Route path="users" element={<UsersPage />} />
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
