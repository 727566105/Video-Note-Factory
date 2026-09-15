import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ---- hoisted 可变 mock 状态 ----
const modelState = vi.hoisted(() => ({
  selectedModel: 'smart',
  modelList: [
    { id: 'm1', provider_id: 'p1', model_name: 'deepseek-test', created_at: '' },
  ],
  loadEnabledModels: vi.fn(),
}))
const summaryState = vi.hoisted(() => ({
  style: 'minimal',
  outputLanguage: 'zh',
  videoUnderstanding: true,
  setVideoUnderstanding: vi.fn(),
  videoInterval: 4,
  gridCols: 3,
  gridRows: 3,
  selectedFormats: ['toc', 'summary'],
  extras: '备注内容',
}))
const taskState = vi.hoisted(() => ({ addPendingTask: vi.fn() }))
const uploadMock = vi.hoisted(() => vi.fn())
const generateMock = vi.hoisted(() => vi.fn())
const toastMock = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }))
const checkAvailabilityMock = vi.hoisted(() => vi.fn())

vi.mock('@/store/modelStore', () => ({ useModelStore: () => modelState }))
vi.mock('@/store/summarySettingsStore', () => ({ useSummarySettingsStore: () => summaryState }))
vi.mock('@/store/taskStore', () => ({ useTaskStore: () => taskState }))
vi.mock('@/services/upload', () => ({ uploadFile: uploadMock }))
vi.mock('@/services/note', () => ({ generateNote: generateMock }))
vi.mock('@/services/subscription', () => ({ checkNoteAvailability: checkAvailabilityMock }))
vi.mock('sonner', () => ({ toast: toastMock }))
vi.mock('@/hooks/useHomeGuide', () => ({ useHomeGuide: () => ({ shouldShow: () => false, startGuide: vi.fn() }) }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))
vi.mock('@/components/SummarySettings', () => ({ SummarySettings: () => null }))
vi.mock('@/components/ModelSelectDialog', () => ({ ModelSelectDialog: () => null }))
vi.mock('@/components/GuideOverlay', () => ({ GuideOverlay: () => null }))

import { QuickAdd } from '@/pages/HomePage/components/QuickAdd'

function renderUpload() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <QuickAdd />
    </MemoryRouter>
  )
  fireEvent.click(screen.getByRole('button', { name: '上传' }))
}

// 模拟"选择文件"：拦截动态创建 input 的 click，注入 files 后触发 change
function selectFiles(files: File[]) {
  const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
    Object.defineProperty(this, 'files', { value: files as unknown as FileList, configurable: true })
    this.dispatchEvent(new Event('change', { bubbles: true }))
  })
  return clickSpy
}

function makeFile(name: string, type: string): File {
  return new File(['fake-content'], name, { type })
}

const getSubmitBtn = () => screen.getByRole('button', { name: /生成笔记/ }) as HTMLButtonElement

beforeEach(() => {
  vi.clearAllMocks()
  modelState.selectedModel = 'smart'
  modelState.modelList = [{ id: 'm1', provider_id: 'p1', model_name: 'deepseek-test', created_at: '' }]
  summaryState.videoUnderstanding = true
  summaryState.style = 'minimal'
  summaryState.selectedFormats = ['toc', 'summary']
  summaryState.extras = '备注内容'
  uploadMock.mockResolvedValue({ url: '/uploads/abc.m4a' })
  generateMock.mockResolvedValue({ task_id: 'task-1' })
})

describe('QuickAdd 上传 Tab - 布局与渲染', () => {
  it('顶部工具栏：视觉化总结开关 / 模型按钮 / 总结设置按钮 均渲染', () => {
    modelState.selectedModel = 'm1' // 非智能模式 → 显示具体模型名
    renderUpload()
    expect(screen.getByText('视觉化总结')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'deepseek-test' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /总结设置/ })).toBeInTheDocument()
  })

  it('智能优选模式：模型按钮显示"智能优选"', () => {
    modelState.selectedModel = 'smart'
    renderUpload()
    expect(screen.getByRole('button', { name: '智能优选' })).toBeInTheDocument()
  })

  it('拖放主区与底部操作条渲染，0 文件时提交按钮禁用', () => {
    renderUpload()
    expect(screen.getByText('拖拽音视频文件到此处')).toBeInTheDocument()
    expect(getSubmitBtn()).toBeDisabled()
  })

  it('点击视觉化总结开关触发 setVideoUnderstanding', () => {
    renderUpload()
    const sw = screen.getByRole('switch', { name: '视觉化总结' })
    fireEvent.click(sw)
    expect(summaryState.setVideoUnderstanding).toHaveBeenCalledWith(false)
  })
})

