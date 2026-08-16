import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import {
  User, Users, Compass, Star, Palette, Heart, MessageCircle, Eye,
  TrendingUp, Activity, GitCompareArrows, Route, Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* ---------- 类型 ---------- */
interface Section {
  title: string
  body: string
}
interface LabeledItem {
  label: string
  text: string
}
type SectionKind =
  | 'profile'    // 博主画像分析
  | 'traits'     // 博主喜好与特点
  | 'evolution'  // 内容演变分析
  | 'recent'     // 最近动态
  | 'compare'    // 跨平台对比
  | 'theme'      // 内容主题演变
  | 'generic'

/* ---------- 解析 ---------- */
const AI_TAGS_RE = /<!--\s*AI_TAGS:\s*(\[[\s\S]*?\])\s*-->/

function safeParseTags(json: string): string[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((t) => typeof t === 'string') : []
  } catch {
    return []
  }
}

export function parseTrajectory(md: string) {
  const tagsMatch = md.match(AI_TAGS_RE)
  const tags = tagsMatch ? safeParseTags(tagsMatch[1]) : []
  let content = md.replace(AI_TAGS_RE, '').trim()
  // 修复 LLM 输出的转义有序列表（如 `1\.` -> `1.`）
  content = content.replace(/^(\d+)\\\./gm, '$1.')

  // 主标题（# xxx）
  const h1 = content.match(/^#\s+(.+)$/m)
  const mainTitle = h1?.[1]?.trim() ?? ''
  if (h1 && h1.index !== undefined) {
    content = content.slice(h1.index + h1[0].length)
  }

  // 按 ## 拆分板块
  const sections: Section[] = []
  let preamble = ''
  for (const part of content.split(/\n(?=##\s)/)) {
    const m = part.match(/^##\s+(.+)$/m)
    if (m) {
      sections.push({ title: m[1].trim(), body: part.slice(m[0].length).trim() })
    } else if (part.trim()) {
      preamble += part.trim() + '\n'
    }
  }
  return { mainTitle, preamble: preamble.trim(), sections, tags }
}

/** 解析 `- **标签**：内容` 结构的条目 */
function parseLabeledItems(body: string): LabeledItem[] {
  const items: LabeledItem[] = []
  const re = /[-*]\s*\*\*(.+?)\*\*\s*[：:]\s*(.+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    items.push({ label: m[1].trim(), text: m[2].trim() })
  }
  return items
}

function getSectionKind(title: string): SectionKind {
  if (title.includes('画像')) return 'profile'
  if (title.includes('喜好') || title.includes('特点')) return 'traits'
  if (title.includes('演变分析')) return 'evolution'
  if (title.includes('最近动态')) return 'recent'
  if (title.includes('跨平台')) return 'compare'
  if (title.includes('主题演变') || title.includes('演变')) return 'theme'
  return 'generic'
}

/* ---------- 图标/配色映射 ---------- */
interface Meta {
  icon: typeof User
  color: string
  bg: string
}

const PROFILE_META: Record<string, Meta> = {
  身份: { icon: User, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  领域: { icon: Compass, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  受众: { icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  人设: { icon: Star, color: 'text-amber-500', bg: 'bg-amber-500/10' },
}

const TRAIT_META: Record<string, Meta> = {
  创作: { icon: Palette, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  主题: { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  表达: { icon: MessageCircle, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  视觉: { icon: Eye, color: 'text-teal-500', bg: 'bg-teal-500/10' },
}

const KIND_HEADER_META: Record<SectionKind, Meta> = {
  profile: { icon: User, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  traits: { icon: Palette, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  evolution: { icon: TrendingUp, color: 'text-violet-500', bg: 'bg-violet-500/10' },
  recent: { icon: Activity, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  compare: { icon: GitCompareArrows, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  theme: { icon: Route, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  generic: { icon: Star, color: 'text-muted-foreground', bg: 'bg-muted' },
}

function matchMeta(meta: Record<string, Meta>, label: string): Meta {
  for (const key of Object.keys(meta)) {
    if (label.includes(key)) return meta[key]
  }
  return Object.values(meta)[0]
}

/* ---------- 子组件 ---------- */

function MarkdownBlock({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn('prose prose-sm dark:prose-invert max-w-none', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}

function SectionHeader({ meta, title }: { meta: Meta; title: string }) {
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-2">
      <div className={cn('rounded-md p-1', meta.bg)}>
        <Icon className={cn('w-3.5 h-3.5', meta.color)} />
      </div>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

/** 博主画像分析 — 渐变横幅 + 头像 + 结构化维度条目 */
function ProfileCard({ section }: { section: Section }) {
  const items = useMemo(() => parseLabeledItems(section.body), [section.body])
  const headerMeta = KIND_HEADER_META.profile
  return (
    <div className="rounded-xl border bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10 p-4 md:p-5">
      <SectionHeader meta={headerMeta} title={section.title} />
      {items.length > 0 ? (
        <div className="mt-3 flex flex-col sm:flex-row gap-4">
          <div className="flex sm:flex-col items-center gap-2 shrink-0 sm:w-20">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/25">
              <User className="w-7 h-7 text-white" />
            </div>
            <span className="text-[10px] text-muted-foreground">AI 推断</span>
          </div>
          <div className="flex-1 grid gap-2 min-w-0">
            {items.map((item) => {
              const meta = matchMeta(PROFILE_META, item.label)
              const Icon = meta.icon
              return (
                <div
                  key={item.label}
                  className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-background/60 backdrop-blur px-3 py-2"
                >
                  <div className={cn('mt-0.5 rounded-md p-1 shrink-0', meta.bg)}>
                    <Icon className={cn('w-3.5 h-3.5', meta.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-none mb-1">{item.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <MarkdownBlock content={section.body} />
        </div>
      )}
    </div>
  )
}

/** 博主喜好与特点 — 2 列网格卡片 */
function TraitsCard({ section }: { section: Section }) {
  const items = useMemo(() => parseLabeledItems(section.body), [section.body])
  const headerMeta = KIND_HEADER_META.traits
  return (
    <div className="rounded-xl border bg-card p-4 md:p-5">
      <SectionHeader meta={headerMeta} title={section.title} />
      {items.length > 0 ? (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map((item) => {
            const meta = matchMeta(TRAIT_META, item.label)
            const Icon = meta.icon
            return (
              <div
                key={item.label}
                className="rounded-lg border bg-gradient-to-br from-background to-muted/30 p-3 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div className={cn('rounded-md p-1', meta.bg)}>
                    <Icon className={cn('w-3.5 h-3.5', meta.color)} />
                  </div>
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground leading-relaxed">{item.text}</p>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="mt-2">
          <MarkdownBlock content={section.body} />
        </div>
      )}
    </div>
  )
}

/** 通用板块卡片（演变分析/最近动态/跨平台对比/主题演变/未知板块） */
function GenericSectionCard({ section, kind }: { section: Section; kind: SectionKind }) {
  const meta = KIND_HEADER_META[kind]
  const emphasis = kind === 'evolution'
  return (
    <div
      className={cn(
        'rounded-xl border bg-card p-4 md:p-5',
        emphasis && 'border-l-4 border-l-violet-500'
      )}
    >
      <SectionHeader meta={meta} title={section.title} />
      <div className="mt-2">
        <MarkdownBlock content={section.body} />
      </div>
    </div>
  )
}

/** AI_TAGS 标签云 */
function TagsCloud({ tags }: { tags: string[] }) {
  return (
    <div className="flex items-center gap-2 flex-wrap rounded-xl border border-dashed bg-muted/20 px-4 py-3">
      <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs">
          {t}
        </span>
      ))}
    </div>
  )
}

/* ---------- 主组件 ---------- */
export function TrajectorySummaryCard({ content }: { content: string }) {
  const { mainTitle, preamble, sections, tags } = useMemo(() => parseTrajectory(content), [content])

  if (!mainTitle && sections.length === 0) {
    return <MarkdownBlock content={content} className="rounded-lg bg-muted/30 p-4" />
  }

  return (
    <div className="space-y-3.5">
      {mainTitle && (
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1 rounded-full bg-gradient-to-b from-violet-500 to-pink-500" />
          <h3 className="text-base font-semibold">{mainTitle}</h3>
        </div>
      )}
      {preamble && <MarkdownBlock content={preamble} className="px-1" />}

      {sections.map((section, idx) => {
        const kind = getSectionKind(section.title)
        if (kind === 'profile') return <ProfileCard key={idx} section={section} />
        if (kind === 'traits') return <TraitsCard key={idx} section={section} />
        return <GenericSectionCard key={idx} section={section} kind={kind} />
      })}

      {tags.length > 0 && <TagsCloud tags={tags} />}
    </div>
  )
}
