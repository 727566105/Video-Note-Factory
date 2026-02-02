import request from '@/utils/request.ts'

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

// 手动触发备份
export const createBackup = async (backupType: string = 'manual') => {
  return await request.post('/webdav/backup', null, {
    params: { backup_type: backupType }
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

// 从上传的文件恢复数据
export const restoreFromUpload = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)

  return await request.post('/webdav/restore/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
}
