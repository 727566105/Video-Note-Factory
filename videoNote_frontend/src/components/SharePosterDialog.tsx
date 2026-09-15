import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import QRCode from 'qrcode'
import {
  Check,
  Copy,
  Download,
  Loader2,
  QrCode,
  Share2,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getBaseURL } from '@/utils/api'
import type { Task } from '@/store/taskStore'
import { BiliBiliLogo, XiaohongshuLogo } from '@/components/Icons/platform'

type PosterStyleId = 'bilibili' | 'xiaohongshu' | 'youtube' | 'x' | 'wechat' | 'professional'

type PosterStyle = {
  id: PosterStyleId
  name: string
  logo: string
  mark: string
  description: string
  mood: string
  background: string
  panel: string
  primary: string
  secondary: string
  ink: string
  muted: string
  chipBg: string
  chipText: string
  decoration: string
  contentLabel: string
  logoShape?: 'rounded' | 'circle' | 'square'
}

const POSTER_STYLES: PosterStyle[] = [
  {
    id: 'bilibili',
    name: 'B 站',
    logo: 'bilibili',
    mark: 'bili',
    description: 'B站蓝粉色，视频社区感',
    mood: '弹幕 / 科技 / 年轻',
    background: 'linear-gradient(145deg, #e7f8ff 0%, #fff0f7 52%, #f6fbff 100%)',
    panel: 'rgba(255,255,255,0.82)',
    primary: '#00a1d6',
    secondary: '#fb7299',
    ink: '#12243a',
    muted: '#5d7288',
    chipBg: 'rgba(0,161,214,0.12)',
    chipText: '#0077a3',
    decoration: '弹幕精选',
    contentLabel: 'AI 笔记切片',
    logoShape: 'rounded',
  },
  {
    id: 'xiaohongshu',
    name: '小红书',
    logo: '小红书',
    mark: 'RED',
    description: '暖调编辑感，适合种草分享',
    mood: '生活方式 / 轻盈 / 精致',
    background: 'linear-gradient(160deg, #fff8f5 0%, #ffe5e9 48%, #fffdf8 100%)',
    panel: 'rgba(255,255,255,0.88)',
    primary: '#ff2442',
    secondary: '#ff6b81',
    ink: '#2b171a',
    muted: '#8b6264',
    chipBg: 'rgba(255,36,66,0.11)',
    chipText: '#d71936',
    decoration: '今日灵感',
    contentLabel: '值得收藏的观点',
    logoShape: 'circle',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    logo: 'YouTube',
    mark: '▶',
    description: '高对比缩略图叙事',
    mood: '醒目 / 创作者 / 频道感',
    background: 'linear-gradient(145deg, #141414 0%, #2b1111 48%, #f8f8f8 49%, #ffffff 100%)',
    panel: 'rgba(255,255,255,0.9)',
    primary: '#ff0033',
    secondary: '#111111',
    ink: '#111111',
    muted: '#5f6368',
    chipBg: 'rgba(255,0,51,0.12)',
    chipText: '#d9002b',
    decoration: 'WATCH NOTES',
    contentLabel: 'Highlights',
    logoShape: 'rounded',
  },
  {
    id: 'x',
    name: 'X',
    logo: 'X',
    mark: 'X',
    description: '黑白锐利，适合观点传播',
    mood: '简短 / 犀利 / 信息流',
    background: 'linear-gradient(145deg, #050505 0%, #1f2937 58%, #f5f5f5 58%, #ffffff 100%)',
    panel: 'rgba(255,255,255,0.92)',
    primary: '#111827',
    secondary: '#64748b',
    ink: '#0f172a',
    muted: '#5b6575',
    chipBg: 'rgba(15,23,42,0.08)',
    chipText: '#111827',
    decoration: 'QUOTE CARD',
    contentLabel: 'Thread notes',
    logoShape: 'square',
  },
  {
    id: 'wechat',
    name: '微信公众号',
    logo: 'WeChat',
    mark: '微信',
    description: '杂志式排版，阅读友好',
    mood: '编辑部 / 长文 / 稳重',
    background: 'linear-gradient(160deg, #effaf3 0%, #f7fbf6 48%, #eef4ff 100%)',
    panel: 'rgba(255,255,255,0.9)',
    primary: '#16a34a',
    secondary: '#0f766e',
    ink: '#123026',
    muted: '#61736b',
    chipBg: 'rgba(22,163,74,0.12)',
    chipText: '#15803d',
    decoration: '深度阅读',
    contentLabel: '文章摘要',
    logoShape: 'rounded',
  },
  {
    id: 'professional',
    name: '专业简约',
    logo: 'VN',
    mark: 'VN',
    description: '克制商务感，适合汇报转发',
    mood: '清晰 / 专业 / 高级',
    background: 'linear-gradient(145deg, #f8fafc 0%, #eef2ff 48%, #ffffff 100%)',
    panel: 'rgba(255,255,255,0.94)',
    primary: '#2563eb',
    secondary: '#0f172a',
    ink: '#111827',
    muted: '#64748b',
    chipBg: 'rgba(37,99,235,0.11)',
    chipText: '#1d4ed8',
    decoration: 'INSIGHT BRIEF',
    contentLabel: 'Executive summary',
    logoShape: 'square',
  },
]

