import type { ReactNode, FC } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { useTheme } from '@/hooks/useTheme'

interface RootLayoutProps {
  children: ReactNode
}

export const metadata = {
  title: 'videoNote - 视频笔记生成器',
  description: '通过视频链接结合大模型自动生成对应的笔记',
}

const RootLayout: FC<RootLayoutProps> = ({ children }) => {
  useTheme()

  return (
    <div className="h-full overflow-hidden bg-background font-sans text-foreground">
      <Toaster />
      {children}
    </div>
  )
}

export default RootLayout