describe('QuickAdd 上传 Tab - 提交流程', () => {
  it('选 1 个音频文件后提交：platform=local_audio + 模型 + 总结设置字段', async () => {
    const clickSpy = selectFiles([makeFile('podcast.m4a', 'audio/mp4')])
    renderUpload()
    fireEvent.click(screen.getByRole('button', { name: '选择音视频文件' }))
    expect(screen.getByText('podcast.m4a')).toBeInTheDocument()
    expect(getSubmitBtn()).not.toBeDisabled()

    await act(async () => { fireEvent.click(getSubmitBtn()) })
    expect(uploadMock).toHaveBeenCalledTimes(1)
    expect(generateMock).toHaveBeenCalledTimes(1)
    const payload = generateMock.mock.calls[0][0]
    expect(payload.platform).toBe('local_audio')
    expect(payload.video_url).toBe('/uploads/abc.m4a')
    // 模型：smart 模式 → 空模型 + smart_mode=true
    expect(payload.smart_mode).toBe(true)
    expect(payload.model_name).toBe('')
    expect(payload.provider_id).toBe('')
    // 总结设置字段
    expect(payload.style).toBe('minimal')
    expect(payload.format).toEqual(['toc', 'summary'])
    expect(payload.extras).toBe('备注内容')
    expect(payload.video_understanding).toBe(true)
    expect(payload.video_interval).toBe(4)
    expect(payload.grid_size).toEqual([3, 3])
    expect(payload.screenshot).toBe(false)
    expect(payload.output_language).toBe('zh')
    clickSpy.mockRestore()
  })

  it('非智能模式选中具体模型：payload 带 model_name/provider_id', async () => {
    modelState.selectedModel = 'm1'
    const clickSpy = selectFiles([makeFile('v.mp4', 'video/mp4')])
    renderUpload()
    fireEvent.click(screen.getByRole('button', { name: '选择音视频文件' }))
    await act(async () => { fireEvent.click(getSubmitBtn()) })
    const payload = generateMock.mock.calls[0][0]
    expect(payload.smart_mode).toBe(false)
    expect(payload.model_name).toBe('deepseek-test')
    expect(payload.provider_id).toBe('p1')
    expect(payload.platform).toBe('local') // 视频 → local
    clickSpy.mockRestore()
  })

  it('未选模型（非智能模式且 modelList 找不到）→ toast 拦截，不提交', async () => {
    modelState.selectedModel = 'ghost-model'
    const clickSpy = selectFiles([makeFile('v.mp4', 'video/mp4')])
    renderUpload()
    fireEvent.click(screen.getByRole('button', { name: '选择音视频文件' }))
    await act(async () => { fireEvent.click(getSubmitBtn()) })
    expect(toastMock.error).toHaveBeenCalledWith('请选择模型')
    expect(uploadMock).not.toHaveBeenCalled()
    expect(generateMock).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('多文件 merge 模式：toast 提示开发中，不提交', async () => {
    const clickSpy = selectFiles([makeFile('a.m4a', 'audio/mp4'), makeFile('b.mp4', 'video/mp4')])
    renderUpload()
    fireEvent.click(screen.getByRole('button', { name: '选择音视频文件' }))
    // 多文件模式按钮出现
    expect(screen.getByText('多文件处理')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '合并' }))
    await act(async () => { fireEvent.click(getSubmitBtn()) })
    expect(toastMock.error).toHaveBeenCalledWith('合并功能正在开发中，请选择"独立任务"模式')
    expect(uploadMock).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('多文件独立模式：逐个上传提交，addPendingTask 2 次', async () => {
    const clickSpy = selectFiles([makeFile('a.m4a', 'audio/mp4'), makeFile('b.mp4', 'video/mp4')])
    renderUpload()
    fireEvent.click(screen.getByRole('button', { name: '选择音视频文件' }))
    await act(async () => { fireEvent.click(getSubmitBtn()) })
    expect(uploadMock).toHaveBeenCalledTimes(2)
    expect(generateMock).toHaveBeenCalledTimes(2)
    expect(taskState.addPendingTask).toHaveBeenCalledTimes(2)
    expect(toastMock.success).toHaveBeenCalledWith('已提交 2 个笔记生成任务')
    clickSpy.mockRestore()
  })

  it('上传失败：toast 提示该文件提交失败', async () => {
    uploadMock.mockRejectedValueOnce(new Error('network'))
    const clickSpy = selectFiles([makeFile('bad.m4a', 'audio/mp4')])
    renderUpload()
    fireEvent.click(screen.getByRole('button', { name: '选择音视频文件' }))
    await act(async () => { fireEvent.click(getSubmitBtn()) })
    expect(toastMock.error).toHaveBeenCalledWith('bad.m4a 提交失败')
    expect(generateMock).not.toHaveBeenCalled()
    clickSpy.mockRestore()
  })
})

describe('QuickAdd 上传 Tab - 拖拽与文件限制', () => {
  it('拖入音视频文件 → 加入列表', () => {
    renderUpload()
    const zone = screen.getByText('拖拽音视频文件到此处').closest('div')!
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile('d.m4a', 'audio/mp4')] } })
    expect(screen.getByText('d.m4a')).toBeInTheDocument()
  })

  it('拖入非音视频文件 → toast 提示并忽略', () => {
    renderUpload()
    const zone = screen.getByText('拖拽音视频文件到此处').closest('div')!
    fireEvent.drop(zone, { dataTransfer: { files: [makeFile('notes.pdf', 'application/pdf')] } })
    expect(toastMock.error).toHaveBeenCalledWith('请拖入音视频文件')
    expect(screen.queryByText('notes.pdf')).not.toBeInTheDocument()
  })

  it('超过 10 个文件 → toast 上限提示', () => {
    renderUpload()
    const zone = screen.getByText('拖拽音视频文件到此处').closest('div')!
    const many = Array.from({ length: 11 }, (_, i) => makeFile(`f${i}.mp3`, 'audio/mpeg'))
    fireEvent.drop(zone, { dataTransfer: { files: many } })
    expect(toastMock.error).toHaveBeenCalledWith('最多同时选择 10 个文件')
    // 文件不应被加入（11 > 10）
    expect(screen.queryByText('f0.mp3')).not.toBeInTheDocument()
  })
})
