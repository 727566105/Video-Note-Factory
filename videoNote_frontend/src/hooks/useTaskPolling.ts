import { useEffect, useRef } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { get_task_status } from '@/services/note.ts'
import { toast } from 'sonner'

export const useTaskPolling = (interval = 3000) => {
  const tasks = useTaskStore(state => state.tasks)
  const dismissTask = useTaskStore(state => state.dismissTask)
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
        task => task.status != 'SUCCESS' && task.status != 'FAILED' && task.status != 'CANCELLED' && task.status != 'UNKNOWN'
      )

      for (const task of pendingTasks) {
        try {
          // 后台轮询用 silent：已删除/非当前用户任务返回 403 时，静默移除，
          // 不再弹出误导性的"无权访问该任务" toast。
          const res = await get_task_status(task.id, true)
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
          // 403 表示任务不属于当前用户，直接移除
          if (e?.code === 403) {
            dismissTask(task.id)
            continue
          }
          const message = e?.msg || ''
          updateTaskContent(task.id, { status: 'FAILED', message })
        }
      }
    }, interval)

    return () => clearInterval(timer)
  }, [interval])
}
