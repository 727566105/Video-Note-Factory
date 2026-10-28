import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: unknown; logout: () => void }) => unknown) =>
    selector({
      user: { username: 'admin', role: 'admin' },
      logout: vi.fn(),
    }),
}))

vi.mock('@/store/taskStore', () => ({
  useTaskStore: Object.assign(
    (selector: (state: { tasks: unknown[] }) => unknown) => selector({ tasks: [] }),
    {
      getState: () => ({ clearTasks: vi.fn() }),
    },
  ),
}))

import { SiteHeader } from '@/components/site-header'
import { useSettingsNavStore } from '@/store/settingsNavStore'

describe('SiteHeader 设置页导航', () => {
  it('移动端设置页顶部用菜单图标替代返回图标', () => {
    useSettingsNavStore.setState({ mobileNavOpen: false })
    render(
      <MemoryRouter initialEntries={['/settings/profile']}>
        <SiteHeader />
      </MemoryRouter>,
    )

    expect(screen.queryByRole('button', { name: '返回' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '设置菜单' }))
    expect(useSettingsNavStore.getState().mobileNavOpen).toBe(true)
    expect(screen.getByText('个人资料')).toBeInTheDocument()
  })
})
