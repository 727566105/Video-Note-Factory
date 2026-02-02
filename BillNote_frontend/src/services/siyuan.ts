import request from '@/utils/request.ts'

// 获取思源笔记配置
export const getConfig = async () => {
  return await request.get('/siyuan/config')
}

// 保存思源笔记配置
export const saveConfig = async (data: {
  api_url: string
  api_token: string
  default_notebook?: string
}) => {
  return await request.post('/siyuan/config', data)
}

// 更新思源笔记配置
export const updateConfig = async (data: {
  id?: number
  api_url: string
  api_token: string
  default_notebook?: string
}) => {
  return await request.put('/siyuan/config', data)
}

// 获取思源笔记本列表
export const getNotebooks = async (api_url?: string, api_token?: string) => {
  // 如果提供了参数，作为查询参数传递
  const params = api_url && api_token ? { api_url, api_token } : {}
  return await request.get('/siyuan/notebooks', { params })
}

// 测试思源笔记连接
export const testConnection = async (data: { api_url: string; api_token: string }) => {
  return await request.post('/siyuan/test', data)
}

// 导出笔记到思源
export const exportToSiyuan = async (taskId: string) => {
  return await request.post(`/siyuan/export/siyuan/${taskId}`)
}

// 获取导出历史
export const getExportHistory = async () => {
  return await request.get('/siyuan/history')
}

// 获取指定任务的导出历史
export const getTaskExportHistory = async (taskId: string) => {
  return await request.get(`/siyuan/history/${taskId}`)
}
