import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthorStatsBar, computeAuthorStats } from '../AuthorStatsBar'

const item = (overrides: Record<string, unknown> = {}) => ({
  created_at: '2026-07-12T12:39:00',
  platform: 'douyin',
  duration: null,
  title: '测试内容',
  ...overrides,
})

describe('computeAuthorStats', () => {
  it('computes current totals from all items, including appended items', () => {
    const first = computeAuthorStats([item()])
    const afterAppend = computeAuthorStats([
      item(),
      item({ created_at: '2026-07-12T13:00:00', duration: 90 }),
    ])

    expect(first.total).toBe(1)
    expect(afterAppend.total).toBe(2)
    expect(afterAppend.peakDay).toEqual({ date: '2026-07-12', count: 2 })
    expect(afterAppend.formats).toEqual({ '图文/实况': 1, 视频: 1 })
  })

  it('does not throw when created_at or duration is missing/string', () => {
    const malformed = { platform: 'unknown', created_at: null, duration: '90' as unknown as number }
    expect(() => computeAuthorStats([malformed])).not.toThrow()
    expect(computeAuthorStats([malformed]).total).toBe(1)
    expect(computeAuthorStats([malformed]).avgDurationSec).toBe(90)
  })

  it('ignores invalid dates while retaining the item total', () => {
    const stats = computeAuthorStats([item({ created_at: 'not-a-date' }), item({ created_at: null })])
    expect(stats.total).toBe(2)
    expect(stats.spanText).toBe('未知')
    expect(stats.peakDay).toBeNull()
    expect(stats.timeBuckets).toEqual({ '凌晨(0-6)': 0, '上午(6-12)': 0, '下午(12-18)': 0, '晚间(18-24)': 0 })
  })
})

describe('AuthorStatsBar', () => {
  it('renders a useful empty-state fallback', () => {
    render(<AuthorStatsBar items={[]} />)
    expect(screen.getByText('共 0 条内容')).toBeInTheDocument()
    expect(screen.getByText('时间范围：未知')).toBeInTheDocument()
  })

  it('renders realtime values from the supplied items', () => {
    render(<AuthorStatsBar items={[item(), item({ created_at: '2026-07-12T13:00:00', duration: 90 })]} />)
    expect(screen.getByText('共 2 条内容')).toBeInTheDocument()
    expect(screen.getByText('峰值日：2026-07-12（2）')).toBeInTheDocument()
    expect(screen.getByText(/抖音 2/)).toBeInTheDocument()
    expect(screen.getByText(/视频 1/)).toBeInTheDocument()
  })
})
