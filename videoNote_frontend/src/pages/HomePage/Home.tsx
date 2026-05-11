import { FC, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import HomeLayout from '@/layouts/HomeLayout.tsx'
import NoteForm from '@/pages/HomePage/components/NoteForm.tsx'
import MarkdownViewer from '@/pages/HomePage/components/MarkdownViewer.tsx'
import { useTaskStore } from '@/store/taskStore'
import History from '@/pages/HomePage/components/History.tsx'
import { TaskStatus } from '@/store/taskStore'

type ViewStatus = 'idle' | 'loading' | 'success' | 'failed'

const isInProgress = (status: TaskStatus) => {
  return status !== 'SUCCESS' && status !== 'FAILED'
}

export const HomePage: FC = () => {
  const currentTask = useTaskStore(state => {
    const task = state.tasks.find(t => t.id === state.currentTaskId)
    return task || null
  })

  const [status, setStatus] = useState<ViewStatus>('idle')

  const [searchParams] = useSearchParams()
  useEffect(() => {
    const taskId = searchParams.get('task_id')
    if (!taskId) return

    const { tasks, addPendingTask, setCurrentTask, loadTasksFromBackend } = useTaskStore.getState()
    const existingTask = tasks.find(t => t.id === taskId)
    if (existingTask) {
      setCurrentTask(taskId)
      return
    }

    loadTasksFromBackend().then(() => {
      const updatedTasks = useTaskStore.getState().tasks
      const loadedTask = updatedTasks.find(t => t.id === taskId)
      if (loadedTask) {
        setCurrentTask(taskId)
      } else {
        addPendingTask(taskId, '', {})
        setCurrentTask(taskId)
      }
    })
  }, [searchParams])

  useEffect(() => {
    if (!currentTask) {
      setStatus('idle')
    } else if (isInProgress(currentTask.status)) {
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