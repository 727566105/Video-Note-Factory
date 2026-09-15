import Provider from '@/components/Form/modelForm/Provider.tsx'
import { Outlet, useLocation } from 'react-router-dom'
import { useIsMobile } from '@/hooks/use-mobile'
import { Sparkles } from 'lucide-react'

const Model = () => {
  const isMobile = useIsMobile()
  const location = useLocation()
  const isIndex = location.pathname === '/settings/model'

  return (
    <div className="flex h-full w-full bg-background/80">
      {!isMobile && (
        <>
          <div className="hidden w-[375px] shrink-0 border-r border-border/70 bg-background/80 p-4 lg:block">
            <Provider />
          </div>
          <div className="flex-1 overflow-auto p-4 md:p-6">
            {isIndex ? (
              <div className="flex h-full min-h-[420px] items-center justify-center">
                <div className="max-w-sm rounded-2xl border border-dashed border-border bg-card/80 p-6 text-center shadow-sm">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="size-6" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-foreground">选择一个模型供应商</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    左侧管理供应商状态，进入详情后可以维护密钥、模型和默认参数。
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
          <Provider />
        </div>
      )}
    </div>
  )
}
export default Model
