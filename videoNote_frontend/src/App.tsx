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
import NoteDetailPage from '@/pages/NoteDetailPage'
import FeedPage from '@/pages/FeedPage'
import ChannelsPage from '@/pages/ChannelsPage'
import ChannelDetailPage from '@/pages/ChannelDetailPage'
import { AuthorsPage } from './pages/AuthorsPage'
import AuthorDetailPage from './pages/AuthorDetailPage'
import SubscriptionSettings from '@/pages/SettingPage/Subscription'
import { useEffect, ReactNode } from 'react'
import { systemCheck } from '@/services/system.ts'
import { useCheckBackend } from '@/hooks/useCheckBackend.ts'
import HomeSkeleton from '@/components/HomeSkeleton'
import { useTaskStore } from '@/store/taskStore/index.ts'
import { useAuthStore } from '@/store/authStore'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { useModelStore } from '@/store/modelStore'
import { fetchUserPreferences } from '@/services/userPreferences'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'

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
      <SidebarInset>
        <div className="flex-1 overflow-auto">
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
            <Route path="notes/:id" element={<NoteDetailPage />} />
            <Route path="feed" element={<FeedPage />} />
            <Route path="channels" element={<ChannelsPage />} />
            <Route path="channel/:platform/:id" element={<ChannelDetailPage />} />
            <Route path="authors" element={<AuthorsPage />} />
            <Route path="authors/:id" element={<AuthorDetailPage />} />
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
