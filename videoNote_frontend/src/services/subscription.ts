import request from '@/utils/request'

export interface Subscription {
  id: number
  channel_url: string
  channel_name: string
  platform: string
  platform_id: string
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
  request.post<{ added: number }>(`/subscriptions/${id}/refresh`)

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

export const fetchChannelVideos = (platform: string, platformId: string, limit: number = 20) =>
  request.get<FeedItem[]>(`/channels/${platform}/${platformId}/videos`, { params: { limit } })

export const generateArticleNote = (itemId: number) =>
  request.post<{ markdown: string }>(`/feed/${itemId}/generate-note`)