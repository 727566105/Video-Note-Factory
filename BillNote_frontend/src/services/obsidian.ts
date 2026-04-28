import request from '@/utils/request.ts'

/**
 * 上传 Obsidian ZIP 文件
 */
export const uploadObsidianZip = async (file: File, importName?: string) => {
  const formData = new FormData()
  formData.append('file', file)
  if (importName) {
    formData.append('import_name', importName)
  }
  return await request.post('/obsidian/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000, // 60秒上传超时
  })
}

/**
 * SSE 获取导入进度
 * 返回 EventSource 对象，调用方自行监听
 */
export const createProgressSSE = (importId: number): EventSource => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'
  return new EventSource(`${baseURL}/obsidian/import/${importId}/progress`)
}

/**
 * 获取导入历史列表
 */
export const getImportList = async () => {
  return await request.get('/obsidian/imports')
}

/**
 * 删除导入批次
 */
export const deleteImport = async (importId: number) => {
  return await request.delete(`/obsidian/import/${importId}`)
}

/**
 * 搜索/浏览已导入笔记
 */
export const searchNotes = async (params?: {
  import_id?: number
  keyword?: string
  tag?: string
}) => {
  const query = new URLSearchParams()
  if (params?.import_id) query.append('import_id', String(params.import_id))
  if (params?.keyword) query.append('keyword', params.keyword)
  if (params?.tag) query.append('tag', params.tag)
  const qs = query.toString()
  return await request.get(`/obsidian/notes${qs ? '?' + qs : ''}`)
}

/**
 * 获取笔记详情
 */
export const getNoteDetail = async (noteId: number) => {
  return await request.get(`/obsidian/notes/${noteId}`)
}