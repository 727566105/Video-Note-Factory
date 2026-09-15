import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'

vi.mock('@/services/collection', () => ({
  getCollections: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  getCollectionDetail: vi.fn(),
  addItemsToCollection: vi.fn(),
  removeItemFromCollection: vi.fn(),
  generateCollectionSummary: vi.fn(),
  editCollectionSummary: vi.fn(),
  shareCollection: vi.fn(),
  unshareCollection: vi.fn(),
  updateItemsOrder: vi.fn(),
}))

vi.mock('@/services/note', () => ({ getTasks: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

vi.mock('@/store/providerStore', () => ({
  useProviderStore: () => ({ provider: [], fetchProviderList: vi.fn() }),
}))
vi.mock('@/store/modelStore', () => ({
  useModelStore: () => ({ modelList: [], loadEnabledModels: vi.fn() }),
}))
vi.mock('@/store/summarySettingsStore', () => ({
  useSummarySettingsStore: () => ({
    summaryMode: 'overview',
    style: 'minimal',
    outputLanguage: 'zh',
    videoUnderstanding: true,
    videoInterval: 4,
    gridCols: 3,
    gridRows: 3,
    selectedFormats: ['summary'],
    extras: '',
  }),
}))

vi.mock('@/components/ExportDialog', () => ({ ExportDialog: () => <div /> }))
vi.mock('@/components/SummarySettings', () => ({ SummarySettings: () => <div /> }))
vi.mock('@/pages/LibraryPage/components/TrajectoryTimeline', () => ({ TrajectoryTimeline: () => <div /> }))
vi.mock('@/pages/LibraryPage/components/TrajectorySummaryCard', () => ({ TrajectorySummaryCard: () => <div /> }))
vi.mock('@/pages/LibraryPage/components/AuthorStatsBar', () => ({ AuthorStatsBar: () => <div /> }))

import { CollectionDetail } from '../CollectionDetail'
import { getCollectionDetail as apiGetDetail, type CollectionDetail as CollectionDetailType } from '@/services/collection'
import { useCollectionStore } from '@/store/collectionStore'

const mockedApiGetDetail = vi.mocked(apiGetDetail)

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function makeDetail(id: string): CollectionDetailType {
  return {
    id,
    user_id: 1,
    name: `合集 ${id}`,
    description: null,
    cover_url: null,
    category: null,
    sort_order: 0,
    share_token: null,
    is_shared: 0,
    created_at: null,
    updated_at: null,
    items: [],
  }
}

function Goto({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return <button onClick={() => navigate(to)}>{label}</button>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Goto to="/library/B" label="go B" />
      <Routes>
        <Route path="/library/:id" element={<CollectionDetail />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useCollectionStore.setState({
    collections: [],
    currentDetail: null,
    detailViewId: null,
    loading: false,
    generatingIds: {},
  })
})

describe('CollectionDetail 路由切换归属', () => {
  it('A→B 切换加载期间，迟到的 A 详情不会渲染到 B 页面', async () => {
    const a = deferred<CollectionDetailType>()
    const b = deferred<CollectionDetailType>()
    mockedApiGetDetail.mockImplementationOnce(() => a.promise)
    mockedApiGetDetail.mockImplementationOnce(() => b.promise)

    // 进入合集 A：详情请求挂起，显示 loading
    renderAt('/library/A')
    expect(useCollectionStore.getState().loading).toBe(true)
    expect(screen.queryByText('合集 A')).not.toBeInTheDocument()

    // 切换到合集 B：触发 fetchDetail(B)，A 仍在途
    fireEvent.click(screen.getByText('go B'))
    expect(useCollectionStore.getState().loading).toBe(true)

    // A 的响应迟到返回：store 层 seq 校验丢弃，页面不得渲染 A 内容
    a.resolve(makeDetail('A'))
    await waitFor(() => expect(mockedApiGetDetail).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('合集 A')).not.toBeInTheDocument()

    // B 返回后渲染 B 的标题
    b.resolve(makeDetail('B'))
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('合集 B'))
    expect(screen.queryByText('合集 A')).not.toBeInTheDocument()
  })

  it('详情正常返回后渲染合集标题（正向路径）', async () => {
    mockedApiGetDetail.mockResolvedValueOnce(makeDetail('A'))
    renderAt('/library/A')
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('合集 A'))
  })
})
