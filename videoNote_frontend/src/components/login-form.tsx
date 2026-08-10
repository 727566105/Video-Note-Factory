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
const REMEMBER_ME_KEY = 'remember-me'

// localStorage 可能被禁用/抛 SecurityError（如隐私模式），读写需兜底，避免组件崩溃
function safeLocalGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeLocalSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* 存储不可用时静默降级 */
  }
}
function safeLocalRemove(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 存储不可用时静默降级 */
  }
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  // 从 localStorage 读取记住的用户名
  const [username, setUsername] = useState(() => safeLocalGet(REMEMBERED_USERNAME_KEY) || '')
  const [password, setPassword] = useState('')
  const [rememberUser, setRememberUser] = useState(() => !!safeLocalGet(REMEMBERED_USERNAME_KEY))
  const [rememberMe, setRememberMe] = useState(() => safeLocalGet(REMEMBER_ME_KEY) === 'true')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  // 图形验证码（连续失败达到阈值后后端要求）
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [captchaId, setCaptchaId] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore(state => state.setAuth)

  // rememberUser 变化时同步 localStorage
  useEffect(() => {
    if (rememberUser && username) {
      safeLocalSet(REMEMBERED_USERNAME_KEY, username)
    } else if (!rememberUser) {
      safeLocalRemove(REMEMBERED_USERNAME_KEY)
    }
  }, [rememberUser, username])

  // rememberMe 变化时同步 localStorage（保持"7天免登录"偏好）
  useEffect(() => {
    if (rememberMe) {
      safeLocalSet(REMEMBER_ME_KEY, 'true')
    } else {
      safeLocalRemove(REMEMBER_ME_KEY)
    }
  }, [rememberMe])

  // 拉取一张新验证码（用于"换一张"或首次出现时）
  const refreshCaptcha = async () => {
    try {
      const data = await request.get<{ captcha_id: string; image: string }>('/auth/captcha')
      setCaptchaId(data.captcha_id)
      setCaptchaImage(data.image)
    } catch {
      // 验证码获取失败不阻塞登录，下次 428 会重新触发
    }
  }

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
        safeLocalSet(REMEMBERED_USERNAME_KEY, username)
      } else {
        safeLocalRemove(REMEMBERED_USERNAME_KEY)
      }

      const payload: Record<string, unknown> = {
        username,
        password,
        remember_me: rememberMe,
      }
      if (showCaptcha) {
        payload.captcha_id = captchaId
        payload.captcha_code = captchaCode
      }
      const res = await request.post<{ token: string; refresh_token?: string; user: { id: number; username: string; role: string } }>('/auth/login', payload)
      useTaskStore.getState().clearTasks()  // 清空前一个用户的残留任务
      setAuth(res.token, res.user, res.refresh_token || null)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const e = err as { code?: number; msg?: string; data?: { captcha_id?: string; image?: string } }
      // 428：需要图形验证码，展示并携带后端返回的新验证码
      if (e?.code === 428 && e.data?.captcha_id) {
        setShowCaptcha(true)
        setCaptchaId(e.data.captcha_id)
        setCaptchaImage(e.data.image || '')
        setCaptchaCode('')
        setError(e.msg || '请输入图形验证码')
      } else {
        setError(e?.msg || '登录失败')
      }
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
        {showCaptcha && captchaImage && (
          <Field>
            <div className="flex items-end gap-2">
              <img
                src={`data:image/png;base64,${captchaImage}`}
                alt="图形验证码"
                className="h-10 w-auto rounded border border-border"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-10 shrink-0"
                onClick={refreshCaptcha}
                disabled={loading}
              >
                换一张
              </Button>
            </div>
            <Input
              id="captcha"
              type="text"
              placeholder="请输入图形验证码"
              value={captchaCode}
              onChange={e => setCaptchaCode(e.target.value)}
              autoComplete="off"
            />
          </Field>
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
