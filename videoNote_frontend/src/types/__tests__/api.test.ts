import { describe, it, expect } from 'vitest'
import type { TaskTags } from '@/types/api'

describe('TaskTags 类型验证', () => {
  it('支持 platform_tags、ai_tags、manual_tags 三种标签', () => {
    const tags: TaskTags = {
      platform_tags: ['电商'],
      ai_tags: ['总结'],
      manual_tags: ['重要'],
    }
    expect(tags.platform_tags).toEqual(['电商'])
    expect(tags.ai_tags).toEqual(['总结'])
    expect(tags.manual_tags).toEqual(['重要'])
  })

  it('manual_tags 默认为空数组', () => {
    const tags: TaskTags = {
      platform_tags: [],
      ai_tags: [],
      manual_tags: [],
    }
    expect(tags.manual_tags).toHaveLength(0)
  })
})
