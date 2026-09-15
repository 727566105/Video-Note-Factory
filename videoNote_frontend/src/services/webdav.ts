import request from '@/utils/request.ts'
import { getApiBaseURL } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'

// ==================== 配置管理 ====================

// 获取 WebDAV 配置
export const getConfig = async () => {
  return await request.get('/webdav/config')
}

// 保存 WebDAV 配置
export const saveConfig = async (data: {
  url: string
  username: string
  password: string
  path?: string
  default_backup_mode?: string
  auto_backup_enabled?: number
  auto_backup_schedule?: string
}) => {
  return await request.post('/webdav/config', data)
}

// 更新 WebDAV 配置
export const updateConfig = async (data: {
  url: string
  username: string
  password: string
  path?: string
  default_backup_mode?: string
  auto_backup_enabled?: number
  auto_backup_schedule?: string
}) => {
  return await request.put('/webdav/config', data)
}

// 删除 WebDAV 配置
export const deleteConfig = async () => {
  return await request.delete('/webdav/config')
}

// 测试 WebDAV 连接
export const testConnection = async (data: {
  url: string
  username: string
  password: string
}) => {
  return await request.post('/webdav/test', data)
}

// ==================== 备份操作 ====================

// 手动触发备份（backupMode: full=全部含媒体 / quick=仅配置）
export const createBackup = async (backupType: string = 'manual', backupMode?: string) => {
  return await request.post('/webdav/backup', null, {
    params: { backup_type: backupType, ...(backupMode ? { backup_mode: backupMode } : {}) }
  })
}

// 获取备份状态
export const getBackupStatus = async () => {
  return await request.get('/webdav/backup/status')
}

// 获取备份列表
export const getBackups = async () => {
  return await request.get('/webdav/backups')
}

// 删除备份文件
export const deleteBackup = async (backupName: string) => {
  return await request.delete(`/webdav/backups/${backupName}`)
}

// ==================== 恢复操作 ====================

// 从备份恢复数据
export const restoreBackup = async (backupName: string) => {
  return await request.post(`/webdav/restore/${backupName}`)
}

// ==================== 定时任务 ====================

// 启用自动备份
export const enableSchedule = async (data: {
  auto_backup_enabled: number
  auto_backup_schedule: string
}) => {
  return await request.post('/webdav/schedule/enable', data)
}

// 更新备份计划
export const updateSchedule = async (data: {
  auto_backup_enabled: number
  auto_backup_schedule: string
}) => {
  return await request.put('/webdav/schedule', data)
}

// 禁用自动备份
export const disableSchedule = async () => {
  return await request.delete('/webdav/schedule')
}

// 获取备份计划
export const getSchedule = async () => {
  return await request.get('/webdav/schedule')
}

// ==================== 备份历史 ====================

// 获取备份历史
export const getHistory = async (limit: number = 50) => {
  return await request.get('/webdav/history', {
    params: { limit }
  })
}

// 获取备份统计
export const getStats = async () => {
  return await request.get('/webdav/stats')
}

// 删除单条备份历史
export const deleteHistory = async (historyId: number) => {
  return await request.delete(`/webdav/history/${historyId}`)
}

// 删除所有备份历史
export const deleteAllHistory = async () => {
  return await request.delete('/webdav/history')
}

// 从上传的文件恢复数据（后端异步执行恢复，此处仅上传+触发，立即返回 {started:true}）
// timeout:0 禁用 axios 超时（1.6G 整机包上传远超默认 30s）；onProgress 上报上传百分比
export const restoreFromUpload = async (file: File, onProgress?: (percent: number) => void) => {
  const formData = new FormData()
  formData.append('file', file)

  return await request.post('/webdav/restore/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    },
  })
}

// ==================== 本地整机包导出/下载 ====================

// 异步触发本地整机包导出
export const exportLocalBackup = async () => {
  return await request.post('/webdav/backup/local')
}

// 列出本地导出的整机包
export const listLocalBackups = async () => {
  return await request.get('/webdav/backup/local')
}

// 拼接下载 URL（浏览器原生跳转下载，带 token query 以支持大文件流式下载）
export const buildDownloadBackupUrl = (filename: string) => {
  const token = useAuthStore.getState().token || ''
  return `${getApiBaseURL()}/webdav/backup/download/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`
}
