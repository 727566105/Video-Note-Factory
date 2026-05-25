import request from '@/utils/request'

export interface Subscription {
  id: number
  channel_url: string
  channel_name: string
  platform: string
  platform_id: string
  unique_id?: string
  avatar_url: string
  enabled: number
  fetch_interval: number
  last_checked_at: string | null
  created_at: string | null
}

export interface FeedItem {
  id: number
  subscription_id: number
  platform: string
  content_type: 'video' | 'article'
  content_id: string
  content_url: string
  title: string
  cover_url: string
  images: string | null
  duration: number | null
  author: string
  description: string
  published_at: string | null
  is_read: number
  task_id: string | null
  note_available?: boolean
  available_task_id?: string | null
}

export interface ChannelInfo {
  platform: string
  platform_id: string
  channel_url: string
  channel_name: string
  avatar_url: string
}

export const fetchSubscriptions = () =>
  request.get<Subscription[]>('/subscriptions')

export const subscribe = (url: string) =>
  request.post<{ id: number; channel_name: string; platform: string }>('/subscriptions', { url })

export const unsubscribe = (id: number) =>
  request.delete(`/subscriptions/${id}`)

export const toggleSubscription = (id: number) =>
  request.put(`/subscriptions/${id}/toggle`)

export const refreshSubscription = (id: number) =>
  request.post<{ progress_id: string; status: string }>(`/subscriptions/${id}/refresh`)

export const fetchRefreshProgress = (progressId: string) =>
  request.get<{
    progress_id: string
    subscription_id: number
    status: 'running' | 'completed' | 'failed'
    current_page: number
    total_pages: number
    fetched_count: number
    added_count: number
    total_count: number
    error: string | null
  }>(`/subscriptions/progress/${progressId}`)

export const fetchFeed = (limit: number = 20, offset: number = 0, type?: string) =>
  request.get<FeedItem[]>('/feed', { params: { limit, offset, type } })

export const markFeedRead = (id: number) =>
  request.put(`/feed/${id}/read`)

export const markAllFeedRead = () =>
  request.put('/feed/read-all')

export const refreshFeed = () =>
  request.post<{ added: number }>('/feed/refresh')

export const fetchUnreadCount = () =>
  request.get<{ count: number }>('/feed/unread-count')

export const fetchSummarizedChannels = () =>
  request.get<{ platform: string; author: string; video_url: string; count: number; last_summarized: string | null }[]>('/channels/summarized')

export const parseChannelUrl = (url: string) =>
  request.post<ChannelInfo>('/channels/parse-url', { url })

export const fetchChannelVideos = (platform: string, platformId: string, limit: number = 20, offset: number = 0) =>
  request.get<{ items: FeedItem[]; total: number }>(`/channels/${platform}/${platformId}/videos`, { params: { limit, offset } })

export const generateArticleNote = (itemId: number) =>
  request.post<{ markdown: string }>(`/feed/${itemId}/generate-note`)

export interface NoteAvailability {
  available: boolean
  task_id?: string
  can_view?: boolean
  title?: string
  author?: string
}

export const checkNoteAvailability = (videoUrl: string, platform: string) =>
  request.post<NoteAvailability>('/check_note_availability', { video_url: videoUrl, platform })

export interface QuickViewNote {
  task_id: string
  title: string | null
  author: string | null
  markdown: string
  model_name: string
}

export const quickViewNote = (taskId: string) =>
  request.get<QuickViewNote>(`/quick_view/${taskId}`)

export interface ChannelSubscribers {
  subscribers: { user_id: number; username: string }[]
  total: number
}

export const fetchChannelSubscribers = (platform: string, platformId: string) =>
  request.get<ChannelSubscribers>(`/channels/${platform}/${platformId}/subscribers`)

// ---- 分批获取相关 API ----

/** 分批获取状态 */
export interface FetchStatus {
  fetched: number
  total: number
  status: 'initial' | 'partial' | 'complete' | 'error'
  has_more: boolean
}

/** 查询频道分批获取状态 */
export const getFetchStatus = (platform: string, platformId: string) =>
  request.get<FetchStatus>(`/channels/${platform}/${platformId}/fetch-status`)

/** 触发加载更多返回 */
export interface FetchMoreResult {
  queued: boolean
  complete?: boolean
  fetched: number
  total: number
  message: string
}

/** 触发加载更多视频 */
export const fetchMoreVideos = (platform: string, platformId: string) =>
  request.post<FetchMoreResult>(`/channels/${platform}/${platformId}/fetch-more`)