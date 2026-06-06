import { memo } from 'react'
import { type ColumnDef, type HeaderContext } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, LoaderCircle, Rss, ArrowUpDown, RotateCw, Library } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo, XiaohongshuLogo, CCTVLogo } from '@/components/Icons/platform'
import { TagEditorPopover } from '@/components/TagEditorPopover'
import type { Task } from '@/store/taskStore'
import type { TaskTags } from '@/types/api'

const NotePreview = memo(function NotePreview({ note }: { note: string }) {
  return (
    <div className="min-w-0 max-w-md">
      <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">{note}</div>
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
  taskCollectionMap: Record<string, { id: string; name: string }[]>
  onNavigateToCollection: (collectionId: string) => void
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
      size: 40,
    },
    {
      accessorKey: 'cover',
      header: '封面',
      size: 240,
      cell: ({ row }) => {
        const item = row.original
        const status = getRealtimeStatus(item, props.taskStoreTasks)
        const { currentStep, stepLabel } = getStepProgress(status)
        const isProcessing = isProcessingStatus(status)

        return (
          <div className="w-60 py-2">
            <div className="relative h-56 overflow-hidden rounded-lg bg-muted">
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
              {/* 博主名覆盖左下角 */}
              {item.author && (
                <div className="absolute bottom-2 left-2 bg-gray-800/80 text-white text-xs px-2 py-1 rounded">
                  {item.author}
                </div>
              )}
              {/* 订阅状态覆盖右下角 */}
              {item.video_url && props.isSubscribable(item.platform) && props.isSubscribed(item.author) && (
                <div className="absolute bottom-2 right-2 bg-gray-800/80 text-white text-xs px-2 py-1 rounded">
                  已订阅
                </div>
              )}
              {/* 收藏按钮右上角 */}
              {props.isSubscribable(item.platform) && item.author && (
                <button
                  className={cn(
                    'absolute top-2 right-2 p-1.5 rounded-full transition-colors',
                    props.isSubscribed(item.author)
                      ? 'bg-primary text-white'
                      : 'bg-white/80 text-gray-600 hover:bg-primary hover:text-white',
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
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2">
                  <LoaderCircle className="w-6 h-6 text-white animate-spin" />
                  <span className="text-white text-sm">{stepLabel} ({currentStep}/6)</span>
                </div>
              )}
              {(status === 'QUEUED' || status === 'PENDING') && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <LoaderCircle className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
              {status === 'FAILED' && (
                <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                  <span className="text-white text-sm">生成失败</span>
                </div>
              )}
            </div>
            {/* 标签行 - 圆角胶囊 */}
            {(item.tags?.platform_tags?.length || item.tags?.ai_tags?.length || item.tags?.manual_tags?.length) && (
              <div className="mt-2 flex flex-wrap justify-end gap-2 items-center" onClick={e => e.stopPropagation()}>
                {item.tags?.platform_tags?.map((tag, i) => (
                  <span key={`p${i}`} className="rounded-full border border-blue-200 bg-blue-50 text-blue-600 px-2.5 py-0.5 text-xs">
                    {tag}
                  </span>
                ))}
                {item.tags?.ai_tags?.map((tag, i) => (
                  <span key={`a${i}`} className="rounded-full border border-purple-200 bg-purple-50 text-purple-600 px-2.5 py-0.5 text-xs">
                    #{tag}
                  </span>
                ))}
                {item.tags?.manual_tags?.map((tag, i) => (
                  <span key={`m${i}`} className="rounded-full border border-green-200 bg-green-50 text-green-600 px-2.5 py-0.5 text-xs">
                    #{tag}
                  </span>
                ))}
                <TagEditorPopover
                  taskId={item.task_id}
                  tags={item.tags}
                  onUpdate={(newTags) => props.onTagsUpdate?.(item.id, newTags)}
                  hideTrigger
                />
              </div>
            )}
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
      cell: ({ row }) => {
        const item = row.original
        const collections = props.taskCollectionMap[item.task_id]
        return (
          <div className="min-w-0 py-2">
            <div className="font-medium text-foreground line-clamp-2 text-sm">{item.title}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <PlatformIconSmall platform={item.platform} />
                {item.author || platformLabel[item.platform]}
              </span>
              <span>·</span>
              <span>{item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : ''}</span>
            </div>
            {collections?.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                {collections.map(c => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-0.5 text-[10px] bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.5 rounded cursor-pointer hover:bg-violet-500/20 transition-colors"
                    onClick={() => props.onNavigateToCollection(c.id)}
                  >
                    <Library className="w-2.5 h-2.5" />
                    {c.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'note',
      header: '内容预览',
      cell: ({ row }) => <NotePreview note={row.original.note} />,
    },
    {
      id: 'actions',
      header: () => <div className="text-right">操作</div>,
      size: 80,
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
