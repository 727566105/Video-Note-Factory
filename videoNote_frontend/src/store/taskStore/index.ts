import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { delete_task, generateNote, getTasks } from '@/services/note.ts'
import { v4 as uuidv4 } from 'uuid'
import { toast } from 'sonner'
import type { BackendTask, TaskTags } from '@/types/api'


export type TaskStatus = 'PENDING' | 'QUEUED' | 'PARSING' | 'DOWNLOADING' | 'TRANSCRIBING' | 'SUMMARIZING' | 'FORMATTING' | 'SAVING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'

export interface AudioMeta {
  cover_url: string
  duration: number
  file_path: string
  platform: string
  raw_info: Record<string, unknown>
  title: string
  video_id: string
  author?: string  // 作者名
  description?: string  // 视频描述
  author_id?: string
  author_name?: string
}

export interface Segment {
  start: number
  end: number
  text: string
}

export interface Transcript {
  full_text: string
  language: string
  raw: Record<string, unknown>
  segments: Segment[]
}
export interface Markdown {
  ver_id: string
  content: string
  style: string
  model_name: string
  created_at: string
}

export interface Task {
  id: string
  markdown: string|Markdown [] //为了兼容之前的笔记
  transcript: Transcript
  status: TaskStatus
  audioMeta: AudioMeta
  createdAt: string
  platform: string
  content_type?: string  // "video" | "article"
  message?: string  // 错误信息，用于展示失败原因
  author_id?: string
  author_name?: string
  smart_switched?: boolean  // 智能优选是否发生过切换
  used_model_name?: string  // 实际使用的模型名称
  tags?: TaskTags  // 平台标签 + AI 标签
  formData: {
    video_url: string
    link: undefined | boolean
    screenshot: undefined | boolean
    platform: string
    quality: string
    model_name: string
    style: string
    provider_id: string
    smart_mode?: boolean
  }
}

