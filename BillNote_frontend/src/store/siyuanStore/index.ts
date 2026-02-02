import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  getConfig,
  saveConfig,
  updateConfig,
  getNotebooks,
  testConnection,
  exportToSiyuan,
  getExportHistory,
} from '@/services/siyuan'

interface SiyuanConfig {
  id?: number
  api_url: string
  api_token: string
  default_notebook?: string
  enabled?: number
}

interface SiyuanNotebook {
  id: string
  name: string
}

interface SiyuanExportHistory {
  id: number
  task_id: string
  siyuan_doc_id: string
  notebook_id: string
  notebook_name: string
  doc_path: string
  status: string
  error_message: string
  created_at: string
}

interface SiyuanStore {
  // 状态
  config: SiyuanConfig | null
  notebooks: SiyuanNotebook[]
  exportHistory: SiyuanExportHistory[]
  isConfigured: boolean
  isTesting: boolean
  isLoadingNotebooks: boolean
  isExporting: boolean

  // 操作
  loadConfig: () => Promise<void>
  saveConfig: (config: SiyuanConfig) => Promise<void>
  updateConfig: (config: SiyuanConfig) => Promise<void>
  loadNotebooks: () => Promise<void>
  testConnection: (config: SiyuanConfig) => Promise<{ success: boolean; message: string }>
  exportNote: (taskId: string) => Promise<void>
  loadExportHistory: () => Promise<void>
  clearConfig: () => void
}

export const useSiyuanStore = create<SiyuanStore>()(
  persist(
    (set, get) => ({
      // 初始状态
      config: null,
      notebooks: [],
      exportHistory: [],
      isConfigured: false,
      isTesting: false,
      isLoadingNotebooks: false,
      isExporting: false,

      // 加载配置
      loadConfig: async () => {
        try {
          // 优先使用localStorage中的配置（由persist中间件自动加载）
          const state = get()
          
          // 如果localStorage中已有完整配置（Token不包含...），直接使用
          if (state.config?.api_token && !state.config.api_token.includes('...')) {
            console.log('使用localStorage中的完整配置')
            return
          }
          
          // 否则从后端加载配置（仅用于检查是否已配置，不覆盖完整Token）
          const data = await getConfig()
          if (data) {
            // 如果后端有配置，但localStorage没有或Token是脱敏的
            // 只更新非敏感字段，保留localStorage中的完整Token
            if (state.config?.api_token && !state.config.api_token.includes('...')) {
              // 保留localStorage中的完整Token
              set({ 
                config: {
                  ...data,
                  api_token: state.config.api_token
                },
                isConfigured: true 
              })
            } else {
              // localStorage中没有完整Token，使用后端的脱敏Token
              set({ config: data, isConfigured: true })
            }
          } else {
            // 后端没有配置
            if (!state.config) {
              set({ config: null, isConfigured: false })
            }
          }
        } catch (error) {
          console.error('加载思源笔记配置失败:', error)
        }
      },

      // 保存配置
      saveConfig: async (config) => {
        try {
          await saveConfig(config)
          // 保存成功后，使用用户输入的完整配置（不使用后端返回的脱敏配置）
          set({ config: config, isConfigured: true })
        } catch (error) {
          console.error('保存思源笔记配置失败:', error)
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
          console.error('更新思源笔记配置失败:', error)
          throw error
        }
      },

      // 加载笔记本列表
      loadNotebooks: async () => {
        const state = get()
        // 如果配置中的Token是脱敏的或为空，不调用API
        if (!state.config?.api_token || state.config.api_token.includes('...')) {
          set({ notebooks: [], isLoadingNotebooks: false })
          return
        }
        
        set({ isLoadingNotebooks: true })
        try {
          // 传递完整的配置参数
          const data = await getNotebooks(
            state.config.api_url,
            state.config.api_token
          )
          set({ notebooks: data || [], isLoadingNotebooks: false })
        } catch (error) {
          console.error('加载笔记本列表失败:', error)
          set({ notebooks: [], isLoadingNotebooks: false })
          throw error
        }
      },

      // 测试连接
      testConnection: async (config) => {
        set({ isTesting: true })
        try {
          const data = await testConnection({
            api_url: config.api_url,
            api_token: config.api_token,
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
      exportNote: async (taskId) => {
        set({ isExporting: true })
        try {
          await exportToSiyuan(taskId)
          await get().loadExportHistory()
        } catch (error) {
          console.error('导出笔记失败:', error)
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
          console.error('加载导出历史失败:', error)
        }
      },

      // 清除配置
      clearConfig: () => {
        set({ config: null, isConfigured: false })
      },
    }),
    {
      name: 'siyuan-storage',
      partialize: state => ({
        config: state.config,
        isConfigured: state.isConfigured,
      }),
    }
  )
)
