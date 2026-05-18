/**
 * 获取 API 基础 URL
 * 从环境变量 VITE_API_BASE_URL 读取，去除尾部斜杠
 * 如果未配置则返回空字符串
 */
export const getBaseURL = (): string => {
  return (String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || '').replace('/api', '')
}

/**
 * 获取 API 基础 URL（带 /api 前缀）
 * 用于 request 封装等场景
 */
export const getApiBaseURL = (): string => {
  const base = import.meta.env.VITE_API_BASE_URL
  return base ? `${base.replace(/\/$/, '')}/api` : '/api'
}