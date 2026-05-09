import { useEffect, useState } from 'react'
import request from '@/utils/request'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { Trash2, Edit2, Plus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface User {
  id: number
  username: string
  role: string
  created_at: string
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ username: '', password: '', role: 'user' })
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ username: '', password: '', role: 'user' })

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
      const res: any = await request.get('/auth/users')
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
    } catch (err: any) {
      toast.error(err?.detail || '创建失败')
    }
  }

  const handleUpdate = async (id: number) => {
    try {
      const payload: any = {}
      if (editForm.username) payload.username = editForm.username
      if (editForm.password) payload.password = editForm.password
      if (editForm.role) payload.role = editForm.role
      await request.put(`/auth/users/${id}`, payload)
      toast.success('用户更新成功')
      setEditing(null)
      loadUsers()
    } catch (err: any) {
      toast.error(err?.detail || '更新失败')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该用户？')) return
    try {
      await request.delete(`/auth/users/${id}`)
      toast.success('用户删除成功')
      loadUsers()
    } catch (err: any) {
      toast.error(err?.detail || '删除失败')
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
    } catch (err: any) {
      toast.error(err?.detail || '修改失败')
    } finally {
      setChangingPassword(false)
    }
  }

  // 普通用户：只显示修改密码表单
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <h3 className="text-lg font-semibold">修改密码</h3>
        <div className="max-w-md rounded-lg border bg-gray-50 p-6">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">当前用户</label>
              <div className="text-sm text-gray-600">{currentUser?.username}</div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">旧密码</label>
              <Input
                type="password"
                value={oldPassword}
                onChange={e => setOldPassword(e.target.value)}
                placeholder="请输入旧密码"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">新密码</label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">确认新密码</label>
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">用户管理</h3>
        <Button onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-1 h-4 w-4" />
          新增用户
        </Button>
      </div>

      {adding && (
        <div className="rounded-lg border bg-gray-50 p-4">
          <div className="grid grid-cols-3 gap-4">
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
              className="rounded-md border px-3 py-2"
              value={addForm.role}
              onChange={e => setAddForm({ ...addForm, role: e.target.value })}
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleAdd}>确认创建</Button>
            <Button variant="outline" onClick={() => setAdding(false)}>取消</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500">加载中...</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left">
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
                    <td className="px-4 py-2">{user.created_at}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" onClick={() => handleUpdate(user.id)}>保存</Button>
                      <Button size="sm" variant="outline" className="ml-1" onClick={() => setEditing(null)}>取消</Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2">{user.id}</td>
                    <td className="px-4 py-2">{user.username}</td>
                    <td className="px-4 py-2 text-gray-400">******</td>
                    <td className="px-4 py-2">{user.role === 'admin' ? '管理员' : '普通用户'}</td>
                    <td className="px-4 py-2">{user.created_at}</td>
                    <td className="px-4 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(user)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      {user.username !== 'admin' && (
                        <Button size="sm" variant="ghost" className="ml-1 text-red-500" onClick={() => handleDelete(user.id)}>
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
    </div>
  )
}

export default Users