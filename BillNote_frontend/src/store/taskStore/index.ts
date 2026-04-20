import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { delete_task, generateNote, getTasks } from '@/services/note.ts'
import { v4 as uuidv4 } from 'uuid'
import toast from 'react-hot-toast'


export type TaskStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILD'

export interface AudioMeta {
  cover_url: string
  duration: number
  file_path: string
  platform: string
  raw_info: any
  title: string
  video_id: string
}

export interface Segment {
  start: number
  end: number
  text: string
}

export interface Transcript {
  full_text: string
  language: string
  raw: any
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
  formData: {
    video_url: string
    link: undefined | boolean
    screenshot: undefined | boolean
    platform: string
    quality: string
    model_name: string
    style: string
    provider_id: string
  }
}

interface TaskStore {
  tasks: Task[]
  currentTaskId: string | null
  addPendingTask: (taskId: string, platform: string) => void
  updateTaskContent: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>) => void
  removeTask: (id: string) => void
  clearTasks: () => void
  setCurrentTask: (taskId: string | null) => void
  getCurrentTask: () => Task | null
  retryTask: (id: string) => void
  loadTasksFromBackend: () => Promise<void>
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      currentTaskId: null,

      addPendingTask: (taskId: string, platform: string, formData: any) =>

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
      retryTask: async (id: string, payload?: any) => {

        if (!id){
          toast.error('任务不存在')
          return
        }
        const task = get().tasks.find(task => task.id === id)
        console.log('retry',task)
        if (!task) return

        const newFormData = payload || task.formData
        await generateNote({
          ...newFormData,
          task_id: id,
        })

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

      clearTasks: () => set({ tasks: [], currentTaskId: null }),

      setCurrentTask: taskId => set({ currentTaskId: taskId }),

      loadTasksFromBackend: async () => {
        try {
          const response = await getTasks(100)
          if (response?.tasks) {
            const backendTasks = response.tasks
              .filter((t: any) => t.note !== null) // 只加载有笔记内容的任务
              .map((t: any) => {
                // 优先使用 versions 数组，否则使用 markdown 字符串（兼容旧数据）
                const markdownValue = t.note.versions && t.note.versions.length > 0
                  ? t.note.versions
                  : (t.note.markdown || '')

                return {
                  id: t.task_id,
                  status: 'SUCCESS' as TaskStatus,
                  markdown: markdownValue,
                  transcript: t.note.transcript || {
                    full_text: '',
                    language: '',
                    raw: null,
                    segments: [],
                  },
                  createdAt: t.created_at || new Date().toISOString(),
                  audioMeta: t.note.audio_meta || {
                    cover_url: '',
                    duration: 0,
                    file_path: '',
                    platform: t.platform,
                    raw_info: null,
                    title: t.note.title || '',
                    video_id: t.video_id,
                  },
                  platform: t.platform,
                  formData: {
                    video_url: t.video_url || '',
                    link: false,
                    screenshot: false,
                    platform: t.platform,
                    quality: 'high',
                    model_name: t.note.model_name || '',
                    style: t.note.style || '',
                    provider_id: '',
                  },
                }
              })

            // 以后端数据为准，不保留本地独有的旧任务
            // 这样删除后刷新就不会再出现了
            set({ tasks: backendTasks })
          }
        } catch (e) {
          console.error('加载历史任务失败:', e)
        }
      },
    }),
    {
      name: 'task-storage',
    }
  )
)
