import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import request from '@/utils/request'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore(state => state.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username || !password) {
      setError('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      const res = await request.post<{ token: string; user: { id: number; username: string; role: string } }>('/auth/login', { username, password })
      setAuth(res.token, res.user)
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
