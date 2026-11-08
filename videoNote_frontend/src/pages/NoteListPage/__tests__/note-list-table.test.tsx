import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { NoteListPage } from '../index'
import type { NoteItem } from '../columns'

// jsdom 未实现响应式 hook 所需的 matchMedia。
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

const notes: NoteItem[] = Array.from({ length: 12 }, (_, index) => ({
  id: `task-${index + 1}`,
  task_id: `task-${index + 1}`,
  cover: '',
  platform: 'local',
  title: `笔记 ${index + 1}`,
  author: '作者',
  note: '',
  created_at: '',
  status: 'SUCCESS',
  video_url: '',
}))

vi.mock('@/services/note', () => ({
  getTasks: vi.fn(() => Promise.resolve({ tasks: notes })),
  delete_task: vi.fn(),
  generateNote: vi.fn(),
}))
vi.mock('@/services/author', () => ({
  getAuthors: vi.fn(() => Promise.resolve({ authors: [] })),
}))
vi.mock('@/services/collection', () => ({
  getTaskCollectionMap: vi.fn(() => Promise.resolve({})),
}))
vi.mock('@/services/subscription', () => ({
  subscribe: vi.fn(),
  quickViewNote: vi.fn(),
}))

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/notes']}>
      <NoteListPage />
    </MemoryRouter>,
  )

describe('笔记列表表格分页', () => {
  it('点击下一页后勾选不会重置分页', async () => {
    renderPage()

    expect(await screen.findByText('笔记 1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一页' }))
    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument()
    expect(screen.getByText('笔记 11')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('checkbox')[1])

    expect(screen.getByText('已选择 1 行 / 共 12 行')).toBeInTheDocument()
    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument()
    expect(screen.getByText('笔记 11')).toBeInTheDocument()
  })
})
