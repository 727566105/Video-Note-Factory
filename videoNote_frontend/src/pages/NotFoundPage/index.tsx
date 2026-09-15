// src/pages/NotFoundPage.tsx
import NotFound from '@/components/Lottie/404.tsx'
import { Button } from '@/components/ui/button.tsx'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '@/hooks/use-mobile'

const NotFoundPage = () => {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center text-muted-foreground p-4">
      <div className="text-center max-w-md">
        <h1 className={cn(
          "mb-4 font-bold",
          isMobile ? "text-2xl" : "text-4xl"
        )}>
          你好像走丢了哦！～～
        </h1>
        <p className={cn(
          "mb-4",
          isMobile ? "text-sm" : "text-lg"
        )}>
          请检查你的网址是否正确，或者点击下面的按钮返回首页。
        </p>
        <Button onClick={() => navigate('/')} className="hover:underline">
          返回首页
        </Button>
      </div>
      <div className={cn(
        "mt-4",
        isMobile ? "w-48 h-48" : "w-64 h-64"
      )}>
        <NotFound />
      </div>
    </div>
  )
}

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(' ')
}

export default NotFoundPage
