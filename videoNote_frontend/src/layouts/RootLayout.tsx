import type { ReactNode, FC } from 'react'
import { Toaster } from 'react-hot-toast'
import { useTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/store/themeStore'

interface RootLayoutProps {
  children: ReactNode
}

export const metadata = {
  title: 'videoNote - 视频笔记生成器',
  description: '通过视频链接结合大模型自动生成对应的笔记',
}

const RootLayout: FC<RootLayoutProps> = ({ children }) => {
  useTheme()
  const theme = useThemeStore(state => state.theme)

  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: '8px',
            background: theme === 'dark' ? '#333' : '#333',
            color: '#fff',
          },
        }}
      />
      {children}
    </div>
  )
}

export default RootLayout
