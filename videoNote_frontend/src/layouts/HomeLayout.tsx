import { FC, useState } from 'react'

import { QuickAdd } from '@/pages/HomePage/components/QuickAdd'
import { ConfigHealthBanner } from '@/components/ConfigHealthBanner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const HomeLayout: () => JSX.Element = () => {
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 主内容区 */}
        <main
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-cover bg-center p-4 md:p-8"
          style={{ backgroundImage: "url('/home-background.png')" }}
        >
          <div className="absolute inset-0 bg-background/10 dark:bg-background/55" />
          <ConfigHealthBanner />
          <div className="relative z-10 flex w-full max-w-5xl items-center justify-center">
            <QuickAdd className="h-auto" />
          </div>
        </main>
      </div>

      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent showCloseButton={false} className="max-w-sm">
          <DialogHeader>
            <DialogTitle>退出登录</DialogTitle>
            <DialogDescription>确定要退出登录吗？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={() => setLogoutDialogOpen(false)}>确认退出</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default HomeLayout
