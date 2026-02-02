import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getConfig,
  saveConfig,
  updateConfig as updateConfigApi,
  deleteConfig,
  testConnection,
  createBackup,
  getBackupStatus,
  getBackups,
  deleteBackup as deleteBackupApi,
  restoreBackup,
  restoreFromUpload,
  enableSchedule,
  updateSchedule,
  disableSchedule,
  getSchedule,
} from '@/services/webdav'

interface WebDAVConfig {
  id?: number
  url: string
  username: string
  password: string
  path?: string
  auto_backup_enabled?: number
  auto_backup_schedule?: string
  last_backup_at?: string
}

interface BackupFile {
  name: string
  path: string
  size?: number
}

interface BackupStatus {
  is_busy: boolean
  current_operation: string | null
  progress: number
  message: string
}

interface WebDAVStore {
  // 状态
  config: WebDAVConfig | null
  isConfigured: boolean
  isTesting: boolean
  isBackingUp: boolean
  isRestoring: boolean
  backupStatus: BackupStatus
  backups: BackupFile[]
  schedule: {
    auto_backup_enabled: boolean
    auto_backup_schedule: string
    last_backup_at?: string
  } | null

  // 操作 - 配置管理
  loadConfig: () => Promise<void>
  saveConfig: (config: WebDAVConfig) => Promise<void>
  updateConfig: (config: WebDAVConfig) => Promise<void>
  deleteConfig: () => Promise<void>
  testConnection: (config: WebDAVConfig) => Promise<{ success: boolean; message: string }>

  // 操作 - 备份
  createBackup: () => Promise<void>
  loadBackupStatus: () => Promise<void>
  loadBackups: () => Promise<void>
  deleteBackup: (backupName: string) => Promise<void>

  // 操作 - 恢复
  restoreBackup: (backupName: string) => Promise<void>
  restoreFromUpload: (file: File) => Promise<void>

  // 操作 - 定时任务
  loadSchedule: () => Promise<void>
  enableSchedule: (schedule: string) => Promise<void>
  updateSchedule: (enabled: boolean, schedule: string) => Promise<void>
  disableSchedule: () => Promise<void>
}

