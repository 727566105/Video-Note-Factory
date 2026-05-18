import { FC, useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  List,
  MoreHorizontal,
  X,
  CircleCheckBig,
  Sparkles,
  FileText,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTaskStore, type Task } from '@/store/taskStore'
import { getBaseURL } from '@/utils/api'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const STATUS_CONFIG: Record<string, { label: string; color: string; bgClass: string; borderClass: string; icon: FC<{ className?: string }> }> = {
  SUCCESS: {
    label: '已完成',
    color: 'text-green-600 dark:text-green-400',
    bgClass: 'bg-green-50 dark:bg-green-950/50',
    borderClass: 'border-green-200 dark:border-green-900',
    icon: CircleCheckBig,
  },
  FAILED: {
    label: '失败',
    color: 'text-red-600 dark:text-red-400',
    bgClass: 'bg-red-50 dark:bg-red-950/50',
    borderClass: 'border-red-200 dark:border-red-900',
    icon: AlertCircle,
  },
  RUNNING: {
    label: '处理中',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
  QUEUED: {
    label: '排队中',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
  PENDING: {
    label: '等待中',
    color: 'text-gray-500 dark:text-gray-400',
    bgClass: 'bg-gray-50 dark:bg-gray-900/50',
    borderClass: 'border-gray-200 dark:border-gray-800',
    icon: Loader2,
  },
  PARSING: {
    label: '解析链接',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
  DOWNLOADING: {
    label: '下载中',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
  TRANSCRIBING: {
    label: '转写中',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
  SUMMARIZING: {
    label: '总结中',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
  FORMATTING: {
    label: '格式化中',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
  SAVING: {
    label: '保存中',
    color: 'text-amber-600 dark:text-amber-400',
    bgClass: 'bg-amber-50 dark:bg-amber-950/50',
    borderClass: 'border-amber-200 dark:border-amber-900',
    icon: Loader2,
  },
}

const PROGRESS_STEPS = [
  { key: 'PARSING', label: '解析', order: 1 },
  { key: 'DOWNLOADING', label: '下载', order: 2 },
  { key: 'TRANSCRIBING', label: '转写', order: 3 },
  { key: 'SUMMARIZING', label: '总结', order: 4 },
  { key: 'SAVING', label: '保存', order: 5 },
  { key: 'SUCCESS', label: '完成', order: 6 },
]

const getStepProgress = (status: string): { currentStep: number; stepLabel: string } => {
  const step = PROGRESS_STEPS.find(s => s.key === status)
  if (!step) {
    if (status === 'FAILED') return { currentStep: 0, stepLabel: '失败' }
    if (status === 'QUEUED' || status === 'PENDING') return { currentStep: 0, stepLabel: '排队' }
    return { currentStep: 0, stepLabel: '未知' }
  }
  return { currentStep: step.order, stepLabel: step.label }
}

const getTaskTitle = (task: { platform: string; formData?: { video_url?: string }; audioMeta: { title: string } }) => {
  if ((task.platform === 'local_audio' || task.platform === 'local') && task.formData?.video_url) {
    const filename = task.formData.video_url.split('/').pop() || ''
    if (filename) return filename
  }
  return task.audioMeta.title || '未命名笔记'
}

const TaskQueueItem: FC<{
  task: Task
  onViewSummary: () => void
  onViewTranscript: () => void
  onDelete: () => void
  onRetry: () => void
}> = ({ task, onViewSummary, onViewTranscript, onDelete, onRetry }) => {
  const baseURL = getBaseURL()
  const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING
  const StatusIcon = config.icon
  const title = getTaskTitle(task)
  const isLocal = task.platform === 'local' || task.platform === 'local_audio'

  const thumbnailSrc = isLocal
    ? task.audioMeta.cover_url || (task.platform === 'local_audio' ? '/local-audio-cover.svg' : '/local-video-cover.svg')
    : task.audioMeta.cover_url
      ? `${baseURL}/api/image_proxy?url=${encodeURIComponent(task.audioMeta.cover_url)}`
      : '/placeholder.png'

  return (
    <div className={cn('rounded-lg border p-3 overflow-hidden', config.bgClass, config.borderClass)}>
      <div className="mb-3 flex items-start">
        {/* 缩略图 */}
        <div className="mr-2 aspect-video w-[5.5rem] shrink-0 overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
          <img
            src={thumbnailSrc}
            alt={task.audioMeta.video_id || title}
            className="size-full object-cover"
            onError={(e) => {
              e.currentTarget.src = isLocal
                ? (task.platform === 'local_audio' ? '/local-audio-cover.svg' : '/local-video-cover.svg')
                : '/placeholder.png'
            }}
          />
        </div>

        {/* 标题和状态 */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
              <StatusIcon className={cn('size-3', config.color, task.status === 'RUNNING' && 'animate-spin')} />
              <span className={cn('text-xs', config.color)}>{config.label}</span>
            </div>
          </div>
          <button
            type="button"
            className="line-clamp-2 text-left text-sm leading-tight font-medium text-gray-900 hover:underline dark:text-gray-50"
            title="打开原网页"
            onClick={onViewSummary}
          >
            {title}
          </button>
        </div>

        {/* 删除按钮 */}
        <button
          type="button"
          onClick={onDelete}
          className="ml-1 shrink-0 inline-flex items-center justify-center size-6 rounded-md text-gray-400 hover:bg-accent hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        {task.status === 'SUCCESS' && (
          <>
            <button
              type="button"
              onClick={onViewSummary}
              className="inline-flex items-center justify-center gap-1.5 h-8 flex-1 rounded-md border-0 bg-foreground text-xs text-background hover:bg-foreground/90 transition-colors font-medium"
            >
              <Sparkles className="mr-1 size-3" />
              查看总结
            </button>
            <button
              type="button"
              onClick={onViewTranscript}
              className="inline-flex items-center justify-center gap-1.5 h-8 flex-1 rounded-md bg-secondary hover:bg-secondary/80 text-xs text-gray-700 dark:text-gray-200 transition-colors font-medium"
            >
              <FileText className="mr-1 size-3" />
              查看字幕
            </button>
          </>
        )}
        {task.status === 'FAILED' && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 h-8 flex-1 rounded-md border-0 bg-foreground text-xs text-background hover:bg-foreground/90 transition-colors font-medium"
          >
            重试
          </button>
        )}
        {(() => {
          const { currentStep, stepLabel } = getStepProgress(task.status)
          const isProcessing = currentStep > 0 && task.status !== 'SUCCESS'
          if (isProcessing) {
            return (
              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{stepLabel}</span>
                  <span className="text-muted-foreground">{currentStep}/6</span>
                </div>
                <div className="flex gap-1">
                  {PROGRESS_STEPS.map((step, idx) => (
                    <div
                      key={step.key}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-all duration-300',
                        idx < currentStep
                          ? 'bg-primary'
                          : idx === currentStep - 1
                            ? 'bg-primary/70'
                            : 'bg-muted'
                      )}
                    />
                  ))}
                </div>
              </div>
            )
          }
          if (task.status === 'QUEUED' || task.status === 'PENDING') {
            return (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" />
                排队等待中...
              </div>
            )
          }
          return null
        })()}
      </div>
    </div>
  )
}

export const TaskQueuePanel: FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const tasks = useTaskStore(state => state.tasks)
  const removeTask = useTaskStore(state => state.removeTask)
  const setCurrentTask = useTaskStore(state => state.setCurrentTask)
  const retryTask = useTaskStore(state => state.retryTask)

  const stats = useMemo(() => {
    const completed = tasks.filter(t => t.status === 'SUCCESS').length
    const processing = tasks.filter(t => t.status === 'RUNNING' || t.status === 'QUEUED').length
    const failed = tasks.filter(t => t.status === 'FAILED').length
    const pending = tasks.filter(t => t.status === 'PENDING').length
    return { completed, processing, failed, pending, total: tasks.length }
  }, [tasks])

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    // 延迟添加，避免立即关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleViewSummary = (taskId: string) => {
    setIsOpen(false)
    navigate(`/notes/${taskId}`)
  }

  const handleViewTranscript = (taskId: string) => {
    setIsOpen(false)
    navigate(`/notes/${taskId}`)
  }

  const handleDelete = async (taskId: string) => {
    try {
      await removeTask(taskId)
    } catch {
      // removeTask 内部已 toast
    }
  }

  return (
    <>
      {/* 触发器徽章 */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center justify-between px-3 py-1.5 mb-3 bg-background rounded-full border border-border hover:bg-accent/50 transition-colors w-full cursor-pointer"
      >
        <span className="text-xs text-foreground">
          已完成 {stats.completed}/{stats.total}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {/* 浮动面板 */}
      {isOpen && (
        <div
          ref={panelRef}
          className="fixed top-2 right-9 z-[60] w-80 animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div className="flex flex-col rounded-xl border border-gray-200 bg-card text-card-foreground shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[calc(100vh-4rem)] overflow-hidden">
            {/* 头部 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <List className="size-4" />
                  处理队列 ({stats.total})
                </div>
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 transition-colors"
                      >
                        <MoreHorizontal className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        Promise.all(tasks.filter(t => t.status === 'SUCCESS').map(t => removeTask(t.id).catch(() => {})))
                      }}>
                        清除已完成
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        Promise.all(tasks.filter(t => t.status === 'FAILED').map(t => removeTask(t.id).catch(() => {})))
                      }}>
                        清除失败任务
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center justify-center size-7 rounded-md hover:bg-accent dark:hover:bg-accent/50 transition-colors"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              {/* 状态摘要 */}
              <div className="flex gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {stats.completed > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-green-500" />
                    {stats.completed} 完成
                  </span>
                )}
                {stats.processing > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" />
                    {stats.processing} 处理中
                  </span>
                )}
                {stats.failed > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-red-500" />
                    {stats.failed} 失败
                  </span>
                )}
                {stats.pending > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-full bg-gray-400" />
                    {stats.pending} 等待
                  </span>
                )}
              </div>
            </div>

            {/* 可滚动任务列表 */}
            <div className="px-4 pt-0 flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-[calc(100vh-16rem)]">
                <div className="flex flex-col gap-2 p-2">
                  {tasks.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      暂无任务
                    </div>
                  ) : (
                    tasks.map(task => (
                      <TaskQueueItem
                        key={task.id}
                        task={task}
                        onViewSummary={() => handleViewSummary(task.id)}
                        onViewTranscript={() => handleViewTranscript(task.id)}
                        onDelete={() => handleDelete(task.id)}
                        onRetry={() => retryTask(task.id)}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* 底部操作 */}
            <div className="mt-3 space-y-2 border-t px-4 py-3 dark:border-slate-800">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/')
                    setIsOpen(false)
                  }}
                  className="flex flex-1 items-center justify-center gap-1 h-8 rounded-md border bg-card shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 text-xs font-medium transition-colors"
                >
                  <Plus className="size-3" />
                  继续添加新内容
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
