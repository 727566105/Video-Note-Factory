import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTaskStore, type Task } from '@/store/taskStore'
import { useSystemStore } from '@/store/configStore'
import { DetailSkeleton } from '@/components/Skeletons'
import LeftPanel from './LeftPanel'
import RightPanel from './RightPanel'
import DetailNav from './DetailNav'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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

const isProcessingStatus = (status: string): boolean => {
  return ['PARSING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'FORMATTING', 'SAVING'].includes(status)
}

function ProcessingView({ status }: { status: string }) {
  const { currentStep, stepLabel } = getStepProgress(status)
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div className="text-lg font-medium text-foreground">{stepLabel}</div>
        <div className="text-sm text-muted-foreground">{currentStep}/6 步骤</div>
      </div>
      <div className="w-[400px] flex gap-1">
        {PROGRESS_STEPS.map((step, idx) => (
          <div
            key={step.key}
            className={cn(
              'h-2 flex-1 rounded-full transition-all duration-300',
              idx < currentStep ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
      <div className="text-xs text-muted-foreground">刷新页面后进度条仍会实时展示</div>
    </div>
  )
}

function QueuedView() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="size-8 animate-spin text-amber-500" />
      <div className="text-lg font-medium text-foreground">排队等待中...</div>
      <div className="text-sm text-muted-foreground">任务正在排队，请稍候</div>
    </div>
  )
}

function FailedView({ message }: { message?: string }) {
  const navigate = useNavigate()
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <div className="text-lg font-medium text-red-500">生成失败</div>
      {message && <div className="text-sm text-muted-foreground">{message}</div>}
      <button
        onClick={() => navigate('/notes')}
        className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
      >
        返回列表
      </button>
    </div>
  )
}

// 用 memo 包裹子组件，防止拖拽时重新渲染
const MemoLeftPanel = memo(LeftPanel)
const MemoRightPanel = memo(RightPanel)
const MemoDetailNav = memo(DetailNav)

export default function NoteDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const task = useTaskStore(state => state.tasks.find((t: Task) => t.id === id))
  const loadTasksFromBackend = useTaskStore(state => state.loadTasksFromBackend)
  const panelSwapped = useSystemStore(state => state.panelSwapped)
  const [loading, setLoading] = useState(!task)
  const [notFound, setNotFound] = useState(false)

  // 拖拽分割线
  const [leftWidth, setLeftWidth] = useState(592)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // 从后端加载（如果 store 中没有）
  useEffect(() => {
    if (task) {
      setLoading(false)
      return
    }
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setLoading(true)
    loadTasksFromBackend()
      .then(() => {
        // loadTasksFromBackend 会更新 store，task selector 会自动重新计算
        // 但这里我们无法直接读取更新后的 task，所以用 store.getState()
        const found = useTaskStore.getState().tasks.find((t: Task) => t.id === id)
        if (!found) {
          setNotFound(true)
        }
        setLoading(false)
      })
      .catch((e) => {
        console.error('从后端加载任务失败:', e)
        setNotFound(true)
        setLoading(false)
      })
  }, [id, task, loadTasksFromBackend])

  const onMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    let rafId: number | null = null
    let pendingWidth: number | null = null

    const updateWidth = () => {
      if (pendingWidth !== null) {
        setLeftWidth(pendingWidth)
        pendingWidth = null
      }
      rafId = null
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const sidebarWidth = 56
      const navWidth = 64
      const newLeftWidth = e.clientX - containerRect.left - sidebarWidth
      const clamped = Math.max(400, Math.min(newLeftWidth, containerRect.width - sidebarWidth - navWidth - 300))

      pendingWidth = clamped
      if (!rafId) {
        rafId = requestAnimationFrame(updateWidth)
      }
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (pendingWidth !== null) {
        setLeftWidth(pendingWidth)
        pendingWidth = null
      }
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  if (loading) {
    return <DetailSkeleton />
  }

  if (!task || notFound) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">笔记未找到</p>
          <button
            onClick={() => navigate('/notes')}
            className="mt-4 text-sm text-primary hover:underline"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  // 任务进行中时显示进度条
  if (isProcessingStatus(task.status)) {
    return <ProcessingView status={task.status} />
  }

  // 任务排队中时显示排队提示
  if (task.status === 'QUEUED' || task.status === 'PENDING') {
    return <QueuedView />
  }

  // 任务失败时显示失败提示
  if (task.status === 'FAILED') {
    return <FailedView message={task.message} />
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background" ref={containerRef}>
      {/* 左栏（根据 panelSwapped 决定是视频还是笔记） */}
      <div className="flex flex-col overflow-hidden" style={{ width: leftWidth, minWidth: 400 }}>
        {/* 面板内容（带切换动画） */}
        <div
          key={`left-${panelSwapped}`}
          className="flex-1 min-h-0 animate-in fade-in slide-in-from-right-4 duration-300"
        >
          {panelSwapped ? <MemoRightPanel task={task} /> : <MemoLeftPanel task={task} />}
        </div>
      </div>

      {/* 拖拽分割线 */}
      <div
        className="w-4 shrink-0 cursor-col-resize flex flex-col items-center justify-center h-full relative group"
        onMouseDown={onMouseDown}
      >
        {/* 分割线条 */}
        <div className="h-full bg-border" style={{ width: '0.5px' }} />
        {/* 拖拽手柄 */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-3 h-12 rounded-md bg-background shadow-sm flex flex-col items-center justify-center gap-1">
          <div className="w-1.5 h-[1.5px] rounded-full bg-muted-foreground" />
          <div className="w-1.5 h-[1.5px] rounded-full bg-muted-foreground" />
          <div className="w-1.5 h-[1.5px] rounded-full bg-muted-foreground" />
        </div>
      </div>

      {/* 右栏（根据 panelSwapped 决定是笔记还是视频） */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* 面板内容（带切换动画） */}
        <div
          key={`right-${panelSwapped}`}
          className="h-full animate-in fade-in slide-in-from-left-4 duration-300"
        >
          {panelSwapped ? <MemoLeftPanel task={task} /> : <MemoRightPanel task={task} />}
        </div>
      </div>

      {/* 右侧导航栏 */}
      <MemoDetailNav />
    </div>
  )
}
