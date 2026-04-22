import { FC, useMemo } from 'react'
import { useTaskStore } from '@/store/taskStore'

/**
 * 任务状态浮层 - 固定在页面顶部，显示执行中/排队中任务数量
 */
const TaskStatusBar: FC = () => {
  const tasks = useTaskStore(state => state.tasks)

  const stats = useMemo(() => {
    const running = tasks.filter(t => t.status !== 'SUCCESS' && t.status !== 'FAILED' && t.status !== 'QUEUED').length
    const queued = tasks.filter(t => t.status === 'QUEUED').length
    return { running, queued }
  }, [tasks])

  // 无任务时不显示
  if (stats.running === 0 && stats.queued === 0) {
    return null
  }

  return (
    <div className="fixed left-0 right-0 top-12 md:top-14 z-50 flex justify-center px-4 py-2">
      <div className="flex items-center gap-3 rounded-full bg-blue-500/90 px-4 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm">
        <span>执行中 <b>{stats.running}</b></span>
        {stats.queued > 0 && (
          <>
            <span className="text-blue-200">|</span>
            <span>排队中 <b>{stats.queued}</b></span>
          </>
        )}
      </div>
    </div>
  )
}

export default TaskStatusBar