const PLATFORM_LABELS: Record<string, string> = {
  bilibili: 'B 站',
  youtube: 'YouTube',
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  local: '本地视频',
  local_audio: '本地音频',
  cctv: '央视',
}

function getXiaohongshuLogoHTML(size: number) {
  return `<svg viewBox="0 0 1024 1024" width="${size}" height="${size}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="M512 0C229.2 0 0 229.2 0 512s229.2 512 512 512 512-229.2 512-512S794.8 0 512 0z m0 938.7C276.4 938.7 85.3 747.6 85.3 512S276.4 85.3 512 85.3 938.7 276.4 938.7 512 747.6 938.7 512 938.7z" fill="#fff"/><path d="M512 170.7c-188.6 0-341.3 152.7-341.3 341.3S323.4 853.3 512 853.3 853.3 699.6 853.3 512 700.6 170.7 512 170.7z m149.3 426.6c0 47.1-38.2 85.3-85.3 85.3H448c-47.1 0-85.3-38.2-85.3-85.3V426.7c0-47.1 38.2-85.3 85.3-85.3h128c47.1 0 85.3 38.2 85.3 85.3v170.6z" fill="#fff"/><path d="M576 426.7H448c-23.6 0-42.7 19.1-42.7 42.7v85.3c0 23.6 19.1 42.7 42.7 42.7h128c23.6 0 42.7-19.1 42.7-42.7v-85.3c0-23.6-19.1-42.7-42.7-42.7z m-21.3 106.6h-85.4v-42.6h85.4v42.6z" fill="#fff"/></svg>`
}

function getVideoNoteLogoHTML(variant: 'head' | 'fallback' = 'head') {
  const size = variant === 'fallback' ? 148 : 76
  return `<div class="brand-mark videonote-mark" style="width:${size}px;height:${size}px;border-radius:${variant === 'fallback' ? 42 : 24}px;display:flex;align-items:center;justify-content:center;background:#fff;box-shadow:0 18px 44px rgba(15,23,42,.18);overflow:hidden;"><img src="/logo.png" crossorigin="anonymous" style="width:${size}px;height:${size}px;object-fit:cover;display:block;" /></div>`
}

function getPosterLogoHTML(stylePreset: PosterStyle, variant: 'head' | 'fallback' = 'head') {
  const size = variant === 'fallback' ? 148 : 76
  const playSize = variant === 'fallback' ? 58 : 28
  const commonStyle = `width:${size}px;height:${size}px;border-radius:${variant === 'fallback' ? 42 : 24}px;display:flex;align-items:center;justify-content:center;box-shadow:0 18px 44px rgba(15,23,42,.18);overflow:hidden;`

  switch (stylePreset.id) {
    case 'bilibili':
      return `<div class="brand-mark bilibili-mark" style="${commonStyle}"><svg viewBox="0 0 76 76" width="${size}" height="${size}" aria-hidden="true"><rect width="76" height="76" rx="20" fill="#00A1D6"/><path d="M22 28h32c6 0 10 4 10 10v14c0 6-4 10-10 10H22c-6 0-10-4-10-10V38c0-6 4-10 10-10Z" fill="#fff"/><path d="M27 20l8 8M49 20l-8 8" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="31" cy="45" r="3.8" fill="#00A1D6"/><circle cx="45" cy="45" r="3.8" fill="#00A1D6"/><path d="M34 54h8" stroke="#00A1D6" stroke-width="3" stroke-linecap="round"/></svg></div>`
    case 'xiaohongshu':
      return `<div class="brand-mark red-mark" style="${commonStyle};background:#ff2442;">${getXiaohongshuLogoHTML(variant === 'fallback' ? 104 : 54)}</div>`
    case 'youtube':
      return `<div class="brand-mark youtube-mark" style="${commonStyle};background:#ff0033;"><svg viewBox="0 0 96 68" width="${variant === 'fallback' ? 96 : 50}" height="${variant === 'fallback' ? 68 : 36}" aria-hidden="true"><rect width="96" height="68" rx="18" fill="#fff"/><path d="M40 22l24 12-24 12V22Z" fill="#ff0033"/></svg></div>`
    case 'x':
      return `<div class="brand-mark x-mark" style="${commonStyle};background:#050505;color:#fff;font-size:${variant === 'fallback' ? 64 : 38}px;font-weight:900;">X</div>`
    case 'wechat':
      return `<div class="brand-mark wechat-mark" style="${commonStyle};background:linear-gradient(135deg,#1aad19,#07c160);"><svg viewBox="0 0 90 76" width="${variant === 'fallback' ? 106 : 54}" height="${variant === 'fallback' ? 90 : 46}" aria-hidden="true"><ellipse cx="36" cy="34" rx="30" ry="24" fill="#fff"/><ellipse cx="58" cy="46" rx="24" ry="20" fill="#dff8dc"/><circle cx="26" cy="31" r="3.5" fill="#16a34a"/><circle cx="44" cy="31" r="3.5" fill="#16a34a"/><circle cx="50" cy="43" r="3" fill="#16a34a"/><circle cx="64" cy="43" r="3" fill="#16a34a"/></svg></div>`
    default:
      return `<div class="brand-mark vn-mark" style="${commonStyle};background:linear-gradient(135deg,${stylePreset.primary},${stylePreset.secondary});color:#fff;font-size:${playSize}px;font-weight:950;">${escapeHtml(stylePreset.mark)}</div>`
  }
}

function WeChatLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 112 92"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M50.6 16C27.9 16 9.5 30.8 9.5 49.1c0 10.4 6 19.7 15.4 25.8l-3.6 10.8 13.2-6.3c5 1.8 10.4 2.8 16.1 2.8 22.7 0 41.1-14.8 41.1-33.1S73.3 16 50.6 16Z"
        fill="white"
      />
      <path
        d="M67.4 41.5c-18.8 0-34 12.3-34 27.5s15.2 27.5 34 27.5c4.6 0 9-.7 13-2.1L91 99l-2.9-9c8-5.1 12.8-12.7 12.8-21 0-15.2-15.2-27.5-33.5-27.5Z"
        fill="#DCF8D2"
        transform="translate(1 -16)"
      />
      <circle cx="36" cy="46" r="4.2" fill="#1AAD19" />
      <circle cx="58" cy="46" r="4.2" fill="#1AAD19" />
      <circle cx="62" cy="61" r="3.6" fill="#1AAD19" />
      <circle cx="78" cy="61" r="3.6" fill="#1AAD19" />
    </svg>
  )
}

function VideoNoteLogoMark({ large = false }: { large?: boolean }) {
  const sizeClass = large ? 'h-[148px] w-[148px] rounded-[42px]' : 'h-[76px] w-[76px] rounded-3xl'
  return (
    <div className={cn('flex items-center justify-center overflow-hidden bg-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]', sizeClass)}>
      <img src="/logo.png" alt="" className="h-full w-full object-cover" />
    </div>
  )
}

function BrandMark({ stylePreset, large = false }: { stylePreset: PosterStyle; large?: boolean }) {
  const sizeClass = large ? 'h-[148px] w-[148px] rounded-[42px]' : 'h-[76px] w-[76px] rounded-3xl'
  const iconClass = large ? 'size-24' : 'size-12'

  if (stylePreset.id === 'professional') {
    return <VideoNoteLogoMark large={large} />
  }

  if (stylePreset.id === 'bilibili') {
    return (
      <div className={cn('flex items-center justify-center overflow-hidden bg-[#00a1d6] text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]', sizeClass)}>
        <BiliBiliLogo className={iconClass} />
      </div>
    )
  }

  if (stylePreset.id === 'xiaohongshu') {
    return (
      <div className={cn('flex items-center justify-center bg-[#ff2442] text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]', sizeClass)}>
        <span className={cn('flex items-center justify-center rounded-full bg-white', large ? 'size-24' : 'size-12')}>
          <XiaohongshuLogo className={large ? 'size-20' : 'size-10'} />
        </span>
      </div>
    )
  }

  if (stylePreset.id === 'youtube') {
    return (
      <div className={cn('flex items-center justify-center bg-[#ff0033] text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]', sizeClass)}>
        <span className={cn('flex items-center justify-center rounded-2xl bg-white', large ? 'h-[68px] w-24' : 'h-9 w-[50px]')}>
          <span
            className={cn('ml-1 block h-0 w-0 border-y-transparent', large ? 'border-y-[14px] border-l-[24px]' : 'border-y-[8px] border-l-[14px]')}
            style={{ borderLeftColor: '#ff0033' }}
          />
        </span>
      </div>
    )
  }

  if (stylePreset.id === 'x') {
    return (
      <div className={cn('flex items-center justify-center bg-black font-black text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]', sizeClass, large ? 'text-6xl' : 'text-4xl')}>
        X
      </div>
    )
  }

  if (stylePreset.id === 'wechat') {
    return (
      <div className={cn('flex items-center justify-center bg-[#1aad19] text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]', sizeClass)}>
        <WeChatLogo className={large ? 'h-[96px] w-[114px]' : 'h-12 w-14'} />
      </div>
    )
  }

  return (
    <div
      className={cn('flex items-center justify-center font-black text-white shadow-[0_18px_44px_rgba(15,23,42,0.18)]', sizeClass, large ? 'text-5xl' : 'text-2xl')}
      style={{ background: `linear-gradient(135deg, ${stylePreset.primary}, ${stylePreset.secondary})` }}
    >
      {stylePreset.mark}
    </div>
  )
}

function VideoNoteOptionMark() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm">
      <img src="/logo.png" alt="" className="h-full w-full object-cover" />
    </span>
  )
}

