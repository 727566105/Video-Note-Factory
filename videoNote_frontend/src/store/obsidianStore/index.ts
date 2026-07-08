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
  exportNote: (taskId: string, contentSections?: Record<string, any>) => Promise<void>
  loadExportHistory: () => Promise<void>
  clearConfig: () => void
}

export const useObsidianStore = create<ObsidianStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      config: null,
      exportHistory: [],
      isConfigured: false,
      isTesting: false,
      isExporting: false,

      // 加载配置
      loadConfig: async () => {
        try {
          const state = get()
          const hasFullKey = state.config?.api_key && !state.config.api_key.includes('...') && state.config.api_key !== '********'

          // 如果 localStorage 中已有完整配置（Key 不包含...），直接使用
          if (hasFullKey) {
            return
          }

          // 从后端加载配置，检查是否已配置
          const data = await getConfig()
          if (data) {
            // 如果有完整 Key，保留完整 Key，只更新其他字段
            if (hasFullKey) {
              set({
                config: {
                  ...data,
                  api_key: state.config!.api_key
                },
                isConfigured: true
              })
            } else {
              // 没有完整 Key，使用后端返回的脱敏配置
              // 注意：不要覆盖 localStorage 中可能存在的其他配置
              set({
                config: {
                  ...state.config,  // 保留 localStorage 中的配置
                  ...data,          // 用后端数据更新
                  api_key: data.api_key  // 使用后端的脱敏 Key
                },
                isConfigured: true
              })
            }
          } else {
            // 后端没有配置
            if (!state.config) {
              set({ config: null, isConfigured: false })
            }
          }
        } catch (error) {
        }
      },

      // 保存配置
      saveConfig: async (config) => {
        try {
          await saveConfig(config)
          // 保存成功后，使用用户输入的完整配置（不使用后端返回的脱敏配置）
          set({ config: config, isConfigured: true })
        } catch (error) {
          throw error
        }
      },

      // 更新配置
      updateConfig: async (config) => {
        try {
          await updateConfig(config)
          // 更新成功后，使用用户输入的完整配置（不使用后端返回的脱敏配置）
          set({ config: config, isConfigured: true })
        } catch (error) {
          throw error
        }
      },

      // 测试连接
      testConnection: async (config) => {
        set({ isTesting: true })
        try {
          const data = await testConnection({
            export_mode: config.export_mode,
            vault_path: config.vault_path,
            api_url: config.api_url,
            api_key: config.api_key,
          })
          set({ isTesting: false })
          // 处理 data 可能为 null 的情况
          if (!data) {
            return { success: false, message: '服务器返回空响应' }
          }
          return { success: data.success || false, message: data.message || '连接失败' }
        } catch (error: any) {
          set({ isTesting: false })
          return { success: false, message: error?.message || '连接失败' }
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
          set({ exportHistory: data || [] })
        } catch (error) {
        }
      },

      // 清除配置
      clearConfig: () => {
        set({ config: null, isConfigured: false })
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
