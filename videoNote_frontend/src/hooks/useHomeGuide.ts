import { useState } from 'react'
import type { GuideStep } from '@/components/GuideOverlay'

const STORAGE_KEY = 'first-login-guide-shown'

export const homeGuideSteps: GuideStep[] = [
  {
    element: '[data-guide="home-input"]',
    title: '粘贴视频链接',
    description: '支持 B站、YouTube、抖音、小红书等平台链接，一行一个支持批量',
    side: 'bottom',
    align: 'center',
  },
  {
    element: '[data-guide="home-settings"]',
    title: '总结设置',
    description: '调整笔记风格、输出语言、视频理解等生成参数',
    side: 'bottom',
    align: 'start',
  },
  {
    element: '[data-guide="home-model"]',
    title: '模型选择',
    description: '选择 AI 模型，或开启智能优选自动匹配最佳模型',
    side: 'bottom',
    align: 'start',
  },
  {
    element: '[data-guide="home-platform"]',
    title: '平台识别',
    description: '默认智能识别平台，也可手动指定下载器',
    side: 'bottom',
    align: 'start',
  },
  {
    element: '[data-guide="home-generate"]',
    title: '一键生成',
    description: '点击后 AI 将自动下载、转写并生成结构化笔记',
    side: 'top',
    align: 'center',
  },
]

export function useHomeGuide() {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)

  const startGuide = () => {
    if (!localStorage.getItem(STORAGE_KEY)) setActive(true)
  }
  const shouldShow = () => !localStorage.getItem(STORAGE_KEY)

  const next = () => {
    if (step < homeGuideSteps.length - 1) setStep(s => s + 1)
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

  return { active, step, steps: homeGuideSteps, next, prev, close, startGuide, shouldShow }
}
