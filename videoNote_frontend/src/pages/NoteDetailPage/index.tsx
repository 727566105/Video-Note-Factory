import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTaskStore, type Task } from '@/store/taskStore'
import { useSystemStore } from '@/store/configStore'
import { DetailSkeleton } from '@/components/Skeletons'
import LeftPanel from './LeftPanel'
import RightPanel, { type LocalSettings } from './RightPanel'
import DetailNav from './DetailNav'
import { Loader2, ArrowLeft, Video, FileText } from 'lucide-react'
import { isProcessingStatus, hasMarkdownContent, ProcessingSpinner } from './processing'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'

function ProcessingView({ status }: { status: string }) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background">
      <ProcessingSpinner status={status} />
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

function FailedView({ message, taskId }: { message?: string; taskId: string }) {
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await useTaskStore.getState().retryTask(taskId)
    } catch {
      // retryTask 内部已 toast
      setRetrying(false)
    }
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
      <div className="text-lg font-medium text-red-500">生成失败</div>
      {message && <div className="text-sm text-muted-foreground">{message}</div>}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              重新生成中
            </>
          ) : (
            '重新生成'
          )}
        </button>
        <button
          onClick={() => navigate('/notes')}
          className="px-4 py-2 border rounded-md hover:bg-accent"
        >
          返回列表
        </button>
      </div>
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
  const isMobile = useIsMobile()

  // 拖拽分割线
  const [leftWidth, setLeftWidth] = useState(592)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // 局部设置（隔离全局 store，仅影响当前笔记的重新生成）
  const [localSettings, setLocalSettings] = useState<LocalSettings>({
    style: task?.formData?.style || 'minimal',
    outputLanguage: task?.formData?.output_language || 'zh',
    modelName: task?.formData?.model_name || '',
    providerId: task?.formData?.provider_id || '',
    videoUnderstanding: task?.formData?.video_understanding ?? false,
    videoInterval: task?.formData?.video_interval || 4,
    gridCols: task?.formData?.grid_size?.[0] || 3,
    gridRows: task?.formData?.grid_size?.[1] || 3,
    selectedFormats: task?.formData?.format || [],
    extras: task?.formData?.extras || '',
  })

  // taskId 变化时重新初始化局部设置
  useEffect(() => {
    if (task) {
      setLocalSettings({
        style: task.formData?.style || 'minimal',
        outputLanguage: task.formData?.output_language || 'zh',
        modelName: task.formData?.model_name || '',
        providerId: task.formData?.provider_id || '',
        videoUnderstanding: task.formData?.video_understanding ?? false,
        videoInterval: task.formData?.video_interval || 4,
        gridCols: task.formData?.grid_size?.[0] || 3,
        gridRows: task.formData?.grid_size?.[1] || 3,
        selectedFormats: task.formData?.format || [],
        extras: task.formData?.extras || '',
      })
    }
  }, [task?.id])

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

  // 任务进行中时：有已有内容则局部加载，无内容则全屏加载
  const processing = isProcessingStatus(task.status)
  const hasContent = hasMarkdownContent(task.markdown)
  if (processing && !hasContent) {
    return <ProcessingView status={task.status} />
  }

  // 排队中：有已有内容也局部显示
  const queued = task.status === 'QUEUED' || task.status === 'PENDING'

  // 任务失败时显示失败提示
  if (task.status === 'FAILED') {
    return <FailedView message={task.message} taskId={task.id} />
  }

  // 移动端：单面板布局 + 底部切换按钮
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* 顶部信息栏 */}
        <div className="shrink-0 h-14 border-b flex items-center px-4 gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/notes')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="truncate font-medium text-sm flex-1">{task.title || '笔记详情'}</span>
        </div>

        {/* 当前显示的面板 */}
        <div className="flex-1 overflow-hidden">
          <div
            key={`mobile-${panelSwapped}`}
            className="h-full animate-in fade-in slide-in-from-right-4 duration-300"
          >
            {panelSwapped ? (
              <MemoRightPanel
                task={task}
                isProcessing={processing || queued}
                processingStatus={task.status}
                localSettings={localSettings}
              />
            ) : (
              <MemoLeftPanel
                task={task}
                localSettings={localSettings}
                onSettingsChange={setLocalSettings}
              />
            )}
          </div>
        </div>

        {/* 底部切换按钮组 */}
        <div className="shrink-0 h-14 border-t flex items-center justify-center gap-2 px-4">
          <Button
            variant={!panelSwapped ? "default" : "outline"}
            size="sm"
            onClick={() => useSystemStore.getState().setPanelSwapped(false)}
          >
            <Video className="w-4 h-4 mr-1" />视频信息
          </Button>
          <Button
            variant={panelSwapped ? "default" : "outline"}
            size="sm"
            onClick={() => useSystemStore.getState().setPanelSwapped(true)}
          >
            <FileText className="w-4 h-4 mr-1" />笔记内容
          </Button>
        </div>
      </div>
    )
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
          {panelSwapped ? (
            <MemoRightPanel
              task={task}
              isProcessing={processing || queued}
              processingStatus={task.status}
              localSettings={localSettings}
            />
          ) : (
            <MemoLeftPanel
              task={task}
              localSettings={localSettings}
              onSettingsChange={setLocalSettings}
            />
          )}
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
          {panelSwapped ? (
            <MemoLeftPanel
              task={task}
              localSettings={localSettings}
              onSettingsChange={setLocalSettings}
            />
          ) : (
            <MemoRightPanel
              task={task}
              isProcessing={processing || queued}
              processingStatus={task.status}
              localSettings={localSettings}
            />
          )}
        </div>
      </div>

      {/* 右侧导航栏 */}
      <MemoDetailNav />
    </div>
  )
}
