import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast'

// 统一响应类型
export interface IResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

const baseURL = import.meta.env.VITE_API_BASE_URL;

// 创建实例
 const request: AxiosInstance = axios.create({
  baseURL: baseURL || '/api',
  timeout: 10000,
});

// 请求拦截器：注入 token
request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    try {
      const raw = localStorage.getItem('auth-storage')
      if (raw) {
        const { state } = JSON.parse(raw)
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`
        }
      }
    } catch {}
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器
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
    // 401 未认证，清除 token 并跳转登录
    if (error.response?.status === 401) {
      try {
        const raw = localStorage.getItem('auth-storage')
        if (raw) {
          const { state } = JSON.parse(raw)
          if (state?.token) {
            localStorage.removeItem('auth-storage')
            toast.error('登录已过期，请重新登录')
            window.location.href = '/login'
            return Promise.reject(error)
          }
        }
      } catch {}
    }

    const silent = error.config?.headers?.['X-Silent']
    const res = error?.response?.data as IResponse | undefined;
    if (!silent) {
      if (res) {
        toast.error(res.msg || '服务器错误，请稍后再试');
      } else {
        toast.error( '请求失败，请检查网络连接或稍后再试')
      }
    }
    return Promise.reject(res || {
      code: -1,
      msg: '请求失败，请检查网络连接',
      data: null
    } as IResponse);
  }
);

export default request