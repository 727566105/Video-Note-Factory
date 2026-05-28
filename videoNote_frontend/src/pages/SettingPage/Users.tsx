import { useEffect, useState } from 'react'
import request from '@/utils/request'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Trash2, Edit2, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useIsMobile } from '@/hooks/use-mobile'

interface User {
  id: number
  username: string
  role: string
  created_at: string
}

const formatTime = (iso: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface UserUpdatePayload {
  username?: string
  password?: string
  role?: string
}

interface ApiError {
  detail?: string
}

const Users = () => {
  const isMobile = useIsMobile()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'user' })
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'user' })

  // 删除确认弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  // 普通用户修改密码
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  const currentUser = useAuthStore(state => state.user)
  const isAdmin = useAuthStore(state => state.isAdmin())

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await request.get<{ id: number; username: string; role: string }[]>('/auth/users')
      setUsers(res)
    } catch {
      toast.error('加载用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadUsers()
    }
  }, [isAdmin])

  const handleAdd = async () => {
    if (!addForm.username || !addForm.password) {
      toast.error('请填写用户名和密码')
      return
    }
    try {
      await request.post('/auth/users', addForm)
      toast.success('用户创建成功')
      setAdding(false)
      setAddForm({ username: '', password: '', role: 'user' })
      loadUsers()
    } catch (err: unknown) {
      const apiError = err as ApiError
      toast.error(apiError?.detail || '创建失败')
    }
  }

  const handleUpdate = async (id: number) => {
    try {
      const payload: UserUpdatePayload = {}
      if (editForm.username) payload.username = editForm.username
      if (editForm.password) payload.password = editForm.password
      if (editForm.role) payload.role = editForm.role
      await request.put(`/auth/users/${id}`, payload)
      toast.success('用户更新成功')
      setEditing(null)
      loadUsers()
    } catch (err: unknown) {
      const apiError = err as ApiError
      toast.error(apiError?.detail || '更新失败')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await request.delete(`/auth/users/${id}`)
      toast.success('用户删除成功')
      loadUsers()
    } catch (err: unknown) {
      const apiError = err as ApiError
      toast.error(apiError?.detail || '删除失败')
    }
  }

  const startEdit = (user: User) => {
    setEditing(user.id)
    setEditForm({ username: user.username, password: '', role: user.role })
  }

  // 普通用户修改密码
  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('请填写所有字段')
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
    setChangingPassword(true)
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
      setChangingPassword(false)
    }
  }

  // 普通用户：只显示修改密码表单
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6 p-4 md:p-6">
        {/* 标题 - 仅桌面端显示 */}
        {!isMobile && (
          <h3 className="text-lg font-semibold">修改密码</h3>
        )}
        <div className="max-w-md rounded-lg border bg-muted p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">当前用户</label>
              <div className="text-sm text-muted-foreground">{currentUser?.username}</div>
            </div>
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
                placeholder="请输入新密码（至少6位）"
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
            <Button className="mt-2 w-fit" onClick={handleChangePassword} disabled={changingPassword}>
              {changingPassword ? '修改中...' : '确认修改'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 管理员：完整的用户管理
  return (
    <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-6">
      {/* 标题 - 仅桌面端显示 */}
      {!isMobile && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">用户管理</h3>
        </div>
      )}
      {/* 新增按钮 */}
      <Button onClick={() => setAdding(true)} disabled={adding} size={isMobile ? 'sm' : 'default'} className="w-full md:w-auto">
        <Plus className="mr-1 h-4 w-4" />
        新增用户
      </Button>

      {adding && (
        <div className="rounded-lg border bg-muted p-3 md:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <Input
              placeholder="用户名"
              value={addForm.username}
              onChange={e => setAddForm({ ...addForm, username: e.target.value })}
            />
            <Input
              placeholder="密码"
              type="password"
              value={addForm.password}
              onChange={e => setAddForm({ ...addForm, password: e.target.value })}
            />
            <select
              className="rounded-md border px-3 py-2 text-sm"
              value={addForm.role}
              onChange={e => setAddForm({ ...addForm, role: e.target.value })}
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size={isMobile ? 'sm' : 'default'} onClick={handleAdd}>确认创建</Button>
            <Button size={isMobile ? 'sm' : 'default'} variant="outline" onClick={() => setAdding(false)}>取消</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-8">加载中...</div>
      ) : isMobile ? (
        // 移动端：卡片视图
        <div className="flex flex-col gap-3">
          {users.map(user => (
            <div key={user.id} className="rounded-lg border p-3">
              {editing === user.id ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ID: {user.id}</span>
                  </div>
                  <Input
                    value={editForm.username}
                    onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                    placeholder="用户名"
                  />
                  <Input
                    type="password"
                    placeholder="新密码（留空不修改）"
                    value={editForm.password}
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                  />
                  <select
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    value={editForm.role}
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="user">普通用户</option>
                    <option value="admin">管理员</option>
                  </select>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" onClick={() => handleUpdate(user.id)}>保存</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(null)}>取消</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {user.role === 'admin' ? '管理员' : '普通用户'} · {formatTime(user.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(user)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {user.username !== 'admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500"
                        onClick={() => {
                          setPendingDeleteId(user.id)
                          setDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // 桌面端：表格视图
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted text-left">
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">用户名</th>
              <th className="px-4 py-2 font-medium">密码</th>
              <th className="px-4 py-2 font-medium">角色</th>
              <th className="px-4 py-2 font-medium">创建时间</th>
              <th className="px-4 py-2 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b">
                {editing === user.id ? (
                  <>
                    <td className="px-4 py-2">{user.id}</td>
                    <td className="px-4 py-2">
                      <Input
                        value={editForm.username}
                        onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="password"
                        placeholder="留空不修改"
                        value={editForm.password}
                        onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="rounded-md border px-2 py-1"
                        value={editForm.role}
                        onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                      >
                        <option value="user">普通用户</option>
                        <option value="admin">管理员</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">{formatTime(user.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" onClick={() => handleUpdate(user.id)}>保存</Button>
                      <Button size="sm" variant="outline" className="ml-1" onClick={() => setEditing(null)}>取消</Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2">{user.id}</td>
                    <td className="px-4 py-2">{user.username}</td>
                    <td className="px-4 py-2 text-muted-foreground">******</td>
                    <td className="px-4 py-2">{user.role === 'admin' ? '管理员' : '普通用户'}</td>
                    <td className="px-4 py-2">{formatTime(user.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(user)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {user.username !== 'admin' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1 text-red-500"
                          onClick={() => {
                            setPendingDeleteId(user.id)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="删除用户"
        description="确定删除该用户？"
        confirmText="删除"
        variant="destructive"
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
      />
    </div>
  )
}

export default Users