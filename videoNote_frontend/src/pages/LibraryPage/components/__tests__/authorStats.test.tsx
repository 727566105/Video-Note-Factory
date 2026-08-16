import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AuthorStatsBar, computeAuthorStats } from '../AuthorStatsBar'
import { getSectionKind, parseTrajectory } from '../TrajectorySummaryCard'

const item = (overrides: Record<string, unknown> = {}) => ({
  created_at: '2026-07-12T12:39:00',
  platform: 'douyin',
  duration: null,
  title: '测试内容',
  ...overrides,
})

describe('trajectory report parsing', () => {
  it('keeps five new dimensions and legacy headings parseable', () => {
    const parsed = parseTrajectory('# title\n## 风格特征\n结论\n## 内容偏好\n结论\n## 发布规律\n结论\n## 人设定位\n结论\n## 个人特质\n结论\n## 博主画像分析\n旧内容')
    expect(parsed.sections).toHaveLength(6)
    expect(parsed.sections.slice(0, 5).map(section => getSectionKind(section.title))).toEqual([
      'style', 'preference', 'rhythm', 'persona', 'personality',
    ])
    expect(getSectionKind(parsed.sections[5].title)).toBe('profile')
  })
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

  it('matches the backend parity fixture across every field', () => {
    const stats = computeAuthorStats([
      item({ created_at: '2026-07-01T00:00:00', platform: 'cctv', duration: '90', format: '视频' }),
      item({ created_at: '2026-07-02T06:00:00', platform: 'local', duration: '', format: '视频' }),
      item({ created_at: '2026-07-03T12:00:00', platform: 'mystery', duration: 'bad', format: '视频' }),
      item({ created_at: '2026-07-04T18:00:00', platform: null, duration: 0, format: '视频' }),
      item({ created_at: '2026-07-01T01:00:00', platform: 'cctv', duration: -30, format: '视频' }),
      item({ created_at: null, platform: 'local', duration: null, format: '图文/实况' }),
    ])
    expect(stats).toEqual({
      total: 6,
      spanDays: 3,
      spanText: '3天',
      frequencyPerWeek: 14,
      peakDay: { date: '2026-07-01', count: 2 },
      activeDays: 4,
      timeBuckets: { '凌晨(0-6)': 2, '上午(6-12)': 1, '下午(12-18)': 1, '晚上(18-24)': 1 },
      platforms: { CCTV: 2, local: 2, mystery: 1, '': 1 },
      formats: { 视频: 5, '图文/实况': 1 },
      avgDurationSec: 20,
    })
  })

  it('treats malformed, empty, zero, and negative durations consistently', () => {
    const stats = computeAuthorStats([
      item({ duration: 'bad' }), item({ duration: '' }), item({ duration: 'Infinity' }),
      item({ duration: 0 }), item({ duration: -1 }),
    ])
    expect(stats.formats).toEqual({ 视频: 5 })
    expect(stats.avgDurationSec).toBe(0)
  })
  it('ignores invalid dates while retaining the item total', () => {
    const stats = computeAuthorStats([item({ created_at: 'not-a-date' }), item({ created_at: null })])
    expect(stats.total).toBe(2)
    expect(stats.spanText).toBe('未知')
    expect(stats.peakDay).toBeNull()
    expect(stats.timeBuckets).toEqual({ '凌晨(0-6)': 0, '上午(6-12)': 0, '下午(12-18)': 0, '晚上(18-24)': 0 })
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
