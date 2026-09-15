import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// Mock 依赖：路由、store、request
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ setAuth: vi.fn() }),
}))
vi.mock('@/store/taskStore', () => ({
  useTaskStore: {
    getState: () => ({ clearTasks: vi.fn() }),
  },
}))
vi.mock('@/utils/request', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ token: 't', user: {}, refresh_token: 'r' }),
    get: vi.fn().mockResolvedValue({ captcha_id: 'new-captcha', image: 'AAA' }),
  },
}))

import { LoginForm } from '@/components/login-form'
import request from '@/utils/request'

const REMEMBER_ME_KEY = 'remember-me'

// 拿到 mock 的 request.post / request.get，便于按用例控制
const mockedRequest = request as unknown as {
  post: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
}

// 每次测试前清空 localStorage，保证隔离
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  mockedRequest.post.mockResolvedValue({ token: 't', user: {}, refresh_token: 'r' })
  mockedRequest.get.mockResolvedValue({ captcha_id: 'new-captcha', image: 'AAA' })
})

// 用 MemoryRouter 包裹（LoginForm 依赖 useNavigate）
function renderLogin() {
  return render(<MemoryRouter><LoginForm /></MemoryRouter>)
}

// 找到"7天免登录"checkbox（按 label 文本定位）
function getRememberMeCheckbox() {
  return screen.getByLabelText('7天免登录') as HTMLButtonElement
}

describe('LoginForm 7天免登录 持久化', () => {
  it('localStorage 无 remember-me 时，勾选框默认未勾选', () => {
    renderLogin()
    expect(getRememberMeCheckbox()).not.toHaveAttribute('data-state', 'checked')
  })

  it('勾选后写入 localStorage: remember-me=true', () => {
    renderLogin()
    act(() => fireEvent.click(getRememberMeCheckbox()))
    expect(localStorage.getItem(REMEMBER_ME_KEY)).toBe('true')
  })

  it('取消勾选后移除 localStorage key', () => {
    localStorage.setItem(REMEMBER_ME_KEY, 'true')
    renderLogin()
    // 初始应为勾选态
    expect(getRememberMeCheckbox()).toHaveAttribute('data-state', 'checked')
    act(() => fireEvent.click(getRememberMeCheckbox()))
    expect(localStorage.getItem(REMEMBER_ME_KEY)).toBeNull()
  })

  it('localStorage 为 true 时，重新挂载后勾选框保持勾选（偏好被记住）', () => {
    localStorage.setItem(REMEMBER_ME_KEY, 'true')
    const { unmount } = renderLogin()
    expect(getRememberMeCheckbox()).toHaveAttribute('data-state', 'checked')
    unmount()

    // 模拟再次访问登录页（组件重新挂载）
    renderLogin()
    expect(getRememberMeCheckbox()).toHaveAttribute('data-state', 'checked')
  })

  it('localStorage 为垃圾/假值时，勾选框不勾选（稳健降级）', () => {
    localStorage.setItem(REMEMBER_ME_KEY, 'garbage')
    renderLogin()
    expect(getRememberMeCheckbox()).not.toHaveAttribute('data-state', 'checked')
  })

  it('localStorage 抛异常（隐私模式禁用）时组件仍能正常渲染', () => {
    // 模拟 localStorage 不可用：读写都抛 SecurityError
    const getSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    const setSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('SecurityError') })
    const rmSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('SecurityError') })
    try {
      // 不应崩溃，登录表单完整渲染
      renderLogin()
      expect(getRememberMeCheckbox()).not.toHaveAttribute('data-state', 'checked')
      // 勾选写入也应静默降级，不抛错
      expect(() => act(() => fireEvent.click(getRememberMeCheckbox()))).not.toThrow()
    } finally {
      getSpy.mockRestore()
      setSpy.mockRestore()
      rmSpy.mockRestore()
    }
  })
})

// 填好用户名 + 密码并提交
async function fillAndSubmit(username: string, password: string) {
  fireEvent.change(screen.getByLabelText('用户名'), { target: { value: username } })
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: password } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: '登录' }))
  })
}

describe('LoginForm 图形验证码', () => {
  it('后端返回 428 时显示验证码图片 + 输入框', async () => {
    mockedRequest.post.mockRejectedValue({
      code: 428,
      msg: '请输入图形验证码',
      data: { captcha_id: 'cid-1', image: 'cGF5bG9hZA==' },
    })
    renderLogin()
    await fillAndSubmit('admin', 'wrong')

    expect(screen.getByAltText('图形验证码')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入图形验证码')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '换一张' })).toBeInTheDocument()
  })

  it('提交验证码后请求体携带 captcha_id/captcha_code', async () => {
    // 第一次 428 触发显示验证码，第二次成功
    mockedRequest.post
      .mockRejectedValueOnce({
        code: 428,
        msg: '请输入图形验证码',
        data: { captcha_id: 'cid-1', image: 'cGF5bG9hZA==' },
      })
      .mockResolvedValue({ token: 't', user: {}, refresh_token: 'r' })
    renderLogin()
    await fillAndSubmit('admin', 'wrong')

    // 输入验证码后再次提交
    fireEvent.change(screen.getByPlaceholderText('请输入图形验证码'), {
      target: { value: 'ABCD' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '登录' }))
    })

    const lastCall = mockedRequest.post.mock.calls.at(-1)
    expect(lastCall![0]).toBe('/auth/login')
    expect(lastCall![1]).toMatchObject({
      username: 'admin',
      captcha_id: 'cid-1',
      captcha_code: 'ABCD',
    })
  })

  it('未触发 428 时请求体不含验证码字段', async () => {
    renderLogin()
    await fillAndSubmit('admin', '123456')

    const lastCall = mockedRequest.post.mock.calls.at(-1)
    expect(lastCall![1]).not.toHaveProperty('captcha_id')
    expect(lastCall![1]).not.toHaveProperty('captcha_code')
  })

  it('点击换一张重新拉取验证码', async () => {
    mockedRequest.post.mockRejectedValue({
      code: 428,
      msg: '请输入图形验证码',
      data: { captcha_id: 'cid-1', image: 'cGF5bG9hZA==' },
    })
    renderLogin()
    await fillAndSubmit('admin', 'wrong')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '换一张' }))
    })
    // 调用了 GET /auth/captcha，并更新了验证码
    expect(mockedRequest.get).toHaveBeenCalledWith('/auth/captcha')
    expect(screen.getByAltText('图形验证码')).toHaveAttribute(
      'src',
      'data:image/png;base64,AAA',
    )
  })
})