function StyleOptionMark({ stylePreset }: { stylePreset: PosterStyle }) {
  const baseClass = 'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden shadow-sm'

  if (stylePreset.id === 'professional') {
    return <VideoNoteOptionMark />
  }

  if (stylePreset.id === 'bilibili') {
    return (
      <span className={cn(baseClass, 'rounded-xl bg-[#00a1d6]')}>
        <BiliBiliLogo className="size-7" />
      </span>
    )
  }

  if (stylePreset.id === 'youtube') {
    return (
      <span className={cn(baseClass, 'rounded-xl bg-[#ff0033]')}>
        <span className="flex h-[18px] w-[26px] items-center justify-center rounded-md bg-white">
          <span className="ml-0.5 block h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-[#ff0033]" />
        </span>
      </span>
    )
  }

  if (stylePreset.id === 'xiaohongshu') {
    return (
      <span className={cn(baseClass, 'rounded-full bg-[#ff2442] text-white')}>
        <span className="flex size-7 items-center justify-center rounded-full bg-white">
          <XiaohongshuLogo className="size-6" />
        </span>
      </span>
    )
  }

  if (stylePreset.id === 'x') {
    return <span className={cn(baseClass, 'rounded-lg bg-black text-xl font-black text-white')}>X</span>
  }

  if (stylePreset.id === 'wechat') {
    return (
      <span className={cn(baseClass, 'rounded-xl bg-[#1aad19]')}>
        <WeChatLogo className="h-7 w-8" />
      </span>
    )
  }

  return (
    <span
      className={cn(baseClass, 'rounded-lg px-2 text-[11px] font-black text-white')}
      style={{ background: `linear-gradient(135deg, ${stylePreset.primary}, ${stylePreset.secondary})` }}
    >
      {stylePreset.mark}
    </span>
  )
}

interface SharePosterDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  content: string
}

