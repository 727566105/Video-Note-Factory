import { Outlet, useLocation } from 'react-router-dom'
import Options from '@/components/Form/DownloaderForm/Options.tsx'
import { useIsMobile } from '@/hooks/use-mobile'
import { Download } from 'lucide-react'

const Downloader = () => {
  const isMobile = useIsMobile()
  const location = useLocation()
  const isIndex = location.pathname === '/settings/download'

  return (
    <div className="flex h-full bg-background/80">
      {!isMobile && (
        <>
          <div className="hidden w-[375px] border-r border-border/70 bg-background/80 p-2 lg:block">
            <Options />
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {isIndex ? (
              <div className="flex h-full min-h-[420px] items-center justify-center">
                <div className="max-w-sm rounded-2xl border border-dashed border-border bg-card/80 p-6 text-center shadow-sm">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Download className="size-6" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">选择一个下载配置</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    左侧维护平台下载能力，进入详情后可以调整 Cookie、命令和解析参数。
                  </p>
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
        </>
      )}

      {isMobile && (
        <div className="flex-1 overflow-auto">
          <Options />
        </div>
      )}
    </div>
  )
}
export default Downloader
