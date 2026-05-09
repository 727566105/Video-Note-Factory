import { useEffect, useState } from 'react'
import request from '@/utils/request'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'react-hot-toast'
import { Trash2, Edit2, Plus } from 'lucide-react'

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
    loadUsers()
  }, [])

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