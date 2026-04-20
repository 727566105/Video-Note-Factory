import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ToolbarConfig } from '@/types/api'
import { DEFAULT_TOOLBAR_CONFIG } from '@/types/api'

interface SystemState {
  showFeatureHint: boolean
  setShowFeatureHint: (value: boolean) => void

  sidebarCollapsed: boolean
  setSidebarCollapsed: (value: boolean) => void

  toolbarConfig: ToolbarConfig
  setToolbarConfig: (config: ToolbarConfig) => void
}
export const useSystemStore = create<SystemState>()(
  persist(
    set => ({
      showFeatureHint: true,
      setShowFeatureHint: value => set({ showFeatureHint: value }),

      sidebarCollapsed: false,
      setSidebarCollapsed: value => set({ sidebarCollapsed: value }),

      toolbarConfig: DEFAULT_TOOLBAR_CONFIG,
      setToolbarConfig: config => set({ toolbarConfig: config }),
    }),
    {
      name: 'system-store',
    }
  )
)
