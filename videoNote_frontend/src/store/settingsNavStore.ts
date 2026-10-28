import { create } from 'zustand'

interface SettingsNavState {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
}

/** 移动端设置抽屉状态：顶部导航触发，设置布局渲染内容 */
export const useSettingsNavStore = create<SettingsNavState>()(set => ({
  mobileNavOpen: false,
  setMobileNavOpen: mobileNavOpen => set({ mobileNavOpen }),
}))
