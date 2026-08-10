import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

// 用可变对象控制 useAuthStore 的返回，便于切换场景
const authState: {
  token: string | null
  refresh_token: string | null
  setToken: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
} = {
  token: 'access-token',
  refresh_token: 'refresh-token',
  setToken: vi.fn(),
  logout: vi.fn(),
}

const mockedAxios = vi.mocked(axios, { deep: true })

// 最小化的错误/配置类型（仅覆盖拦截器用到的字段）
interface ErrConfig {
  url?: string
  headers?: Record<string, string>
  _retried?: boolean
}
interface ErrLike {
  response?: { status?: number }
  config?: ErrConfig
  code?: string
}
interface FakeAxiosInstance {
  (config?: unknown): Promise<unknown>
  interceptors: {
    request: { use: ReturnType<typeof vi.fn> }
    response: { use: ReturnType<typeof vi.fn> }
  }
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

vi.mock('axios')
vi.mock('@/store/authStore', () => ({
  useAuthStore: { getState: () => authState },
}))
vi.mock('@/store/taskStore', () => ({
  useTaskStore: { getState: () => ({ clearTasks: vi.fn() }) },
}))
vi.mock('@/utils/api', () => ({
  getApiBaseURL: () => '/api',
}))
vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}))

// 捕获 response 拦截器的错误处理函数
let onRejected: (error: ErrLike) => Promise<unknown>
let requestImpl: ReturnType<typeof vi.fn>

// 造一个 401 错误
function make401(config: Partial<ErrConfig> = {}): ErrLike {
  return {
    response: { status: 401 },
    config: { url: '/api/foo', headers: {}, ...config },
    code: 'ERR_BAD_REQUEST',
  }
}

// 造一个可控的延迟 Promise（用于模拟 refresh 进行中）
function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('request.ts 响应拦截器 - 401 刷新/登出', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.token = 'access-token'
    authState.refresh_token = 'refresh-token'
    requestImpl = vi.fn().mockResolvedValue({ data: 'retried-ok' })

    // 避免 jsdom 对 window.location.href 赋值的 "Not implemented" 噪音
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      configurable: true,
      writable: true,
    })

    const fakeInstance = Object.assign(requestImpl, {
      interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    }) as FakeAxiosInstance
    mockedAxios.create.mockReturnValue(fakeInstance)
    // raw axios.post（tryRefreshToken 内使用）
    mockedAxios.post.mockResolvedValue({ data: { code: 0, data: { token: 'new-access-token' } } })

    // 重载模块以注册拦截器
    vi.resetModules()
    return import('@/utils/request').then(() => {
      // 取出 error handler
      const useCall = fakeInstance.interceptors.response.use
      const [onFulfilled, onErr] = useCall.mock.calls[0]
      void onFulfilled
      onRejected = onErr
    })
  })

  it('有 refresh_token 时 401 -> 刷新并重放原请求', async () => {
    const result = await onRejected(make401({}))
    // 调用了 /auth/refresh（raw axios.post）
    expect(mockedAxios.post).toHaveBeenCalledWith(
      '/api/auth/refresh',
      { refresh_token: 'refresh-token' },
    )
    // setToken 用新 token 更新
    expect(authState.setToken).toHaveBeenCalledWith('new-access-token')
    // 原请求用新 token 重放
    expect(requestImpl).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ data: 'retried-ok' })
  })

  it('并发 401 只触发一次刷新，其余排队后重放', async () => {
    const d = deferred<{ data: { code: number; data: { token: string } } }>()
    mockedAxios.post.mockReturnValueOnce(d.promise) // 第一次刷新挂起

    const p1 = onRejected(make401({ url: '/api/a' })) // 进入刷新
    const p2 = onRejected(make401({ url: '/api/b' })) // 排队等待

    // 刷新完成
    d.resolve({ data: { code: 0, data: { token: 'new-access-token' } } })

    await p1
    await p2

    // 只调了一次 /auth/refresh
    expect(mockedAxios.post).toHaveBeenCalledTimes(1)
    // 两个请求都被重放
    expect(requestImpl).toHaveBeenCalledTimes(2)
  })

  it('refresh 请求本身 401 -> 登出并清空任务', async () => {
    const { toast } = await import('sonner')
    await expect(onRejected(make401({ url: '/api/auth/refresh' }))).rejects.toBeDefined()
    expect(authState.logout).toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it('无 refresh_token -> 直接登出', async () => {
    authState.refresh_token = null
    await expect(onRejected(make401({}))).rejects.toBeDefined()
    expect(authState.logout).toHaveBeenCalled()
    // 不调用刷新
    expect(mockedAxios.post).not.toHaveBeenCalled()
  })

  it('刷新失败（返回 code!=0）-> 登出', async () => {
    mockedAxios.post.mockResolvedValue({ data: { code: 1, msg: 'fail', data: null } })
    await expect(onRejected(make401({}))).rejects.toBeDefined()
    expect(authState.logout).toHaveBeenCalled()
  })
})
