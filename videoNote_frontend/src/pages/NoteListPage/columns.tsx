import { memo } from 'react'
import { type ColumnDef, type HeaderContext } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, LoaderCircle, Rss, ArrowUpDown, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo, XiaohongshuLogo, CCTVLogo } from '@/components/Icons/platform'
import { TagEditorPopover } from '@/components/TagEditorPopover'
import type { Task } from '@/store/taskStore'
import type { TaskTags } from '@/types/api'

const NotePreview = memo(function NotePreview({ note }: { note: string }) {
  const cleanedNote = note?.replace(/[#*_\[\]>`]/g, '').trim()
  return (
    <div className="min-w-0 max-w-xl">
      <div className="line-clamp-2 text-sm leading-6 text-muted-foreground">
        {cleanedNote || '暂无内容预览'}
      </div>
    </div>
  )
})

export interface NoteItem {
  id: string
  task_id: string
  cover: string
  platform: string
  title: string
  author: string
  note: string
  created_at: string
  status: string
  video_url: string
  tags?: TaskTags
}

export function PlatformIconSmall({ platform }: { platform: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    bilibili: <BiliBiliLogo className="w-6 h-6" />,
    youtube: <YoutubeLogo className="w-6 h-6" />,
    douyin: <DouyinLogo className="w-6 h-6" />,
    kuaishou: <KuaishouLogo className="w-6 h-6" />,
    xiaohongshu: <XiaohongshuLogo className="w-6 h-6" />,
    local: <LocalLogo className="w-6 h-6" />,
    local_audio: <AudioLogo className="w-6 h-6" />,
    cctv: <CCTVLogo className="w-6 h-6" />,
  }
  return <>{iconMap[platform] || <LocalLogo className="w-6 h-6" />}</>
}

interface ColumnProps {
  selectedRowsSet: Set<string>
  onSelectRow: (id: string) => void
  onSelectAll: (pageIds: string[]) => void
  onRowClick: (item: NoteItem) => void
  onDelete: (taskId: string) => void
  onRegenerate: (item: NoteItem) => void
  onSubscribe: (videoUrl: string) => void
  failedCovers: Set<string>
  onCoverError: (id: string) => void
  isSubscribed: (author: string) => boolean
  isSubscribable: (platform: string) => boolean
  taskStoreTasks: Task[]
  onTagsUpdate?: (id: string, tags: any) => void
}

// 从 taskStore 获取实时状态，优先使用 taskStore 的值
function getRealtimeStatus(item: NoteItem, taskStoreTasks: Task[]): string {
  const storeTask = taskStoreTasks.find(t => t.id === item.task_id)
  return storeTask?.status || item.status
}

const PROGRESS_STEPS = [
  { key: 'PARSING', label: '解析', order: 1 },
  { key: 'DOWNLOADING', label: '下载', order: 2 },
  { key: 'TRANSCRIBING', label: '转写', order: 3 },
  { key: 'SUMMARIZING', label: '总结', order: 4 },
  { key: 'SAVING', label: '保存', order: 5 },
  { key: 'SUCCESS', label: '完成', order: 6 },
]

const getStepProgress = (status: string) => {
  const step = PROGRESS_STEPS.find(s => s.key === status)
  if (!step) {
    if (status === 'FAILED') return { currentStep: 0, stepLabel: '失败' }
    if (status === 'QUEUED' || status === 'PENDING') return { currentStep: 0, stepLabel: '排队' }
    return { currentStep: 0, stepLabel: '未知' }
  }
  return { currentStep: step.order, stepLabel: step.label }
}

const isProcessingStatus = (status: string) =>
  ['PARSING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'FORMATTING', 'SAVING'].includes(status)

// 平台名称映射
const platformLabel: Record<string, string> = {
  bilibili: 'B站',
  youtube: 'YouTube',
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  cctv: '央视网',
  local: '本地视频',
  local_audio: '本地音频',
}

function TagsCompact({ item, onUpdate }: { item: NoteItem; onUpdate?: (id: string, tags: any) => void }) {
  const tags = [
    ...(item.tags?.platform_tags || []).map(tag => ({ key: `p-${tag}`, label: tag, tone: 'primary' as const })),
    ...(item.tags?.ai_tags || []).map(tag => ({ key: `a-${tag}`, label: `#${tag}`, tone: 'muted' as const })),
    ...(item.tags?.manual_tags || []).map(tag => ({ key: `m-${tag}`, label: `#${tag}`, tone: 'plain' as const })),
  ]

  if (tags.length === 0) {
    return (
      <div onClick={e => e.stopPropagation()}>
        <TagEditorPopover
          taskId={item.task_id}
          tags={item.tags}
          onUpdate={(newTags) => onUpdate?.(item.id, newTags)}
          hideTrigger
        />
      </div>
    )
  }

  return (
    <div className="mt-2 flex max-h-14 flex-wrap items-center gap-1.5 overflow-hidden" onClick={e => e.stopPropagation()}>
      {tags.slice(0, 6).map(tag => (
        <span
          key={tag.key}
          className={cn(
            "inline-flex max-w-[120px] items-center truncate rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5",
            tag.tone === 'primary' && "border-primary/20 bg-primary-light text-primary",
            tag.tone === 'muted' && "border-border bg-secondary text-secondary-foreground",
            tag.tone === 'plain' && "border-border bg-card text-muted-foreground",
          )}
        >
          {tag.label}
        </span>
      ))}
      {tags.length > 6 && (
        <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium leading-5 text-muted-foreground">
          +{tags.length - 6}
        </span>
      )}
      <TagEditorPopover
        taskId={item.task_id}
        tags={item.tags}
        onUpdate={(newTags) => onUpdate?.(item.id, newTags)}
        hideTrigger
      />
    </div>
  )
}

export function getColumns(props: ColumnProps): ColumnDef<NoteItem>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            props.selectedRowsSet.size > 0 &&
            props.selectedRowsSet.size === table.getRowModel().rows.length
          }
          onCheckedChange={() => {
            const pageIds = table.getRowModel().rows.map(r => r.original.id)
            props.onSelectAll(pageIds)
          }}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={props.selectedRowsSet.has(row.original.id)}
          onCheckedChange={() => props.onSelectRow(row.original.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 36,
    },
    {
      accessorKey: 'cover',
      header: '封面',
      size: 140,
      cell: ({ row }) => {
        const item = row.original
        const status = getRealtimeStatus(item, props.taskStoreTasks)
        const { currentStep, stepLabel } = getStepProgress(status)
        const isProcessing = isProcessingStatus(status)

        return (
          <div className="w-28 py-2">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-border/70 bg-muted shadow-sm">
              {item.cover && !props.failedCovers.has(item.id) ? (
                <img
                  src={item.cover}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => props.onCoverError(item.id)}
                />
              ) : (
                <div className="h-full w-full flex flex-col items-center justify-center gap-1">
                  <PlatformIconSmall platform={item.platform} />
                  <span className="text-xs text-muted-foreground">{item.author || platformLabel[item.platform]}</span>
                </div>
              )}
              {/* 收藏按钮右上角 */}
              {props.isSubscribable(item.platform) && item.author && (
                <button
                  className={cn(
                    'absolute right-1.5 top-1.5 rounded-lg p-1.5 shadow-sm backdrop-blur transition-colors',
                    props.isSubscribed(item.author)
                      ? 'bg-primary text-white'
                      : 'bg-background/85 text-muted-foreground hover:bg-primary hover:text-white',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (props.isSubscribed(item.author)) {
                      import('sonner').then(t => t.toast.info('已订阅该频道'))
                    } else {
                      props.onSubscribe(item.video_url)
                    }
                  }}
                >
                  <Rss className="w-3.5 h-3.5" />
                </button>
              )}
              {/* 处理中状态覆盖 */}
              {isProcessing && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/45">
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                  <span className="text-xs text-white">{stepLabel} ({currentStep}/6)</span>
                </div>
              )}
              {(status === 'QUEUED' || status === 'PENDING') && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <LoaderCircle className="h-4 w-4 animate-spin text-white" />
                </div>
              )}
              {status === 'FAILED' && (
                <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                  <span className="text-xs text-white">失败</span>
                </div>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'title',
      header: ({ column }: HeaderContext<NoteItem, unknown>) => (
        <button
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          标题
          <ArrowUpDown className="h-4 w-4" />
        </button>
      ),
      size: 340,
      cell: ({ row }) => {
        const item = row.original
        return (
          <div className="min-w-0 py-2">
            <div className="line-clamp-1 text-sm font-semibold text-foreground">{item.title}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <PlatformIconSmall platform={item.platform} />
                {item.author || platformLabel[item.platform]}
              </span>
              <span className="text-muted-foreground/45">/</span>
              <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : ''}</span>
            </div>
            <TagsCompact item={item} onUpdate={props.onTagsUpdate} />
          </div>
        )
      },
    },
    {
      accessorKey: 'note',
      header: '内容预览',
      size: 420,
      cell: ({ row }) => <NotePreview note={row.original.note} />,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">操作</div>,
      size: 72,
      cell: ({ row }) => {
        const item = row.original
        const status = getRealtimeStatus(item, props.taskStoreTasks)
        return (
          <div className="flex items-center justify-end gap-1">
            {status === 'FAILED' && (
              <button className="p-1.5 hover:bg-accent rounded-md transition-colors"
                onClick={(e) => { e.stopPropagation(); props.onRegenerate(item) }}>
                <RotateCw className="w-4 h-4 text-primary" />
              </button>
            )}
            <button className="p-1.5 hover:bg-accent rounded-md transition-colors"
              onClick={(e) => { e.stopPropagation(); props.onDelete(item.task_id) }}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </button>
          </div>
        )
      },
    },
  ]
}
