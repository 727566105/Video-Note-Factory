import { create } from 'zustand'
import { saveUserPreferences } from '@/services/userPreferences'

export interface SummarySettingsState {
  // 笔记风格
  style: string
  setStyle: (value: string) => void

  // 输出语言
  outputLanguage: string
  setOutputLanguage: (value: string) => void

  videoUnderstanding: boolean
  setVideoUnderstanding: (value: boolean) => void

  videoInterval: number
  setVideoInterval: (value: number) => void

  gridCols: number
  setGridCols: (value: number) => void
  gridRows: number
  setGridRows: (value: number) => void

  selectedFormats: string[]
  setSelectedFormats: (formats: string[]) => void
  toggleFormat: (format: string) => void

  extras: string
  setExtras: (value: string) => void

  loadFromServer: (data: Record<string, any>) => void
  toServerData: () => Record<string, any>
}

export const useSummarySettingsStore = create<SummarySettingsState>()(
  set => ({
    style: 'minimal',
    setStyle: value => {
      set({ style: value })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },

    outputLanguage: 'zh',
    setOutputLanguage: value => {
      set({ outputLanguage: value })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },

    videoUnderstanding: false,
    setVideoUnderstanding: value => {
      set({ videoUnderstanding: value })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },

    videoInterval: 4,
    setVideoInterval: value => {
      set({ videoInterval: value })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },

    gridCols: 3,
    setGridCols: value => {
      set({ gridCols: value })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },
    gridRows: 3,
    setGridRows: value => {
      set({ gridRows: value })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },

    selectedFormats: ['summary'],
    setSelectedFormats: formats => {
      set({ selectedFormats: formats })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },
    toggleFormat: format => set(state => {
      const currentFormats = state.selectedFormats
      const next = currentFormats.includes(format)
        ? currentFormats.filter(f => f !== format)
        : [...currentFormats, format]
      set({ selectedFormats: next })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
      return { selectedFormats: next }
    }),

    extras: '',
    setExtras: value => {
      set({ extras: value })
      saveUserPreferences({ summary: useSummarySettingsStore.getState().toServerData() })
    },

    loadFromServer: (data: Record<string, any>) => {
      set({
        style: data.style ?? 'minimal',
        outputLanguage: data.outputLanguage ?? 'zh',
        videoUnderstanding: data.videoUnderstanding ?? false,
        videoInterval: data.videoInterval ?? 4,
        gridCols: data.gridCols ?? 3,
        gridRows: data.gridRows ?? 3,
        selectedFormats: data.selectedFormats ?? ['summary'],
        extras: data.extras ?? '',
      })
    },

    toServerData: () => {
      const s = useSummarySettingsStore.getState()
      return {
        style: s.style,
        outputLanguage: s.outputLanguage,
        videoUnderstanding: s.videoUnderstanding,
        videoInterval: s.videoInterval,
        gridCols: s.gridCols,
        gridRows: s.gridRows,
        selectedFormats: s.selectedFormats,
        extras: s.extras,
      }
    },
  })
)