function normalizeMarkdown(markdown: string) {
  let text = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[[^\]]+]\([^)]*\)/g, match => match.replace(/\[|\]\([^)]*\)/g, ''))
    .replace(/^>\s?/gm, '')
    .replace(/[*_`~]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Skip generated table-of-contents blocks so the poster starts with the actual article.
  text = text.replace(
    /^#{1,6}\s*目录\s*\n(?:\s*[-*+]\s+.*\n?|\s*\d+\.\s+.*\n?|\s*)+/im,
    ''
  )

  return text.trim()
}

type PosterBlock = {
  type: 'heading' | 'paragraph' | 'list'
  text: string
}

function getPosterBlocks(content: string): PosterBlock[] {
  const plain = normalizeMarkdown(content)
  const lines = plain
    .split(/\n+/)
    .map(line => line.trim())
    .filter(line => line && !/^[-*_]{3,}$/.test(line))

  return lines.map(line => {
    if (/^#{1,6}\s+/.test(line)) {
      return { type: 'heading', text: line.replace(/^#{1,6}\s+/, '').trim() }
    }
    if (/^[-+*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      return { type: 'list', text: line.replace(/^[-+*]\s+/, '').replace(/^\d+\.\s+/, '').trim() }
    }
    return { type: 'paragraph', text: line }
  })
}

function getTaskTitle(task: Task) {
  return task.audioMeta?.title || task.title || '未命名笔记'
}

function getAuthor(task: Task) {
  if (task.author) return task.author
  if (task.author_name) return task.author_name
  if (task.audioMeta?.author) return task.audioMeta.author
  const raw = task.audioMeta?.raw_info as Record<string, unknown> | undefined
  const owner = raw?.owner as Record<string, unknown> | undefined
  const author = raw?.author as Record<string, unknown> | undefined
  return (owner?.name as string) || (raw?.uploader as string) || (raw?.channel as string) || (author?.name as string) || PLATFORM_LABELS[task.platform] || task.platform
}

function getCoverUrl(task: Task) {
  const cover = task.audioMeta?.cover_url
  if (!cover) return ''
  // 本地平台或本地 API 路径直接用，不走 image_proxy
  if (task.platform === 'local' || task.platform === 'local_audio') return cover
  if (cover.startsWith('/api/')) return `${getBaseURL()}${cover}`
  return `${getBaseURL()}/api/image_proxy?url=${encodeURIComponent(cover)}`
}

function formatShareTime(date = new Date()) {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function safeFilename(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 48) || 'share-poster'
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function getPublicShareUrl(task: Task) {
  const videoUrl = task.formData?.video_url?.trim()
  if (videoUrl && /^https?:\/\//i.test(videoUrl)) {
    return videoUrl
  }
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/notes/${task.id}`
}

function buildPosterHTML({
  stylePreset,
  title,
  author,
  platformLabel,
  coverUrl,
  blocks,
  shareTime,
  qrUrl,
  shareUrl,
}: Omit<PosterCanvasProps, 'onCoverError'>) {
  const brandLogo = stylePreset.id === 'professional'
    ? getVideoNoteLogoHTML()
    : getPosterLogoHTML(stylePreset)
  const fallbackLogo = stylePreset.id === 'professional'
    ? getVideoNoteLogoHTML('fallback')
    : getPosterLogoHTML(stylePreset, 'fallback')
  const brandName = stylePreset.id === 'professional' ? 'VideoNote' : stylePreset.logo
  const pointHtml = blocks.map((block, index) => `
    <div class="block block-${block.type}">
      ${block.type === 'heading' ? '' : `<span class="dot ${index === 0 ? 'dot-main' : ''}"></span>`}
      <p class="${index === 0 ? 'lead' : ''}">${escapeHtml(block.text)}</p>
    </div>
  `).join('')

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1080px; overflow: visible; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
    background: ${stylePreset.background};
    color: ${stylePreset.ink};
  }
  .poster { position: relative; width: 1080px; overflow: hidden; padding-bottom: 64px; }
  .orb-a { position: absolute; width: 520px; height: 520px; border-radius: 999px; top: -160px; right: -140px; background: ${stylePreset.primary}; opacity: .16; filter: blur(10px); }
  .orb-b { position: absolute; width: 420px; height: 420px; border-radius: 999px; bottom: -120px; left: -120px; background: ${stylePreset.secondary}; opacity: .13; filter: blur(12px); }
  .wrap { position: relative; z-index: 1; padding: 64px; }
  .head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; }
  .brand { display: flex; align-items: center; gap: 18px; }
  .brand-mark svg { display: block; }
  .style-name { font-size: 28px; font-weight: 800; }
  .decoration { margin-top: 6px; color: ${stylePreset.muted}; font-size: 20px; }
  .vn { border-radius: 999px; padding: 12px 20px; background: ${stylePreset.chipBg}; color: ${stylePreset.chipText}; font-size: 20px; font-weight: 700; }
  .card { border-radius: 42px; background: ${stylePreset.panel}; box-shadow: 0 30px 90px rgba(15,23,42,.18); border: 1px solid rgba(255,255,255,.66); overflow: hidden; }
  .cover { position: relative; height: 392px; background: ${stylePreset.chipBg}; overflow: hidden; }
  .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, ${stylePreset.primary}22, ${stylePreset.secondary}2c); }
  .fallback-mark { display: flex; align-items: center; justify-content: center; }
  .shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.46)); }
  .chips { position: absolute; left: 34px; bottom: 30px; display: flex; align-items: center; gap: 12px; }
  .chip { border-radius: 999px; padding: 10px 16px; background: rgba(255,255,255,.9); color: ${stylePreset.ink}; font-size: 19px; font-weight: 800; }
  .chip-primary { background: ${stylePreset.primary}; color: #fff; }
  .body { padding: 42px 46px 36px; }
  h1 { margin: 0; font-size: 52px; line-height: 1.12; color: ${stylePreset.ink}; font-weight: 900; letter-spacing: 0; }
  .meta { margin-top: 20px; display: flex; flex-wrap: wrap; gap: 12px; color: ${stylePreset.muted}; font-size: 22px; }
  .rule { margin-top: 34px; height: 3px; width: 100%; background: linear-gradient(90deg, ${stylePreset.primary}, ${stylePreset.secondary}, transparent); }
  .points { margin-top: 34px; display: grid; gap: 20px; }
  .block { display: grid; grid-template-columns: 34px 1fr; gap: 16px; }
  .block-heading { display: block; margin-top: 14px; }
  .dot { margin-top: 8px; width: 22px; height: 22px; border-radius: 999px; background: ${stylePreset.chipBg}; border: 4px solid ${stylePreset.secondary}33; }
  .dot-main { background: ${stylePreset.primary}; border-color: ${stylePreset.primary}; }
  .block p { margin: 0; color: ${stylePreset.ink}; font-size: 27px; line-height: 1.62; font-weight: 500; white-space: pre-wrap; word-break: break-word; }
  .block p.lead { font-weight: 760; }
  .block-heading p { color: ${stylePreset.ink}; font-size: 34px; line-height: 1.32; font-weight: 900; padding-bottom: 10px; border-bottom: 2px solid ${stylePreset.primary}33; }
  .footer { margin-top: 42px; margin-bottom: 4px; display: grid; grid-template-columns: 1fr 190px; gap: 24px; align-items: center; border-radius: 34px; padding: 30px; background: rgba(255,255,255,.82); border: 1px solid rgba(255,255,255,.7); box-shadow: 0 18px 48px rgba(15,23,42,.12); }
  .scan { color: ${stylePreset.primary}; font-size: 22px; font-weight: 900; margin-bottom: 10px; }
  .url { color: ${stylePreset.muted}; font-size: 19px; line-height: 1.5; word-break: break-all; }
  .qr { width: 176px; height: 176px; border-radius: 24px; background: #fff; display: flex; align-items: center; justify-content: center; justify-self: end; box-shadow: 0 10px 30px rgba(15,23,42,.12); }
  .qr img { width: 148px; height: 148px; }
</style>
</head>
<body>
  <div class="poster">
    <div class="orb-a"></div>
    <div class="orb-b"></div>
    <div class="wrap">
      <div class="head">
        <div class="brand">
          ${brandLogo}
          <div>
            <div class="style-name">${escapeHtml(brandName)}</div>
            <div class="decoration">${escapeHtml(stylePreset.decoration)}</div>
          </div>
        </div>
        <div class="vn">VideoNote</div>
      </div>
      <div class="card">
        <div class="cover">
          ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" crossorigin="anonymous" />` : `<div class="fallback"><div class="fallback-mark">${fallbackLogo}</div></div>`}
          <div class="shade"></div>
          <div class="chips">
            <span class="chip">${escapeHtml(platformLabel)}</span>
            <span class="chip chip-primary">${escapeHtml(stylePreset.contentLabel)}</span>
          </div>
        </div>
        <div class="body">
          <h1>${escapeHtml(title)}</h1>
          <div class="meta"><span>${escapeHtml(author)}</span><span>·</span><span>${escapeHtml(shareTime)}</span></div>
          <div class="rule"></div>
          <div class="points">${pointHtml}</div>
        </div>
      </div>
      <div class="footer">
        <div>
          <div class="scan">扫码查看原视频</div>
          <div class="url">${escapeHtml(shareUrl)}</div>
        </div>
        <div class="qr">${qrUrl ? `<img src="${escapeHtml(qrUrl)}" />` : ''}</div>
      </div>
    </div>
  </div>
</body>
</html>`
}

async function dataUrlToFile(dataUrl: string, filename: string) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: 'image/png' })
}

export default function SharePosterDialog({ open, onOpenChange, task, content }: SharePosterDialogProps) {
  const [styleId, setStyleId] = useState<PosterStyleId>('bilibili')
  const [qrUrl, setQrUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [coverFailed, setCoverFailed] = useState(false)
  const posterRef = useRef<HTMLDivElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const style = useMemo(
    () => POSTER_STYLES.find(item => item.id === styleId) || POSTER_STYLES[0],
    [styleId]
  )
  const title = useMemo(() => getTaskTitle(task), [task])
  const author = useMemo(() => getAuthor(task), [task])
  const coverUrl = useMemo(() => getCoverUrl(task), [task])
  const blocks = useMemo(() => getPosterBlocks(content), [content])
  const shareUrl = useMemo(() => getPublicShareUrl(task), [task])
  const platformLabel = PLATFORM_LABELS[task.platform] || task.platform
  const shareTime = useMemo(() => formatShareTime(), [open, task.id])

  useEffect(() => {
    if (!open) return
    setCoverFailed(false)
    setImageUrl('')
  }, [open, styleId, task.id])

  useEffect(() => {
    if (!open || !shareUrl) return
    QRCode.toDataURL(shareUrl, {
      width: 220,
      margin: 1,
      color: {
        dark: style.ink,
        light: '#ffffff',
      },
    }).then(setQrUrl).catch(() => setQrUrl(''))
  }, [open, shareUrl, style])

  const generateImage = useCallback(async () => {
    const iframe = iframeRef.current
    if (!iframe) return ''

    setGenerating(true)
    try {
      const html = buildPosterHTML({
        stylePreset: style,
        title,
        author,
        platformLabel,
        coverUrl: coverFailed ? '' : coverUrl,
        blocks: blocks.length ? blocks : [{ type: 'paragraph', text: '暂无可分享的笔记内容' }],
        shareTime,
        qrUrl,
        shareUrl,
      })

      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve()
        iframe.srcdoc = html
      })

      const doc = iframe.contentDocument
      if (!doc?.body) throw new Error('海报渲染失败')
      const images = Array.from(doc.images)
      await Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
        img.onload = resolve
        img.onerror = resolve
      })))

      const height = Math.ceil(doc.documentElement.scrollHeight || doc.body.scrollHeight)
      iframe.style.height = `${height}px`
      const canvas = await html2canvas(doc.body, {
        width: 1080,
        height,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1080,
        windowHeight: height,
      })
      const url = canvas.toDataURL('image/png', 1)
      setImageUrl(url)
      return url
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '海报生成失败')
      return ''
    } finally {
      setGenerating(false)
    }
  }, [author, blocks, coverFailed, coverUrl, platformLabel, qrUrl, shareTime, shareUrl, style, task.platform, title])

  useEffect(() => {
    if (!open || !qrUrl) return
    const timer = window.setTimeout(() => {
      generateImage()
    }, 180)
    return () => window.clearTimeout(timer)
  }, [open, qrUrl, styleId, coverFailed, generateImage])

  const handleDownload = async () => {
    const url = imageUrl || await generateImage()
    if (!url) return
    const link = document.createElement('a')
    link.href = url
    link.download = `${safeFilename(title)}-${new Date().toISOString().slice(0, 10)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('分享链接已复制')
    } catch {
      toast.error('复制失败，请手动复制链接')
    }
  }

  const handleSystemShare = async () => {
    const url = imageUrl || await generateImage()
    if (!url) return

    try {
      const file = await dataUrlToFile(url, `${safeFilename(title)}.png`)
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean
      }
      if (navigator.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await navigator.share({
          title,
          text: `来自 VideoNote 的分享海报：${title}`,
          url: shareUrl,
          files: [file],
        })
        return
      }
      if (navigator.share) {
        await navigator.share({
          title,
          text: `来自 VideoNote 的分享海报：${title}`,
          url: shareUrl,
        })
        return
      }
      await handleCopyLink()
      toast.info('当前浏览器不支持系统分享，已复制链接')
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      toast.error('系统分享不可用，可保存海报或复制链接')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <iframe
        ref={iframeRef}
        title="share-poster-render"
        sandbox="allow-same-origin"
        style={{
          position: 'fixed',
          left: -2000,
          top: 0,
          width: 1080,
          height: 1440,
          border: 0,
          pointerEvents: 'none',
          opacity: 0,
        }}
      />
      <DialogContent className="max-h-[92vh] w-[min(1180px,calc(100vw-3rem))] overflow-hidden p-0 max-sm:h-[92vh] max-sm:w-[calc(100vw-1.25rem)] sm:max-w-[min(1180px,calc(100vw-3rem))]">
        <div className="grid max-h-[92vh] min-h-[680px] grid-cols-[320px_minmax(0,1fr)] overflow-hidden max-lg:grid-cols-1 max-sm:h-full max-sm:min-h-0 max-sm:grid-rows-[auto_minmax(0,1fr)]">
          <aside className="border-r border-border bg-muted/35 p-5 max-lg:border-b max-lg:border-r-0 max-sm:p-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 max-sm:text-base">
                <Sparkles className="size-5 text-primary" />
                分享海报
              </DialogTitle>
              <DialogDescription className="max-sm:line-clamp-1 max-sm:text-xs">
                选择一个社交平台风格，生成可保存、可分享的笔记海报。
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-2 max-sm:mt-3 max-sm:flex max-sm:gap-2 max-sm:space-y-0 max-sm:overflow-x-auto max-sm:pb-1">
              {POSTER_STYLES.map(item => {
                const active = item.id === styleId
                return (
                  <button
                    key={item.id}
                    onClick={() => setStyleId(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all max-sm:w-auto max-sm:min-w-[84px] max-sm:flex-col max-sm:gap-1.5 max-sm:rounded-2xl max-sm:px-2.5 max-sm:py-2 max-sm:text-center',
                      active
                        ? 'border-primary/45 bg-background shadow-sm'
                        : 'border-border/70 bg-background/65 hover:border-primary/25 hover:bg-background'
                    )}
                  >
                    <StyleOptionMark stylePreset={item} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground max-sm:justify-center max-sm:text-xs">
                        {item.name}
                        {active && <Check className="size-3.5 text-primary" />}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground max-sm:hidden">{item.description}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground/80 max-sm:hidden">{item.mood}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden bg-background">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 max-sm:px-3 max-sm:py-2">
              <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground max-sm:w-full max-sm:text-xs">
                <QrCode className="size-4" />
                <span className="truncate">{shareUrl}</span>
              </div>
              <div className="flex items-center gap-2 max-sm:w-full max-sm:gap-1.5">
                <Button variant="outline" size="sm" onClick={handleCopyLink} className="max-sm:h-8 max-sm:flex-1 max-sm:px-2">
                  <Copy className="size-4" />
                  复制链接
                </Button>
                <Button variant="outline" size="sm" onClick={handleSystemShare} disabled={generating} className="max-sm:h-8 max-sm:flex-1 max-sm:px-2">
                  <Share2 className="size-4" />
                  系统分享
                </Button>
                <Button size="sm" onClick={handleDownload} disabled={generating} className="max-sm:h-8 max-sm:flex-1 max-sm:px-2">
                  {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  保存海报
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.08),transparent_32%),hsl(var(--muted)/0.4)] p-6 max-sm:p-3">
              <div className="mx-auto w-fit max-w-full overflow-auto rounded-2xl border border-border bg-background shadow-xl">
                <div className="origin-top-left max-sm:[zoom:0.42]" style={{ zoom: 0.4445 }}>
                  <PosterCanvas
                    ref={posterRef}
                    stylePreset={style}
                    title={title}
                    author={author}
                    platformLabel={platformLabel}
                    coverUrl={coverFailed ? '' : coverUrl}
                    onCoverError={() => setCoverFailed(true)}
                    blocks={blocks.length ? blocks : [{ type: 'paragraph', text: '暂无可分享的笔记内容' }]}
                    shareTime={shareTime}
                    qrUrl={qrUrl}
                    shareUrl={shareUrl}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface PosterCanvasProps {
  stylePreset: PosterStyle
  title: string
  author: string
  platformLabel: string
  coverUrl: string
  onCoverError: () => void
  blocks: PosterBlock[]
  shareTime: string
  qrUrl: string
  shareUrl: string
}

const PosterCanvas = forwardRef<HTMLDivElement, PosterCanvasProps>(({
  stylePreset,
  title,
  author,
  platformLabel,
  coverUrl,
  onCoverError,
  blocks,
  shareTime,
  qrUrl,
  shareUrl,
}, ref) => {
  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        position: 'relative',
        overflow: 'hidden',
        paddingBottom: 64,
        background: stylePreset.background,
        color: stylePreset.ink,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 520,
          height: 520,
          borderRadius: 999,
          top: -160,
          right: -140,
          background: stylePreset.primary,
          opacity: 0.16,
          filter: 'blur(10px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: 999,
          bottom: -120,
          left: -120,
          background: stylePreset.secondary,
          opacity: 0.13,
          filter: 'blur(12px)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, padding: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <BrandMark stylePreset={stylePreset} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0 }}>
                {stylePreset.id === 'professional' ? 'VideoNote' : stylePreset.logo}
              </div>
              <div style={{ marginTop: 6, color: stylePreset.muted, fontSize: 20 }}>{stylePreset.decoration}</div>
            </div>
          </div>
          <div
            style={{
              borderRadius: 999,
              padding: '12px 20px',
              background: stylePreset.chipBg,
              color: stylePreset.chipText,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            VideoNote
          </div>
        </div>

        <div
          style={{
            borderRadius: 42,
            background: stylePreset.panel,
            boxShadow: '0 30px 90px rgba(15, 23, 42, 0.18)',
            border: '1px solid rgba(255,255,255,0.66)',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'relative', height: 392, background: stylePreset.chipBg }}>
            {coverUrl ? (
              <img
                src={coverUrl}
                crossOrigin="anonymous"
                alt=""
                onError={onCoverError}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `linear-gradient(135deg, ${stylePreset.primary}22, ${stylePreset.secondary}2c)`,
                }}
              >
                <BrandMark stylePreset={stylePreset} large />
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.06), rgba(0,0,0,0.46))',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 34,
                bottom: 30,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span
                style={{
                  borderRadius: 999,
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.9)',
                  color: stylePreset.ink,
                  fontSize: 19,
                  fontWeight: 800,
                }}
              >
                {platformLabel}
              </span>
              <span
                style={{
                  borderRadius: 999,
                  padding: '10px 16px',
                  background: stylePreset.primary,
                  color: '#fff',
                  fontSize: 19,
                  fontWeight: 800,
                }}
              >
                {stylePreset.contentLabel}
              </span>
            </div>
          </div>

          <div style={{ padding: '42px 46px 36px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 52,
                lineHeight: 1.12,
                letterSpacing: 0,
                color: stylePreset.ink,
                fontWeight: 900,
              }}
            >
              {title}
            </h1>
            <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12, color: stylePreset.muted, fontSize: 22 }}>
              <span>{author}</span>
              <span>·</span>
              <span>{shareTime}</span>
            </div>

            <div style={{ marginTop: 34, height: 3, width: '100%', background: `linear-gradient(90deg, ${stylePreset.primary}, ${stylePreset.secondary}, transparent)` }} />

            <div style={{ marginTop: 34, display: 'grid', gap: 18 }}>
              {blocks.map((block, index) => (
                <div
                  key={`${block.text}-${index}`}
                  style={block.type === 'heading'
                    ? { display: 'block', marginTop: 14 }
                    : { display: 'grid', gridTemplateColumns: '34px 1fr', gap: 16 }}
                >
                  {block.type !== 'heading' && (
                    <span
                      style={{
                        marginTop: 8,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: index === 0 ? stylePreset.primary : stylePreset.chipBg,
                        border: `4px solid ${index === 0 ? stylePreset.primary : stylePreset.secondary}33`,
                      }}
                    />
                  )}
                  <p
                    style={{
                      margin: 0,
                      color: stylePreset.ink,
                      fontSize: block.type === 'heading' ? 34 : 27,
                      lineHeight: block.type === 'heading' ? 1.32 : 1.62,
                      fontWeight: block.type === 'heading' ? 900 : (index === 0 ? 760 : 500),
                      paddingBottom: block.type === 'heading' ? 10 : 0,
                      borderBottom: block.type === 'heading' ? `2px solid ${stylePreset.primary}33` : undefined,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {block.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 42,
            marginBottom: 4,
            display: 'grid',
            gridTemplateColumns: '1fr 190px',
            gap: 24,
            alignItems: 'center',
            borderRadius: 34,
            padding: 30,
            background: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 18px 48px rgba(15, 23, 42, 0.12)',
          }}
        >
          <div>
            <div style={{ color: stylePreset.primary, fontSize: 22, fontWeight: 900, marginBottom: 10 }}>
              扫码查看原视频
            </div>
            <div style={{ color: stylePreset.muted, fontSize: 19, lineHeight: 1.5, wordBreak: 'break-all' }}>
              {shareUrl}
            </div>
          </div>
          <div
            style={{
              width: 176,
              height: 176,
              borderRadius: 24,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              justifySelf: 'end',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            }}
          >
            {qrUrl ? (
              <img src={qrUrl} alt="" style={{ width: 148, height: 148 }} />
            ) : (
              <QrCode style={{ width: 82, height: 82, color: stylePreset.primary }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

PosterCanvas.displayName = 'PosterCanvas'
