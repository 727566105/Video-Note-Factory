import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SummarySettingsState {
  // 视频理解
  videoUnderstanding: boolean
  setVideoUnderstanding: (value: boolean) => void

  // 采样间隔（秒）
  videoInterval: number
  setVideoInterval: (value: number) => void

  // 拼图尺寸（列 × 行）
  gridCols: number
  setGridCols: (value: number) => void
  gridRows: number
  setGridRows: (value: number) => void

  // 笔记格式
  selectedFormats: string[]
  setSelectedFormats: (formats: string[]) => void
  toggleFormat: (format: string) => void

  // 备注
  extras: string
  setExtras: (value: string) => void
}

export const useSummarySettingsStore = create<SummarySettingsState>()(
  persist(
    set => ({
      // 默认值
      videoUnderstanding: false,
      setVideoUnderstanding: value => set({ videoUnderstanding: value }),

      videoInterval: 4,
      setVideoInterval: value => set({ videoInterval: value }),

      gridCols: 3,
      setGridCols: value => set({ gridCols: value }),
      gridRows: 3,
      setGridRows: value => set({ gridRows: value }),

      selectedFormats: ['summary'],
      setSelectedFormats: formats => set({ selectedFormats: formats }),
      toggleFormat: format => set(state => {
        const currentFormats = state.selectedFormats
        if (currentFormats.includes(format)) {
          return { selectedFormats: currentFormats.filter(f => f !== format) }
        } else {
          return { selectedFormats: [...currentFormats, format] }
        }
      }),

      extras: '',
      setExtras: value => set({ extras: value }),
    }),
    {
      name: 'summary-settings-store',
    }
  )
)
