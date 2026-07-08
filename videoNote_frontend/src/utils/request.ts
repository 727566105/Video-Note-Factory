import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner'

import { getApiBaseURL } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { useTaskStore } from '@/store/taskStore'

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

// 响应拦截器（剥壳契约）
// 成功（code === 0）：return res.data —— 剥掉 {code,msg,data} 外壳，调用方拿到的就是裸 data。
// 失败：Promise.reject 并自动 toast。
// ⚠️ 组件层不要判 response.code：request.xxx() 成功 resolve 出的就是裸 data，直接用；
//    误写 if (response.code === 200) 会永远走失败分支（曾导致「导入配置 → 文件解析失败」bug）。
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
  (error) => {
    // 请求被取消（组件重渲染/卸载），静默跳过
    if (error.code === 'ERR_CANCELED' || error.code === 'ECONNABORTED') {
      return Promise.reject(error)
    }
    // 401 未认证，清除 token 并跳转登录
    if (error.response?.status === 401) {
      const { token, logout } = useAuthStore.getState()
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