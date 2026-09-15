import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'

vi.mock('axios')
const mockedAxios = vi.mocked(axios, { deep: true })

describe('request 工具函数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成功请求返回 data 字段', async () => {
    const mockData = { code: 0, msg: 'success', data: { id: 1 } }
    mockedAxios.create.mockReturnValue({
      ...mockedAxios,
      get: vi.fn().mockResolvedValue({ data: mockData }),
      post: vi.fn(),
      put: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    } as any)
  })

  it('code !== 0 时触发 toast 错误提示', async () => {
    const { toast } = await import('sonner')
    const mockData = { code: 1, msg: '参数错误', data: null }
    mockedAxios.create.mockReturnValue({
      ...mockedAxios,
      get: vi.fn().mockResolvedValue({ data: mockData }),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    } as any)
  })
})
