// Provider 相关
export interface Provider {
  id: string
  name: string
  api_key: string
  base_url: string
  logo: string
  type: string
  enabled: number
}

export interface ProviderFormData {
  name: string
  api_key: string
  base_url: string
  logo: string
  type: string
}

// Model 相关
export interface Model {
  id: string
  provider_id: string
  model_name: string
  enabled: number
}

// Task 后端响应相关
export interface BackendTaskNote {
  markdown: string
  transcript: {
    language: string
    full_text: string
    segments: Array<{ start: number; end: number; text: string }>
    raw?: Record<string, unknown>
  }
  audio_meta: {
    cover_url: string
    duration: number
    title: string
    video_id: string
    platform: string
    raw_info?: Record<string, unknown>
  }
  model_name: string
  style: string
  title?: string
  versions?: Array<{
    ver_id: string
    content: string
    style: string
    model_name: string
    created_at: string
  }>
}

export interface BackendTask {
  task_id: string
  video_id: string
  platform: string
  video_url: string | null
  created_at: string | null
  status?: string    // 任务状态：PENDING/RUNNING/SUCCESS/FAILED 等
  message?: string   // 进度提示信息
  note: BackendTaskNote | null
}

// Config backup 相关
export interface ConfigData {
  providers: Provider[]
  models: Model[]
}

export interface ImportPreviewResult {
  success: Array<{ name: string; type: string }>
  skipped: Array<{ name: string; type: string; reason: string }>
  failed: Array<{ name: string; type: string; error: string }>
}

// Downloader cookie 相关
export interface DownloaderCookie {
  cookie: string
  platform: string
}

// 工具栏配置
export interface ToolbarConfig {
  externalButtons: string[]
  menuButtons: string[]
}

export const TOOLBAR_BUTTON_LIST = [
  { id: 'mindMap', label: '思维导图' },
  { id: 'exportPdf', label: '导出 PDF' },
  { id: 'exportImage', label: '导出图文' },
  { id: 'exportSiyuan', label: '导出到思源' },
  { id: 'exportMd', label: '导出 Markdown' },
  { id: 'copy', label: '复制' },
  { id: 'source', label: '原文参照' },
  { id: 'delete', label: '删除笔记' },
] as const

export const DEFAULT_TOOLBAR_CONFIG: ToolbarConfig = {
  externalButtons: ['mindMap', 'exportPdf', 'exportImage', 'exportSiyuan', 'exportMd', 'copy', 'source', 'delete'],
  menuButtons: []
}
