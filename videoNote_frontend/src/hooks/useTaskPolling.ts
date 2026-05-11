import { useEffect, useRef, useCallback } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { get_task_status } from '@/services/note.ts'
import toast from 'react-hot-toast'

export const useTaskPolling = (interval = 3000) => {
  const tasks = useTaskStore(state => state.tasks)
  const updateTaskContent = useTaskStore(state => state.updateTaskContent)
  const loadTasksFromBackend = useTaskStore(state => state.loadTasksFromBackend)

  const tasksRef = useRef(tasks)

  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  const pollTask = useCallback(async (taskId: string) => {
    try {
      const res = await get_task_status(taskId)
      const { status } = res
      const task = tasksRef.current.find(t => t.id === taskId)

      if (status && task && status !== task.status) {
        if (status === 'SUCCESS') {
          const { markdown, transcript, audio_meta } = res.result
          toast.success('笔记生成成功')
          updateTaskContent(taskId, {
            status,
            markdown,
            transcript,
            audioMeta: audio_meta,
          })
        } else if (status === 'FAILED') {
          updateTaskContent(taskId, { status, message: res?.message })
        } else {
          updateTaskContent(taskId, { status })
        }
      }
    } catch (e: any) {
      console.error('任务轮询失败：', e)
      const message = e?.msg || ''
      updateTaskContent(taskId, { status: 'FAILED', message })
    }
  }, [updateTaskContent])

  useEffect(() => {
    const syncTimer = setInterval(async () => {
      await loadTasksFromBackend()
    }, 10000)

    return () => clearInterval(syncTimer)
  }, [loadTasksFromBackend])

  useEffect(() => {
    const pendingTasks = tasksRef.current.filter(
      task => task.status !== 'SUCCESS' && task.status !== 'FAILED'
    )

    if (pendingTasks.length > 0) {
      pendingTasks.forEach(task => pollTask(task.id))
    }

    const timer = setInterval(async () => {
      const currentPendingTasks = tasksRef.current.filter(
        task => task.status !== 'SUCCESS' && task.status !== 'FAILED'
      )

      for (const task of currentPendingTasks) {
        await pollTask(task.id)
      }
    }, interval)

    return () => clearInterval(timer)
  }, [interval, pollTask])
}