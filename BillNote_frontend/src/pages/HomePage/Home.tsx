import { FC, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import HomeLayout from '@/layouts/HomeLayout.tsx'
import NoteForm from '@/pages/HomePage/components/NoteForm.tsx'
import MarkdownViewer from '@/pages/HomePage/components/MarkdownViewer.tsx'
import { useTaskStore } from '@/store/taskStore'
import History from '@/pages/HomePage/components/History.tsx'
type ViewStatus = 'idle' | 'loading' | 'success' | 'failed'
export const HomePage: FC = () => {
  // 用正确的 selector 直接获取 currentTask，避免订阅整个 tasks 数组
  const currentTask = useTaskStore(state => {
    const task = state.tasks.find(t => t.id === state.currentTaskId)
    return task || null
  })

  const [status, setStatus] = useState<ViewStatus>('idle')

  // 处理浏览器插件通过 URL 参数提交的 task_id
  const [searchParams] = useSearchParams()
  useEffect(() => {
    const taskId = searchParams.get('task_id')
    if (!taskId) return

    const { tasks, addPendingTask, setCurrentTask, loadTasksFromBackend } = useTaskStore.getState()
    // 如果任务已在列表中，直接选中
    const existingTask = tasks.find(t => t.id === taskId)
    if (existingTask) {
      setCurrentTask(taskId)
      return
    }

    // 先尝试从后端加载任务详情
    loadTasksFromBackend().then(() => {
      const updatedTasks = useTaskStore.getState().tasks
      const loadedTask = updatedTasks.find(t => t.id === taskId)
      if (loadedTask) {
        setCurrentTask(taskId)
      } else {
        // 后端还没同步到，先添加为 PENDING
        addPendingTask(taskId, '', {})
        setCurrentTask(taskId)
      }
    })
  }, [searchParams])

  useEffect(() => {
    if (!currentTask) {
      setStatus('idle')
    } else if (currentTask.status === 'PENDING') {
      setStatus('loading')
    } else if (currentTask.status === 'SUCCESS') {
      setStatus('success')
    } else if (currentTask.status === 'FAILED') {
      setStatus('failed')
    }
  }, [currentTask])

  return (
    <HomeLayout
      NoteForm={<NoteForm />}
      Preview={<MarkdownViewer status={status} />}
      History={<History />}
    />
  )
}
