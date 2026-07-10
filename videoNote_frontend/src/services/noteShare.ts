import request from '@/utils/request.ts'
import { getApiBaseURL } from '@/utils/api'
import { useAuthStore } from '@/store/authStore'

// ==================== 导出 ====================

// 导出指定笔记
export const exportNotes = async (taskIds: string[]) => {
  return await request.post('/notes/share/export', { task_ids: taskIds })
}

// 一键导出全部笔记
export const exportAllNotes = async () => {
  return await request.post('/notes/share/export-all')
}

// 列出已导出的分享包
export const listExports = async () => {
  return await request.get('/notes/share/exports')
}

// 拼接下载 URL（浏览器原生跳转下载，带 token query）
export const buildDownloadShareUrl = (filename: string) => {
  const token = useAuthStore.getState().token || ''
  return `${getApiBaseURL()}/notes/share/download/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}`
}

// 删除分享包
export const deleteExport = async (filename: string) => {
  return await request.delete(`/notes/share/exports/${encodeURIComponent(filename)}`)
}

// ==================== 导入 ====================

// 上传分享包并预览（返回冲突检测）
export const previewImport = async (file: File, onProgress?: (percent: number) => void) => {
  const formData = new FormData()
  formData.append('file', file)
  return await request.post('/notes/share/import/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total))
      }
    },
  })
}

// 执行导入
export const executeImport = async (filename: string, decisions: Record<string, string>) => {
  return await request.post('/notes/share/import', { filename, decisions })
}

// ==================== 类型 ====================

export interface ShareNoteMeta {
  task_id: string
  video_id: string
  platform: string
  title: string
  author: string
  author_id: string
  tags: Record<string, unknown>
  has_transcript: boolean
  has_media: boolean
}

export interface ImportPreviewResult {
  manifest: {
    version: string
    exported_at: string
    exported_by: string
    note_count: number
  }
  notes: ShareNoteMeta[]
  conflicts: {
    task_id: string
    video_id: string
    platform: string
    title: string
    existing_task_id: string
  }[]
  new_count: number
  conflict_count: number
  filename: string
}

export interface ImportResult {
  success: number
  skipped: number
  overwritten: number
  new_copy: number
  failed: number
  details: { task_id: string; status: string; target_task_id?: string }[]
}
