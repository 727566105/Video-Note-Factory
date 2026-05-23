import { type ColumnDef, type HeaderContext } from '@tanstack/react-table'
import { Checkbox } from '@/components/ui/checkbox'
import { Trash2, LoaderCircle, Rss, ArrowUpDown, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo } from '@/components/Icons/platform'
import type { Task } from '@/store/taskStore'

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
}

export function PlatformIconSmall({ platform }: { platform: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    bilibili: <BiliBiliLogo className="w-6 h-6" />,
    youtube: <YoutubeLogo className="w-6 h-6" />,
    douyin: <DouyinLogo className="w-6 h-6" />,
    kuaishou: <KuaishouLogo className="w-6 h-6" />,
    local: <LocalLogo className="w-6 h-6" />,
    local_audio: <AudioLogo className="w-6 h-6" />,
  }
  return <>{iconMap[platform] || <LocalLogo className="w-6 h-6" />}</>
}

interface ColumnProps {
  selectedRows: string[]
  onSelectRow: (id: string) => void
  onSelectAll: () => void
  onRowClick: (item: NoteItem) => void
  onDelete: (taskId: string) => void
  onRegenerate: (item: NoteItem) => void
  onSubscribe: (videoUrl: string) => void
  failedCovers: Set<string>
  onCoverError: (id: string) => void
  isSubscribed: (author: string) => boolean
  isSubscribable: (platform: string) => boolean
  taskStoreTasks: Task[]
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

export function getColumns(props: ColumnProps): ColumnDef<NoteItem>[] {
  return [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            props.selectedRows.length > 0 &&
            props.selectedRows.length === table.getFilteredRowModel().rows.length
          }
          onCheckedChange={props.onSelectAll}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={props.selectedRows.includes(row.original.id)}
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
      size: 140,
      cell: ({ row }) => {
        const item = row.original
        const status = getRealtimeStatus(item, props.taskStoreTasks)
        return (
          <div className="w-32">
            <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
              {item.cover && !props.failedCovers.has(item.id) ? (
                <img
                  src={item.cover}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => props.onCoverError(item.id)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-1">
                  <PlatformIconSmall platform={item.platform} />
                  <span className="text-xs text-muted-foreground">{item.author || item.platform}</span>
                </div>
              )}
              {(status === 'PENDING' || status === 'RUNNING' || status === 'QUEUED') && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <LoaderCircle className="w-6 h-6 text-white animate-spin" />
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
      cell: ({ row }) => {
        const item = row.original
        const status = getRealtimeStatus(item, props.taskStoreTasks)
        return (
          <div className="min-w-0 py-1">
            <div className="font-medium text-foreground line-clamp-2">{item.title}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">{item.author}</span>
              {props.isSubscribable(item.platform) && item.author && (
                <button
                  className={cn(
                    'flex items-center gap-0.5 text-xs transition-colors',
                    props.isSubscribed(item.author)
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-primary',
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
                  <Rss className="w-3 h-3" />
                </button>
              )}
            </div>
            {isProcessingStatus(status) && (() => {
              const { currentStep, stepLabel } = getStepProgress(status)
              return (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center gap-2 text-xs">
                    <LoaderCircle className="w-3 h-3 animate-spin text-primary" />
                    <span className="text-primary">{stepLabel}</span>
                    <span className="text-muted-foreground">{currentStep}/6</span>
                  </div>
                  <div className="flex gap-1">
                    {PROGRESS_STEPS.map((step, idx) => (
                      <div
                        key={step.key}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-all duration-300',
                          idx < currentStep ? 'bg-primary' : 'bg-muted',
                        )}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
            {status === 'QUEUED' && (
              <div className="flex items-center gap-2 text-xs mt-2 text-muted-foreground">
                <LoaderCircle className="w-3 h-3 animate-spin" />
                排队等待中...
              </div>
            )}
            {status === 'FAILED' && (
              <div className="text-xs mt-2 text-red-500">生成失败</div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: 'note',
      header: '笔记',
      cell: ({ row }) => (
        <div className="min-w-0 max-w-xs">
          <div className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-line">{row.original.note}</div>
        </div>
      ),
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