export const useWebDAVStore = create<WebDAVStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      config: null,
      isConfigured: false,
      isTesting: false,
      isBackingUp: false,
      isRestoring: false,
      backupStatus: {
        is_busy: false,
        current_operation: null,
        progress: 0,
        message: ''
      },
      backups: [],
      schedule: null,

      // 加载配置
      loadConfig: async () => {
        try {
          const state = get()

          // 如果 localStorage 中已有完整配置（密码不包含...），直接使用
          if (state.config?.password && !state.config.password.includes('...')) {
            return
          }

          // 否则从后端加载配置
          const data = await getConfig()
          if (data?.configured) {
            // 如果 localStorage 中有完整密码，保留它
            if (state.config?.password && !state.config.password.includes('...')) {
              set({
                config: {
                  ...data,
                  password: state.config.password
                },
                isConfigured: true
              })
            } else {
              set({ config: data, isConfigured: true })
            }
          } else {
            if (!state.config) {
              set({ config: null, isConfigured: false })
            }
          }
        } catch (error) {
          console.error('加载 WebDAV 配置失败:', error)
        }
      },

      // 保存配置
      saveConfig: async (config) => {
        try {
          await saveConfig(config)
          set({ config: config, isConfigured: true })
        } catch (error) {
          console.error('保存 WebDAV 配置失败:', error)
          throw error
        }
      },

      // 更新配置
      updateConfig: async (config) => {
        try {
          await updateConfigApi(config)
          set({ config: config, isConfigured: true })
        } catch (error) {
          console.error('更新 WebDAV 配置失败:', error)
          throw error
        }
      },

      // 删除配置
      deleteConfig: async () => {
        try {
          await deleteConfig()
          set({ config: null, isConfigured: false, schedule: null })
        } catch (error) {
          console.error('删除 WebDAV 配置失败:', error)
          throw error
        }
      },

      // 测试连接
      testConnection: async (config) => {
        set({ isTesting: true })
        try {
          const data = await testConnection({
            url: config.url,
            username: config.username,
            password: config.password,
          })
          set({ isTesting: false })
          if (!data) {
            return { success: false, message: '服务器返回空响应' }
          }
          return { success: data.success || false, message: data.message || '连接失败' }
        } catch (error: any) {
          set({ isTesting: false })
          return { success: false, message: error?.message || '连接失败' }
        }
      },

      // 创建备份
      createBackup: async () => {
        // 防止重复调用
        const state = get()
        if (state.isBackingUp) {
          return
        }

        set({ isBackingUp: true })
        try {
          await createBackup('manual')
          await get().loadSchedule()
        } catch (error) {
          console.error('创建备份失败:', error)
          throw error
        } finally {
          set({ isBackingUp: false })
        }
      },

      // 加载备份状态
      loadBackupStatus: async () => {
        try {
          const data = await getBackupStatus()
          set({ backupStatus: data || { is_busy: false, current_operation: null, progress: 0, message: '' } })
        } catch (error) {
          console.error('加载备份状态失败:', error)
        }
      },

      // 加载备份列表
      loadBackups: async () => {
        try {
          const data = await getBackups()
          // 检查是否有密码解密错误
          if (data?.password_error) {
            console.warn('密码解密失败，可能需要重新配置 WebDAV 连接')
            set({ backups: [] })
            return
          }
          set({ backups: data?.backups || [] })
        } catch (error) {
          console.error('加载备份列表失败:', error)
          set({ backups: [] })
        }
      },

      // 删除备份
      deleteBackup: async (backupName) => {
        try {
          await deleteBackupApi(backupName)
          await get().loadBackups()
        } catch (error) {
          console.error('删除备份失败:', error)
          throw error
        }
      },

      // 恢复备份
      restoreBackup: async (backupName) => {
        set({ isRestoring: true })
        try {
          await restoreBackup(backupName)
        } catch (error) {
          console.error('恢复备份失败:', error)
          throw error
        } finally {
          set({ isRestoring: false })
        }
      },

      // 从上传文件恢复
      restoreFromUpload: async (file) => {
        set({ isRestoring: true })
        try {
          await restoreFromUpload(file)
          // 重新加载数据
          window.location.reload()
        } catch (error) {
          console.error('从文件恢复失败:', error)
          throw error
        } finally {
          set({ isRestoring: false })
        }
      },

      // 加载定时任务配置
      loadSchedule: async () => {
        try {
          const data = await getSchedule()
          if (data?.configured) {
            set({
              schedule: {
                auto_backup_enabled: data.auto_backup_enabled,
                auto_backup_schedule: data.auto_backup_schedule,
                last_backup_at: data.last_backup_at
              }
            })
          } else {
            set({ schedule: null })
          }
        } catch (error) {
          console.error('加载定时任务配置失败:', error)
        }
      },

      // 启用自动备份
      enableSchedule: async (schedule) => {
        try {
          await enableSchedule({ auto_backup_enabled: 1, auto_backup_schedule: schedule })
          await get().loadSchedule()
        } catch (error) {
          console.error('启用自动备份失败:', error)
          throw error
        }
      },

      // 更新定时任务
      updateSchedule: async (enabled, schedule) => {
        try {
          await updateSchedule({
            auto_backup_enabled: enabled ? 1 : 0,
            auto_backup_schedule: schedule
          })
          await get().loadSchedule()
        } catch (error) {
          console.error('更新定时任务失败:', error)
          throw error
        }
      },

      // 禁用自动备份
      disableSchedule: async () => {
        try {
          await disableSchedule()
          await get().loadSchedule()
        } catch (error) {
          console.error('禁用自动备份失败:', error)
          throw error
        }
      },
    }),
    {
      name: 'webdav-storage',
      partialize: state => ({
        config: state.config,
        isConfigured: state.isConfigured,
      }),
    }
  )
)
