import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const STORAGE_KEY = 'detail-guide-shown'

const steps = [
  {
    element: '[data-guide="split-handle"]',
    popover: {
      title: '左右分栏可以自由布局啦！',
      description: '鼠标停留在中间这条线，然后拖拽试试...',
      side: 'left' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-guide="tab-bar"]',
    popover: {
      title: '多种内容视图',
      description: '切换标签页查看全文总结、字幕脚本、思维导图和原文详情',
      side: 'bottom' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-guide="toolbar"]',
    popover: {
      title: '导出与复制',
      description: '一键复制笔记内容，或导出为多种格式',
      side: 'bottom' as const,
      align: 'end' as const,
    },
  },
  {
    element: '[data-guide="version-select"]',
    popover: {
      title: '版本管理',
      description: '每次重新生成都会创建新版本，点击切换查看',
      side: 'bottom' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-guide="regenerate-btn"]',
    popover: {
      title: '重新生成',
      description: '不满意？换个模型或调整设置后重新生成',
      side: 'left' as const,
      align: 'center' as const,
    },
  },
]

export function useDetailGuide() {
  const startGuide = () => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      doneBtnText: '知道了',
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      onDestroyStarted: () => {
        localStorage.setItem(STORAGE_KEY, '1')
        driverObj.destroy()
      },
      steps,
    })
    driverObj.drive()
  }

  const shouldShow = () => !localStorage.getItem(STORAGE_KEY)

  return { startGuide, shouldShow }
}
