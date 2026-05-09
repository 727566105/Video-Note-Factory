import './App.css'
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
import { useEffect, ReactNode } from 'react'
import { systemCheck } from '@/services/system.ts'
import { useCheckBackend } from '@/hooks/useCheckBackend.ts'
import HomeSkeleton from '@/components/HomeSkeleton'
import { useTaskStore } from '@/store/taskStore/index.ts'
import { useAuthStore } from '@/store/authStore'

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
    }
  }, [initialized, loadTasksFromBackend])

  if (!initialized) {
    return <HomeSkeleton />
  }

  return <>{children}</>
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AuthenticatedApp><Index /></AuthenticatedApp></ProtectedRoute>}>
            <Route index element={<HomePage />} />
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