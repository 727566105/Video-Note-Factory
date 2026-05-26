import request from '@/utils/request'

export const generateNote = async (data: {
  video_url: string
  platform: string
  quality: string
  model_name: string
  provider_id: string
  task_id?: string
  format: Array<string>
  style: string
  extras?: string
  video_understanding?: boolean
  video_interval?: number
  grid_size: Array<number>
  screenshot?: boolean
  link?: boolean
  output_language?: string
}) => {
  try {
    const response = await request.post('/generate_note', data)

    // axios 拦截器已经返回了 response.data
    if (response && response.task_id) {
      return response
    }
    
    return null
  } catch (e: any) {
    // request.ts 拦截器已显示错误 toast，此处仅抛出错误
    throw e
  }
}

export const delete_task = async ({ task_id, video_id, platform }: { task_id?: string; video_id?: string; platform?: string }) => {
  const data = { task_id, video_id, platform }
  const res = await request.post('/delete_task', data)
  return res
}

export const get_task_status = async (task_id: string) => {
  try {
    // 成功提示

    return await request.get('/task_status/' + task_id)
  } catch (e) {
    throw e // 抛出错误以便调用方处理
  }
}

export const getTasks = async (limit: number = 100) => {
  try {
    return await request.get('/tasks?limit=' + limit)
  } catch (e) {
    throw e
  }
}

export const getQueueStatus = async () => {
  try {
    return await request.get('/task_queue/status', { headers: { 'X-Silent': 'true' } })
  } catch {
    return null
  }
}

export const updateQueueConfig = async (maxConcurrent: number) => {
  try {
    return await request.post('/task_queue/config', { max_concurrent: maxConcurrent })
  } catch (e) {
    throw e
  }
}

export const updateNoteTags = async (taskId: string, payload: { platform_tags: string[]; ai_tags: string[]; manual_tags: string[] }) => {
  return request.put(`/notes/${taskId}/tags`, payload)
}
