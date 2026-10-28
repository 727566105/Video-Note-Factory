import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ logout: vi.fn() }),
}))

vi.mock('@/store/taskStore', () => ({
  useTaskStore: {
    getState: () => ({ clearTasks: vi.fn() }),
  },
}))

import { NavUser } from '@/components/nav-user'
import { ThemeProvider } from '@/components/ThemeProvider'
import { SidebarProvider } from '@/components/ui/sidebar'

beforeEach(() => {
  // jsdom 未实现 matchMedia，侧边栏和主题上下文都依赖它。
  window.matchMedia = vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

describe('NavUser 用户菜单', () => {
  it('菜单不提供个人资料入口，同时保留其他常用入口', async () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <SidebarProvider>
            <NavUser user={{ name: 'admin', email: 'admin@example.com' }} />
          </SidebarProvider>
        </ThemeProvider>
      </MemoryRouter>,
    )

    fireEvent.pointerDown(screen.getByRole('button', { name: /admin/ }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    })
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: '设置中心' })).toBeInTheDocument()
    })

    expect(screen.queryByRole('menuitem', { name: '个人资料' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '退出登录' })).toBeInTheDocument()
  })
})
