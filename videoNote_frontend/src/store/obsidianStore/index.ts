import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getConfig,
  saveConfig,
  updateConfig,
  testConnection,
  exportToObsidian,
  getExportHistory,
} from '@/services/obsidian'

interface ObsidianConfig {
  id?: number
  export_mode: string
  vault_path?: string
  folder_path?: string
  attachments_folder?: string
  api_url?: string
  api_key?: string
  enabled?: number
}

interface ObsidianExportHistory {
  id: number
  task_id: string
  export_mode: string
  file_path: string
  status: string
  error_message: string
  created_at: string
}

interface ObsidianStore {
  // 状态
  config: ObsidianConfig | null
  exportHistory: ObsidianExportHistory[]
  isConfigured: boolean
  isTesting: boolean
  isExporting: boolean

  // 操作
  loadConfig: () => Promise<void>
  saveConfig: (config: ObsidianConfig) => Promise<void>
  updateConfig: (config: ObsidianConfig) => Promise<void>
  testConnection: (config: ObsidianConfig) => Promise<{ success: boolean; message: string }>
  exportNote: (taskId: string, contentSections?: Record<string, any>) => Promise<any>
  loadExportHistory: () => Promise<void>
  clearConfig: () => void
}

// 判断是否为脱敏占位符（后端返回 ******** 或含 ... 的截断格式）
const isMaskedKey = (key: string | undefined | null): boolean => {
  if (!key) return false
  return key === '********' || key.includes('...')
}

export const useObsidianStore = create<ObsidianStore>()(
  persist(
    (set, get) => ({
      // 状态
      config: null,
      exportHistory: [],
      isConfigured: false,
      isTesting: false,
      isExporting: false,

      // 加载配置
      loadConfig: async () => {
        try {
          const data = await getConfig()
          if (data) {
            // 后端返回的 api_key 是脱敏的（********）
            // 优先保留 localStorage 中已有的完整 key
            const state = get()
            const existingKey = state.config?.api_key
            const finalKey = isMaskedKey(data.api_key) && existingKey && !isMaskedKey(existingKey)
              ? existingKey  // 用本地完整 key
              : data.api_key  // 用后端返回值

            set({
              config: {
                ...data,
                api_key: finalKey,
              },
              isConfigured: true,
            })
          } else {
            // 后端无配置
            set({ config: null, isConfigured: false })
          }
        } catch (error) {
          // 静默失败，不打扰用户
        }
      },

      // 保存配置
      saveConfig: async (config) => {
        try {
          const result = await saveConfig(config)
          // 保存成功后，使用用户输入的完整配置 + 后端返回的 id
          set({ config: { ...config, id: result?.id ?? config.id }, isConfigured: true })
        } catch (error) {
          throw error
        }
      },

      // 更新配置
      updateConfig: async (config) => {
        try {
          // 关键：如果表单中 api_key 是脱敏占位符或空字符串，
          // 说明用户没重新输入 key，应保留本地存储的完整 key 传给后端
          const state = get()
          let payload = { ...config }
          if (isMaskedKey(config.api_key) || !config.api_key) {
            // 用户未重新输入 key，用本地保存的完整 key
            if (state.config?.api_key && !isMaskedKey(state.config.api_key)) {
              payload.api_key = state.config.api_key
            }
          }
          await updateConfig(payload)
          // 更新成功后，使用包含完整 key 的配置
          set({ config: { ...payload }, isConfigured: true })
        } catch (error) {
          throw error
        }
      },

      // 测试连接
      testConnection: async (config) => {
        set({ isTesting: true })
        try {
          // 测试连接时，如果 api_key 是脱敏的，尝试用本地完整 key
          let testConfig = { ...config }
          if (isMaskedKey(config.api_key) || !config.api_key) {
            const state = get()
            if (state.config?.api_key && !isMaskedKey(state.config.api_key)) {
              testConfig.api_key = state.config.api_key
            }
          }
          const data = await testConnection({
            export_mode: testConfig.export_mode,
            vault_path: testConfig.vault_path,
            api_url: testConfig.api_url,
            api_key: testConfig.api_key,
          })
          set({ isTesting: false })
          if (!data) {
            return { success: false, message: '服务器返回空响应' }
          }
          return { success: data.success || false, message: data.message || '连接失败' }
        } catch (error: any) {
          set({ isTesting: false })
          // request 拦截器 reject 的是 {code, msg, data} 结构
          const msg = error?.msg || error?.message || '连接失败'
          return { success: false, message: typeof msg === 'string' ? msg : '连接失败' }
        }
      },

      // 导出笔记
      exportNote: async (taskId, contentSections) => {
        set({ isExporting: true })
        try {
          const result = await exportToObsidian(taskId, contentSections)
          await get().loadExportHistory()
          return result
        } catch (error) {
          throw error
        } finally {
          set({ isExporting: false })
        }
      },

      // 加载导出历史
      loadExportHistory: async () => {
        try {
          const data = await getExportHistory()
          // 后端返回 {history: [...], total: N}，需要提取 history 数组
          if (Array.isArray(data)) {
            set({ exportHistory: data })
          } else if (data && Array.isArray(data.history)) {
            set({ exportHistory: data.history })
          } else {
            set({ exportHistory: [] })
          }
        } catch (error) {
          // 静默失败，避免历史加载失败影响主流程
        }
      },

      // 清除配置
      clearConfig: () => {
        set({ config: null, isConfigured: false, exportHistory: [] })
      },
    }),
    {
      name: 'obsidian-storage',
      partialize: state => ({
        config: state.config,
        isConfigured: state.isConfigured,
      }),
    }
  )
)
