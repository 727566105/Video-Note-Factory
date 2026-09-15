import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

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
    setSummaryMode: vi.fn(),
    setStyle: vi.fn(),
    setOutputLanguage: vi.fn(),
    setVideoUnderstanding: vi.fn(),
    setVideoInterval: vi.fn(),
    setGridCols: vi.fn(),
    setGridRows: vi.fn(),
    setSelectedFormats: vi.fn(),
    setExtras: vi.fn(),
  }),
}))

import { SummarySettings } from '@/components/SummarySettings'

describe('SummarySettings collection variant', () => {
  it('only renders default summary settings and never exposes custom tab', () => {
    render(
      <SummarySettings
        open
        onOpenChange={vi.fn()}
        mode="local"
        variant="collection"
        localValues={{ summaryMode: 'overview', extras: '' }}
        onLocalChange={vi.fn()}
      />,
    )

    expect(screen.getByText('默认配置')).toBeInTheDocument()
    expect(screen.queryByText('自定义总结')).not.toBeInTheDocument()
    expect(screen.getByText('总结模式')).toBeInTheDocument()
    expect(screen.getByText('备注')).toBeInTheDocument()
    expect(screen.queryByText('视频理解')).not.toBeInTheDocument()
  })

  it('returns to default content if collection variant changes while custom is active', () => {
    const { rerender } = render(
      <SummarySettings open onOpenChange={vi.fn()} mode="local" variant="note" localValues={{}} onLocalChange={vi.fn()} />,
    )
    fireEvent.click(screen.getByText('自定义总结'))
    expect(screen.getByText('提示词内容')).toBeInTheDocument()

    rerender(
      <SummarySettings open onOpenChange={vi.fn()} mode="local" variant="collection" localValues={{}} onLocalChange={vi.fn()} />,
    )

    expect(screen.queryByText('自定义总结')).not.toBeInTheDocument()
    expect(screen.getByText('总结模式')).toBeInTheDocument()
    expect(screen.queryByText('提示词内容')).not.toBeInTheDocument()
  })

  it('summary mode options exclude mindmap (it is a standalone quick-action, not a summary mode)', () => {
    render(
      <SummarySettings
        open
        onOpenChange={vi.fn()}
        mode="local"
        variant="collection"
        localValues={{ summaryMode: 'overview', extras: '' }}
        onLocalChange={vi.fn()}
      />,
    )

    fireEvent.pointerDown(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('combobox'))

    expect(screen.getByRole('option', { name: '综合概述' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '对比分析' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '时间线' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '博主画像' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: '思维导图' })).not.toBeInTheDocument()
  })
})
