/* -------------------- 常量 -------------------- */
import {
  BiliBiliLogo,
  DouyinLogo,
  KuaishouLogo,
  LocalLogo,
  AudioLogo,
  YoutubeLogo,
} from '@/components/Icons/platform.tsx'

export const noteFormats = [
  { label: '目录', value: 'toc' },
  { label: '原片跳转', value: 'link' },
  { label: '原片截图', value: 'screenshot' },
  { label: 'AI总结', value: 'summary' },
] as const

export const noteStyles = [
  { label: '精简', value: 'minimal', desc: '只保留核心要点，适合快速回顾' },
  { label: '详细', value: 'detailed', desc: '尽可能完整记录内容，不遗漏细节' },
  { label: '教程', value: 'tutorial', desc: '重点记录步骤、关键操作和结论' },
  { label: '学术', value: 'academic', desc: '正式结构化排版，适合学术报告' },
  { label: '小红书', value: 'xiaohongshu', desc: '爆款标题 + emoji，轻松活泼' },
  { label: '生活向', value: 'life_journal', desc: '个人感悟为主，情感化表达' },
  { label: '任务导向', value: 'task_oriented', desc: '提炼待办和目标，适合工作规划' },
  { label: '商业风格', value: 'business', desc: '商业报告风格，正式精准' },
  { label: '会议纪要', value: 'meeting_minutes', desc: '按议题归纳讨论、决策和行动项' },
] as const

export const videoPlatforms = [
  { label: '哔哩哔哩', value: 'bilibili', logo: BiliBiliLogo },
  { label: 'YouTube', value: 'youtube', logo: YoutubeLogo },
  { label: '抖音', value: 'douyin', logo: DouyinLogo },
  { label: '快手', value: 'kuaishou', logo: KuaishouLogo },
  { label: '本地视频', value: 'local', logo: LocalLogo },
  { label: '本地音频', value: 'local_audio', logo: AudioLogo },
] as const