interface TaskStore {
  tasks: Task[]
  currentTaskId: string | null
  addPendingTask: (taskId: string, platform: string, formData: Record<string, unknown>) => void
  updateTaskContent: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>) => void
  removeTask: (id: string) => Promise<void>
  clearTasks: () => void
  dismissTasks: (statuses: TaskStatus[]) => void
  setCurrentTask: (taskId: string | null) => void
  getCurrentTask: () => Task | null
  retryTask: (id: string, payload?: Record<string, unknown>) => Promise<void>
  cancelTask: (id: string) => Promise<void>
  loadTasksFromBackend: () => Promise<void>
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      currentTaskId: null,

      addPendingTask: (taskId: string, platform: string, formData: Record<string, unknown>) =>

        set(state => ({
          tasks: [
            {
              formData: formData,
              id: taskId,
              status: 'PENDING',
              markdown: '',
              platform: platform,
              transcript: {
                full_text: '',
                language: '',
                raw: null,
                segments: [],
              },
              createdAt: new Date().toISOString(),
              audioMeta: {
                cover_url: '',
                duration: 0,
                file_path: '',
                platform: '',
                raw_info: null,
                title: '',
                video_id: '',
              },
            },
            ...state.tasks,
          ],
          currentTaskId: taskId, // 默认设置为当前任务
        })),

      updateTaskContent: (id, data) =>
          set(state => ({
            tasks: state.tasks.map(task => {
              if (task.id !== id) return task

              if (task.status === 'SUCCESS' && data.status === 'SUCCESS') return task

              // 如果是 markdown 字符串，封装为版本
              if (typeof data.markdown === 'string') {
                const prev = task.markdown
                const newVersion: Markdown = {
                  ver_id: `${task.id}-${uuidv4()}`,
                  content: data.markdown,
                  style: task.formData.style || '',
                  model_name: task.formData.model_name || '',
                  created_at: new Date().toISOString(),
                }

                let updatedMarkdown: Markdown[]
                if (Array.isArray(prev)) {
                  updatedMarkdown = [newVersion, ...prev]
                } else {
                  updatedMarkdown = [
                    newVersion,
                    ...(typeof prev === 'string' && prev
                        ? [{
                          ver_id: `${task.id}-${uuidv4()}`,
                          content: prev,
                          style: task.formData.style || '',
                          model_name: task.formData.model_name || '',
                          created_at: new Date().toISOString(),
                        }]
                        : []),
                  ]
                }

                return {
                  ...task,
                  ...data,
                  markdown: updatedMarkdown,
                }
              }

              return { ...task, ...data }
            }),
          })),


      getCurrentTask: () => {
        const currentTaskId = get().currentTaskId
        return get().tasks.find(task => task.id === currentTaskId) || null
      },
      retryTask: async (id: string, payload?: Record<string, unknown>) => {

        if (!id){
          toast.error('任务不存在')
          return
        }
        const task = get().tasks.find(task => task.id === id)
        if (!task) {
          toast.error('任务不存在，请返回列表重试')
          return
        }

        // 防抖：如果任务正在生成中，拒绝重复提交
        const activeStatuses = ['PENDING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'QUEUED']
        if (activeStatuses.includes(task.status)) {
          toast.warning('任务正在处理中，请稍候')
          return
        }

        // 合并 payload > task.formData，再用 task 已有字段兜底缺失的必填参数
        // 解决从后端加载的任务 formData 不完整（video_url/platform/quality 缺失）导致 422
        const baseFormData = payload || task.formData || {}
        const newFormData = {
          video_url: baseFormData.video_url || task.audioMeta?.file_path || '',
          platform: baseFormData.platform || task.platform || '',
          quality: baseFormData.quality || 'medium',
          ...baseFormData, // payload 里的字段优先（model_name/provider_id 等）
          task_id: id,
        }

        // 最终检查必填字段
        if (!newFormData.video_url || !newFormData.platform) {
          toast.error('无法获取原始视频信息，请从首页重新提交链接')
          return
        }

        await generateNote(newFormData)

        set(state => ({
          tasks: state.tasks.map(t =>
              t.id === id
                  ? {
                    ...t,
                    formData: newFormData, // ✅ 显式更新 formData
                    status: 'PENDING',
                  }
                  : t
          ),
        }))
      },


      removeTask: async id => {
        const task = get().tasks.find(t => t.id === id)
        if (!task) return

        try {
          // 先调用后端 API，确保后端删除成功
          await delete_task({
            task_id: task.id,
            video_id: task.audioMeta.video_id,
            platform: task.platform,
          })

          // API 成功后再更新本地状态
          set(state => ({
            tasks: state.tasks.filter(task => task.id !== id),
            currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
          }))
        } catch (e) {
          toast.error('删除失败')
          throw e
        }
      },
      cancelTask: async (id: string) => {
        if (!id) {
          toast.error('任务不存在')
          return
        }
        try {
          const { default: request } = await import('@/utils/request')
          await request.post('/cancel_task', { task_id: id })
          set(state => ({
            tasks: state.tasks.map(t =>
              t.id === id ? { ...t, status: 'CANCELLED' as TaskStatus, message: '任务已取消' } : t
            ),
          }))
          toast.success('任务已取消')
        } catch {
          toast.error('取消任务失败')
        }
      },

clearTasks: () => set({ tasks: [], currentTaskId: null }),

      dismissTasks: (statuses) => set(state => ({
        tasks: state.tasks.filter(t => !statuses.includes(t.status)),
      })),

      // 只从本地队列移除单个任务，不调用后端 API（用于 TaskQueuePanel X 按钮）
      dismissTask: (id) => set(state => ({
        tasks: state.tasks.filter(t => t.id !== id),
        currentTaskId: state.currentTaskId === id ? null : state.currentTaskId,
      })),

      setCurrentTask: taskId => set({ currentTaskId: taskId }),

      loadTasksFromBackend: async () => {
        try {
          const response = await getTasks(100)
          if (response?.tasks) {
            // 保留本地正在进行的任务（避免被后端数据覆盖）
            const localPendingTasks = get().tasks.filter(
              t => t.status !== 'SUCCESS' && t.status !== 'FAILED'
            )

            const backendTasks = response.tasks.map((t: BackendTask) => {
              // 使用后端返回的 status，如果没有则根据 note 是否存在判断
              const taskStatus = (t.status || (t.note ? 'SUCCESS' : 'PENDING')) as TaskStatus

              // 处理 markdown 数据
              let markdownValue: string | Markdown[] = ''
              if (t.note) {
                // 优先使用 versions 数组，否则使用 markdown 字符串（兼容旧数据）
                markdownValue = t.note.versions && t.note.versions.length > 0
                  ? t.note.versions
                  : (t.note.markdown || '')
              }

              return {
                id: t.task_id,
                status: taskStatus,
                message: t.message || '',
                markdown: markdownValue,
                transcript: t.note?.transcript || {
                  full_text: '',
                  language: '',
                  raw: null,
                  segments: [],
                },
                createdAt: t.created_at || new Date().toISOString(),
                smart_switched: t.note?.smart_switched || false,
                used_model_name: t.note?.used_model_name || '',
                // 优先使用数据库元数据字段，兜底从 note.audio_meta 读取
                audioMeta: {
                  cover_url: t.cover_url || t.note?.audio_meta?.cover_url || '',
                  duration: t.duration || t.note?.audio_meta?.duration || 0,
                  file_path: t.note?.audio_meta?.file_path || '',
                  platform: t.platform,
                  raw_info: t.note?.audio_meta?.raw_info || null,
                  title: t.title || t.note?.audio_meta?.title || t.note?.title || '',
                  video_id: t.video_id,
                  author: t.author || t.author_name || t.note?.audio_meta?.raw_info?.owner?.name || '',
                  description: t.description || t.note?.audio_meta?.description || '',
                  author_id: t.author_id || '',
                  author_name: t.author_name || '',
                },
                platform: t.platform,
                content_type: t.content_type || (t.note as Record<string, unknown>)?.content_type as string || 'video',
                author_id: t.author_id || '',
                author_name: t.author_name || '',
                formData: {
                  video_url: t.video_url || '',
                  link: false,
                  screenshot: false,
                  platform: t.platform,
                  quality: 'medium',
                  model_name: t.note?.model_name || '',
                  style: t.note?.style || '',
                  provider_id: '',
                },
                tags: t.tags ? (() => {
                  try {
                    return JSON.parse(t.tags) as TaskTags
                  } catch {
                    return undefined
                  }
                })() : undefined,
              }
            })

            // 合并策略：后端状态权威，本地活跃任务（PROCESSING/QUEUED）保留更实时的数据
            // 注意：本地 FAILED/PENDING 可能是过时缓存，不能覆盖后端的最新状态
            const localTaskMap = new Map(get().tasks.map(t => [t.id, t]))
            const mergedMap = new Map<string, Task>()

            // 先添加所有后端任务
            for (const bt of backendTasks) {
              mergedMap.set(bt.id, bt)
            }

            // 合并本地任务
            for (const [id, lt] of localTaskMap) {
              const bt = mergedMap.get(id)
              if (bt) {
                // 后端有此任务：
                // - 本地是活跃状态（PROCESSING/QUEUED/PENDING）且后端也是活跃态 -> 保留本地（轮询更实时）
                // - 其他情况 -> 用后端（权威，避免本地过时 FAILED/PENDING 覆盖最新状态）
                const localActive = ['PROCESSING', 'QUEUED', 'PENDING', 'PARSING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'FORMATTING', 'SAVING'].includes(lt.status)
                const backendActive = ['PROCESSING', 'QUEUED', 'PENDING', 'PARSING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'FORMATTING', 'SAVING'].includes(bt.status)
                if (localActive && backendActive) {
                  // 两者都是活跃态，保留本地（更实时的轮询进度）
                  mergedMap.set(id, lt)
                }
                // 否则用后端（已在 mergedMap 里，不覆盖）
              } else {
                // 后端没有（刚创建的本地任务），保留本地
                mergedMap.set(id, lt)
              }
            }

            const mergedTasks = Array.from(mergedMap.values())

            // 按 createdAt 排序（最新的在前）
            mergedTasks.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )

            set({ tasks: mergedTasks })
          }
        } catch (e) {
        }
      },
    }),
    {
      name: 'task-storage',
      // 只持久化必要元数据，不存储 markdown/transcript/formData 大数据
      partialize: (state) => ({
        currentTaskId: state.currentTaskId,
        tasks: state.tasks.map(task => ({
          id: task.id,
          status: task.status,
          createdAt: task.createdAt,
          platform: task.platform,
          content_type: task.content_type,
          audioMeta: {
            video_id: task.audioMeta.video_id,
            title: task.audioMeta.title,
            cover_url: task.audioMeta.cover_url,
            author: task.audioMeta.author,
            duration: task.audioMeta.duration,
          },
          author_id: task.author_id,
          author_name: task.author_name,
          tags: task.tags,
        })),
      }),
    }
  )
)
