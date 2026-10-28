import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useSettingsNavStore } from '@/store/settingsNavStore'

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true,
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { isAdmin: () => boolean }) => unknown) =>
    selector({ isAdmin: () => true }),
}))

import SettingLayout from '@/layouts/SettingLayout'

describe('SettingLayout 移动端导航', () => {
  it('顶部导航打开后，设置布局应显示一级分组和二级设置项', () => {
    useSettingsNavStore.setState({ mobileNavOpen: true })
    render(
      <MemoryRouter initialEntries={['/settings/profile']}>
        <Routes>
          <Route path="/settings" element={<SettingLayout />}>
            <Route path="profile" element={<div>个人资料内容</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    const menu = screen.getByRole('dialog')
    // 触发器已迁移到全局顶部导航，设置布局只负责抽屉内容
    expect(screen.queryByRole('button', { name: /设置菜单/ })).not.toBeInTheDocument()
    expect(within(menu).getByText('账号与工作区')).toBeInTheDocument()
    expect(within(menu).getByText('AI 与处理')).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /个人资料/ })).toBeInTheDocument()
    expect(within(menu).getByRole('button', { name: /下载配置/ })).toBeInTheDocument()
  })
})
