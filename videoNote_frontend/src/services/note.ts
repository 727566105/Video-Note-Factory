import request from '@/utils/request'
import toast from 'react-hot-toast'

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
    
    // 显示后端返回的错误信息
    if (e.msg) {
      toast.error(e.msg)
    } else {
      toast.error('笔记生成失败，请稍后重试')
    }

    throw e // 抛出错误以便调用方处理
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
