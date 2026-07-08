import request from '@/utils/request'

// 获取 Obsidian 配置
export const getConfig = async () => {
  return await request.get('/obsidian/config')
}

// 保存 Obsidian 配置
export const saveConfig = async (data: {
  export_mode: string
  vault_path?: string
  folder_path?: string
  attachments_folder?: string
  api_url?: string
  api_key?: string
  enabled?: number
}) => {
  return await request.post('/obsidian/config', data)
}

// 更新 Obsidian 配置
export const updateConfig = async (data: {
  id?: number
  export_mode: string
  vault_path?: string
  folder_path?: string
  attachments_folder?: string
  api_url?: string
  api_key?: string
  enabled?: number
}) => {
  return await request.put('/obsidian/config', data)
}

// 测试 Obsidian 连接
export const testConnection = async (data: {
  export_mode: string
  vault_path?: string
  api_url?: string
  api_key?: string
}) => {
  return await request.post('/obsidian/test', data)
}

// 导出笔记到 Obsidian
export const exportToObsidian = async (taskId: string, contentSections?: Record<string, any>) => {
  return await request.post(`/obsidian/export/obsidian/${taskId}`, {
    content_sections: contentSections
  })
}

// 获取导出历史
export const getExportHistory = async () => {
  return await request.get('/obsidian/history')
}

// 获取指定任务的导出历史
export const getTaskExportHistory = async (taskId: string) => {
  return await request.get(`/obsidian/history/${taskId}`)
}
