import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTaskStore, type Task } from '@/store/taskStore'
import { DetailSkeleton } from '@/components/Skeletons'
import LeftPanel from './LeftPanel'
import RightPanel from './RightPanel'
import DetailNav from './DetailNav'

export default function NoteDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const task = useTaskStore(state => state.tasks.find((t: Task) => t.id === id))
  const loadTasksFromBackend = useTaskStore(state => state.loadTasksFromBackend)
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

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const sidebarWidth = 56
      const navWidth = 64
      const newLeftWidth = e.clientX - containerRect.left - sidebarWidth
      const clamped = Math.max(400, Math.min(newLeftWidth, containerRect.width - sidebarWidth - navWidth - 300))
      setLeftWidth(clamped)
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
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
      {/* 左栏 */}
      <div className="flex flex-col border-r border-border overflow-hidden" style={{ width: leftWidth, minWidth: 400 }}>
        {/* 返回按钮 + 顶栏 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <button
            onClick={() => navigate('/notes')}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回列表
          </button>
        </div>
        <LeftPanel task={task} />
      </div>

      {/* 拖拽分割线 */}
      <div
        className="w-1.5 flex-shrink-0 cursor-col-resize bg-border/50 hover:bg-primary/30 active:bg-primary/50 transition-colors flex items-center justify-center"
        onMouseDown={onMouseDown}
      >
        <div className="w-1 h-8 rounded-full bg-muted-foreground/30" />
      </div>

      {/* 右栏 */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <RightPanel task={task} />
      </div>

      {/* 右侧导航栏 */}
      <DetailNav />
    </div>
  )
}
