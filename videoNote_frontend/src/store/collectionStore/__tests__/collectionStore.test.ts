import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCollectionStore } from '../index'

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
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import {
  getCollectionDetail as apiGetDetail,
  generateCollectionSummary as apiGenSummary,
  type CollectionDetail,
  type CollectionSummary,
} from '@/services/collection'

const mockedApiGetDetail = vi.mocked(apiGetDetail)
const mockedApiGenSummary = vi.mocked(apiGenSummary)

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

function makeDetail(id: string): CollectionDetail {
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

function makeSummary(): CollectionSummary {
  return {
    id: 's1',
    collection_id: 'A',
    content: '# 总结',
    style: null,
    summary_mode: 'overview',
    model_name: null,
    provider_id: null,
    extras: null,
    created_at: null,
    updated_at: null,
  }
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

describe('collectionStore 请求乱序防护', () => {
  it('fetchDetail A/B 乱序返回时，迟到的 A 不覆盖已完成的 B', async () => {
    const a = deferred<CollectionDetail>()
    const b = deferred<CollectionDetail>()
    mockedApiGetDetail.mockImplementationOnce(() => a.promise)
    mockedApiGetDetail.mockImplementationOnce(() => b.promise)

    const requestA = useCollectionStore.getState().fetchDetail('A')
    const requestB = useCollectionStore.getState().fetchDetail('B')

    // B 先返回
    b.resolve(makeDetail('B'))
    await requestB
    expect(useCollectionStore.getState().currentDetail?.id).toBe('B')

    // A 后返回（迟到响应）
    a.resolve(makeDetail('A'))
    await requestA

    expect(useCollectionStore.getState().currentDetail?.id).toBe('B')
  })

  it('旧请求先结束时，不清除仍进行中请求的 loading 态', async () => {
    const a = deferred<CollectionDetail>()
    const b = deferred<CollectionDetail>()
    mockedApiGetDetail.mockImplementationOnce(() => a.promise)
    mockedApiGetDetail.mockImplementationOnce(() => b.promise)

    const requestA = useCollectionStore.getState().fetchDetail('A')
    const requestB = useCollectionStore.getState().fetchDetail('B')

    // A 先结束，B 仍在请求中
    a.resolve(makeDetail('A'))
    await requestA
    expect(useCollectionStore.getState().loading).toBe(true)

    b.resolve(makeDetail('B'))
    await requestB
    expect(useCollectionStore.getState().loading).toBe(false)
  })

  it('在合集 B 时，合集 A 的生成完成后不把详情刷新回 A', async () => {
    // 用户在 B 页面：fetchDetail(B) 已完成
    mockedApiGetDetail.mockResolvedValueOnce(makeDetail('B'))
    await useCollectionStore.getState().fetchDetail('B')
    expect(useCollectionStore.getState().currentDetail?.id).toBe('B')

    // 之前离开的 A 生成完成
    const gen = deferred<CollectionSummary>()
    mockedApiGenSummary.mockImplementationOnce(() => gen.promise)
    const requestGen = useCollectionStore.getState().generateSummary('A')

    gen.resolve(makeSummary())
    await requestGen

    // A 的生成刷新不得把详情改成 A
    expect(useCollectionStore.getState().currentDetail?.id).toBe('B')
    expect(mockedApiGetDetail).not.toHaveBeenCalledWith('A')
  })

  it('合集 A 生成中时，合集 B 不受影响（生成状态按合集隔离）', async () => {
    const genA = deferred<CollectionSummary>()
    mockedApiGenSummary.mockImplementationOnce(() => genA.promise)

    const requestGenA = useCollectionStore.getState().generateSummary('A')
    // A 生成中：仅 A 标记生成中，B 不应受影响
    expect(useCollectionStore.getState().generatingIds['A']).toBe(true)
    expect(useCollectionStore.getState().generatingIds['B']).toBeFalsy()

    genA.resolve(makeSummary())
    await requestGenA
    // A 生成完成后清理 A 的状态
    expect(useCollectionStore.getState().generatingIds['A']).toBeFalsy()
  })

  it('合集 A 生成完成时，不清除正在生成中的合集 B 的状态', async () => {
    const genA = deferred<CollectionSummary>()
    const genB = deferred<CollectionSummary>()
    mockedApiGenSummary.mockImplementationOnce(() => genA.promise)
    mockedApiGenSummary.mockImplementationOnce(() => genB.promise)

    const requestGenA = useCollectionStore.getState().generateSummary('A')
    const requestGenB = useCollectionStore.getState().generateSummary('B')

    // A 先完成
    genA.resolve(makeSummary())
    await requestGenA
    expect(useCollectionStore.getState().generatingIds['A']).toBeFalsy()
    // B 仍在生成中，状态不能被 A 的 finally 误清
    expect(useCollectionStore.getState().generatingIds['B']).toBe(true)

    genB.resolve(makeSummary())
    await requestGenB
    expect(useCollectionStore.getState().generatingIds['B']).toBeFalsy()
  })

  it('同一合集重复生成时只发起一次请求（single-flight）', async () => {
    const genA = deferred<CollectionSummary>()
    mockedApiGenSummary.mockImplementationOnce(() => genA.promise)

    const request1 = useCollectionStore.getState().generateSummary('A')
    const request2 = useCollectionStore.getState().generateSummary('A')

    expect(mockedApiGenSummary).toHaveBeenCalledTimes(1)

    genA.resolve(makeSummary())
    await Promise.all([request1, request2])
    expect(mockedApiGenSummary).toHaveBeenCalledTimes(1)
  })
})
