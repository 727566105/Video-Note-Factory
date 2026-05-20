import { useEffect, useRef } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { get_task_status } from '@/services/note.ts'
import { toast } from 'sonner'

export const useTaskPolling = (interval = 3000) => {
  const tasks = useTaskStore(state => state.tasks)
  const updateTaskContent = useTaskStore(state => state.updateTaskContent)
  const loadTasksFromBackend = useTaskStore(state => state.loadTasksFromBackend)

  const tasksRef = useRef(tasks)
  // 使用 Set 记录已经提示过的任务 ID，避免重复提示
  const notifiedTasksRef = useRef<Set<string>>(new Set())

  // 每次 tasks 更新，把最新的 tasks 同步进去
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])

  // 定期从后端同步新任务（如从浏览器扩展提交的任务）
  useEffect(() => {
    const syncTimer = setInterval(async () => {
      await loadTasksFromBackend()
    }, 10000) // 10 秒同步一次

    return () => clearInterval(syncTimer)
  }, [loadTasksFromBackend])

  useEffect(() => {
    const timer = setInterval(async () => {
      const pendingTasks = tasksRef.current.filter(
        task => task.status != 'SUCCESS' && task.status != 'FAILED'
      )

      for (const task of pendingTasks) {
        try {
          const res = await get_task_status(task.id)
          const { status } = res

          if (status && status !== task.status) {
            if (status === 'SUCCESS') {
              const { markdown, transcript, audio_meta, smart_switched, used_model_name } = res.result
              // 只有未提示过的任务才显示成功提示
              if (!notifiedTasksRef.current.has(task.id)) {
                toast.success('笔记生成成功')
                notifiedTasksRef.current.add(task.id)
              }
              updateTaskContent(task.id, {
                status,
                markdown,
                transcript,
                audioMeta: audio_meta,
                smart_switched: smart_switched || false,
                used_model_name: used_model_name || '',
              })
            } else if (status === 'FAILED') {
              updateTaskContent(task.id, { status, message: res?.message })
            } else {
              updateTaskContent(task.id, { status })
            }
          }
        } catch (e: any) {
          const message = e?.msg || ''
          updateTaskContent(task.id, { status: 'FAILED', message })
        }
      }
    }, interval)

    return () => clearInterval(timer)
  }, [interval])
}
