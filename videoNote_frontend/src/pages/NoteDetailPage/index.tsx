import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTaskStore, type Task } from '@/store/taskStore'
import { useSystemStore } from '@/store/configStore'
import { DetailSkeleton } from '@/components/Skeletons'
import LeftPanel from './LeftPanel'
import RightPanel from './RightPanel'
import DetailNav from './DetailNav'

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
      .catch(() => {
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
        <div className="w-0.5 h-full bg-border" />
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
