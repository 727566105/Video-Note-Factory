import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner'

import { getApiBaseURL } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { useTaskStore } from '@/store/taskStore'

// 扩展 axios config，支持重试标记
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retried?: boolean
  }
}

// 统一响应类型
export interface IResponse<T = unknown> {
  code: number;
  msg: string;
  data: T;
}

const baseURL = getApiBaseURL();

// 创建实例
 const request: AxiosInstance = axios.create({
  baseURL: baseURL || '/api',
  timeout: 30000,
});

// 请求拦截器：注入 token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ---- refresh token 并发锁 ----
let isRefreshing = false
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (e: unknown) => void }> = []

async function tryRefreshToken(): Promise<string | null> {
  const { refresh_token, setToken } = useAuthStore.getState()
  if (!refresh_token) return null

  try {
    // 用原始 axios 调 /auth/refresh（不走拦截器，避免循环）
    const resp = await axios.post(`${baseURL || '/api'}/auth/refresh`, { refresh_token })
    const res = resp.data
    if (res.code === 0 && res.data?.token) {
      setToken(res.data.token)
      return res.data.token
    }
    return null
  } catch {
    return null
  }
}

function drainRefreshQueue(token: string | null) {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token)
    else reject(new Error('refresh failed'))
  })
  refreshQueue = []
}

// 响应拦截器（剥壳契约）
// 成功（code === 0）：return res.data -- 剥掉 {code,msg,data} 外壳，调用方拿到的就是裸 data。
// 失败：Promise.reject 并自动 toast。
// ⚠️ 组件层不要判 response.code：request.xxx() 成功 resolve 出的就是裸 data，直接用；
//    误写 if (response.code === 200) 会永远走失败分支（曾导致「导入配置 -> 文件解析失败」bug）。
request.interceptors.response.use(
  (response: AxiosResponse<IResponse>) => {
    const res = response.data;
    if (res.code === 0) {
      return res.data;
    } else {
      const silent = response.config?.headers?.['X-Silent']
      if (!silent) {
        toast.error(res.msg || '操作失败，请稍后再试');
      }
      return Promise.reject(res);
    }
  },
  async (error) => {
    // 请求被取消（组件重渲染/卸载），静默跳过
    if (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED') {
      return Promise.reject(error)
    }

    const originalConfig = error.config

    // 401 未认证
    if (error.response?.status === 401) {
      const { token, refresh_token, logout } = useAuthStore.getState()

      // /auth/refresh 本身 401 -> refresh token 也过期了，直接登出
      if (originalConfig?.url?.includes('/auth/refresh')) {
        if (token) {
          useTaskStore.getState().clearTasks()
          logout()
          toast.error('登录已过期，请重新登录')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      // 有 refresh_token -> 尝试刷新
      if (token && refresh_token && !originalConfig?._retried) {
        originalConfig._retried = true

        // 如果已经在刷新，排队等待
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            refreshQueue.push({
              resolve: (newToken) => {
                originalConfig.headers.Authorization = `Bearer ${newToken}`
                resolve(request(originalConfig))
              },
              reject,
            })
          })
        }

        // 第一个 401 执行刷新
        isRefreshing = true
        const newToken = await tryRefreshToken()
        isRefreshing = false
        drainRefreshQueue(newToken)

        if (newToken) {
          originalConfig.headers.Authorization = `Bearer ${newToken}`
          return request(originalConfig)
        }

        // 刷新失败 -> 登出
        useTaskStore.getState().clearTasks()
        logout()
        toast.error('登录已过期，请重新登录')
        window.location.href = '/login'
        return Promise.reject(error)
      }

      // 无 refresh_token -> 直接登出
      if (token) {
        useTaskStore.getState().clearTasks()
        logout()
        toast.error('登录已过期，请重新登录')
        window.location.href = '/login'
        return Promise.reject(error)
      }
    }

    const silent = error.config?.headers?.['X-Silent']
    const res = error?.response?.data as IResponse | undefined;
    if (!silent) {
      // detail 可能是数组（Pydantic 校验错误），需提取成字符串
      let detailMsg: string | undefined
      if (res?.detail) {
        if (typeof res.detail === 'string') {
          detailMsg = res.detail
        } else if (Array.isArray(res.detail)) {
          detailMsg = res.detail.map((d: any) => d?.msg).filter(Boolean).join('; ') || '请求参数有误'
        } else if (typeof res.detail === 'object' && res.detail !== null) {
          detailMsg = (res.detail as any).msg || JSON.stringify(res.detail)
        }
      }
      if (res) {
        toast.error(res.msg || detailMsg || '服务器错误，请稍后再试');
      } else {
        toast.error( '请求失败，请检查网络连接或稍后再试')
      }
    }
    return Promise.reject({
      code: error.response?.status || -1,
      msg: res?.msg || (typeof res?.detail === 'string' ? res.detail : '请求失败，请检查网络连接'),
      data: null
    } as IResponse);
  }
);

export default request
