import { useState } from 'react'
import type { GuideStep } from '@/components/GuideOverlay'

const STORAGE_KEY = 'detail-guide-shown'

export const detailGuideSteps: GuideStep[] = [
  {
    element: '[data-guide="split-handle"]',
    title: '左右分栏可以自由布局啦！',
    description: '鼠标停留在中间这条线，然后拖拽试试...',
    side: 'left',
    align: 'center',
  },
  {
    element: '[data-guide="tab-bar"]',
    title: '多种内容视图',
    description: '切换标签页查看全文总结、字幕脚本、思维导图和原文详情',
    side: 'bottom',
    align: 'start',
  },
  {
    element: '[data-guide="toolbar"]',
    title: '导出与复制',
    description: '一键复制笔记内容，或导出为多种格式',
    side: 'bottom',
    align: 'end',
  },
  {
    element: '[data-guide="version-select"]',
    title: '版本管理',
    description: '每次重新生成都会创建新版本，点击切换查看',
    side: 'bottom',
    align: 'start',
  },
  {
    element: '[data-guide="regenerate-btn"]',
    title: '重新生成',
    description: '不满意？换个模型或调整设置后重新生成',
    side: 'left',
    align: 'center',
  },
]

export function useDetailGuide() {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)

  const startGuide = () => {
    if (!localStorage.getItem(STORAGE_KEY)) setActive(true)
  }
  const shouldShow = () => !localStorage.getItem(STORAGE_KEY)

  const next = () => {
    if (step < detailGuideSteps.length - 1) setStep(s => s + 1)
    else close()
  }
  const prev = () => {
    if (step > 0) setStep(s => s - 1)
  }
  const close = () => {
    setActive(false)
    setStep(0)
    localStorage.setItem(STORAGE_KEY, '1')
  }

  return { active, step, steps: detailGuideSteps, next, prev, close, startGuide, shouldShow }
}
