import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useTaskStore } from '@/store/taskStore'
import request from '@/utils/request'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"

const REMEMBERED_USERNAME_KEY = 'remembered-username'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  // 从 localStorage 读取记住的用户名
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBERED_USERNAME_KEY) || '')
  const [password, setPassword] = useState('')
  const [rememberUser, setRememberUser] = useState(() => !!localStorage.getItem(REMEMBERED_USERNAME_KEY))
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore(state => state.setAuth)

  // rememberUser 变化时同步 localStorage
  useEffect(() => {
    if (rememberUser && username) {
      localStorage.setItem(REMEMBERED_USERNAME_KEY, username)
    } else if (!rememberUser) {
      localStorage.removeItem(REMEMBERED_USERNAME_KEY)
    }
  }, [rememberUser, username])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      // 登录前先存/清记住的用户名
      if (rememberUser) {
        localStorage.setItem(REMEMBERED_USERNAME_KEY, username)
      } else {
        localStorage.removeItem(REMEMBERED_USERNAME_KEY)
      }

      const res = await request.post<{ token: string; refresh_token?: string; user: { id: number; username: string; role: string } }>('/auth/login', { username, password, remember_me: rememberMe })
      useTaskStore.getState().clearTasks()  // 清空前一个用户的残留任务
      setAuth(res.token, res.user, res.refresh_token || null)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { msg?: string })?.msg || '登录失败'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">登录你的账户</h1>
          <p className="text-sm text-balance text-muted-foreground">
            输入用户名和密码登录
          </p>
        </div>
        <Field>
          <FieldLabel htmlFor="username">用户名</FieldLabel>
          <Input
            id="username"
            type="text"
            placeholder="请输入用户名"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </Field>
        {/* 记住用户名 + 7天免登录 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-user"
              checked={rememberUser}
              onCheckedChange={(checked) => setRememberUser(checked === true)}
            />
            <label htmlFor="remember-user" className="text-sm text-muted-foreground cursor-pointer select-none">
              记住用户名
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer select-none">
              7天免登录
            </label>
          </div>
        </div>
        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
        <Field>
          <Button type="submit" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  )
}
