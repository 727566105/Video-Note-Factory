import { useState } from 'react'
import { User, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/authStore'
import request from '@/utils/request'

interface ApiError {
  detail?: string
}

const Profile = () => {
  const currentUser = useAuthStore(state => state.user)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有密码字段')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('新密码两次输入不一致')
      return
    }
    if (newPassword.length < 6) {
      toast.error('新密码长度不能少于6位')
      return
    }

    setSaving(true)
    try {
      await request.put('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword,
      })
      toast.success('密码修改成功')
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const apiError = err as ApiError
      toast.error(apiError?.detail || '修改失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <User className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">个人资料</h2>
          <p className="text-sm text-muted-foreground">查看账号信息并更新登录密码</p>
        </div>
      </div>

      <div className="grid max-w-5xl gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>账号信息</CardTitle>
            <CardDescription>当前登录账号</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground">用户名</div>
              <div className="mt-1 font-medium">{currentUser?.username || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">角色</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-sm">
                <ShieldCheck className="size-3.5 text-primary" />
                {currentUser?.role === 'admin' ? '管理员' : '普通用户'}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
            <CardDescription>新密码长度不能少于 6 位</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid max-w-md gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">旧密码</label>
                <Input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  placeholder="请输入旧密码"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">新密码</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="请输入新密码"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">确认新密码</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                />
              </div>
              <Button className="w-fit" onClick={handleChangePassword} disabled={saving}>
                {saving ? '保存中...' : '保存密码'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Profile
