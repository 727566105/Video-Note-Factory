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
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex flex-1 overflow-hidden">
        {/* 主内容区 */}
        <main className="flex-1 overflow-hidden flex flex-col items-center justify-center p-4 md:p-6">
          <ConfigHealthBanner />
          <div className="w-full max-w-2xl">
            <QuickAdd />
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
