import request from '@/utils/request.ts'

// ==================== 配置导出 ====================

/**
 * 导出当前配置为 JSON
 */
export const exportConfigs = async () => {
  return await request.get('/configs/export')
}

/**
 * 导出配置为 JSON 文件下载
 */
export const exportConfigsFile = async () => {
  // 获取 baseURL
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

  const response = await fetch(`${baseURL}/configs/export/file`, {
    method: 'GET',
  })

  if (!response.ok) {
    throw new Error('导出配置文件失败')
  }

  // 下载文件
  const blob = await response.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bilinote_configs_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

// ==================== 配置导入 ====================

/**
 * 预览配置导入文件
 * @param file 配置文件
 */
export const previewImport = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  return await request.post('/configs/import/preview', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}

/**
 * 预览配置导入（JSON 数据）
 * @param configData 已解析的配置数据
 */
export const previewImportJson = async (configData: any) => {
  return await request.post('/configs/import/preview/json', { config_data: configData })
}

/**
 * 执行配置导入
 * @param configData 配置数据
 * @param selectedItems 用户选择的配置项
 * @param credentials 敏感信息凭证
 */
export const executeImport = async (
  configData: any,
  selectedItems: string[],
  credentials?: Record<string, Record<string, string>>
) => {
  return await request.post('/configs/import/execute', {
    config_data: configData,
    selected_items: selectedItems,
    credentials: credentials || {},
  })
}

// ==================== 类型定义 ====================

/**
 * 配置预览项
 */
export interface ConfigPreviewItem {
  type: string
  name: string
  count: number
  needs_credentials: boolean
}

/**
 * 配置预览响应
 */
export interface ConfigPreviewResponse {
  version: string
  exported_at: string
  available_items: ConfigPreviewItem[]
  has_sensitive_data: boolean
}

/**
 * 导入结果项
 */
export interface ImportResultItem {
  type: string
  count?: number
  id?: string
  reason?: string
  error?: string
}

/**
 * 导入执行响应
 */
export interface ImportExecuteResponse {
  success: ImportResultItem[]
  failed: ImportResultItem[]
  skipped: ImportResultItem[]
}
