import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { toast } from 'sonner'
import {
  fetchSubscriptions as apiFetchSubscriptions,
  subscribe as apiSubscribe,
  unsubscribe as apiUnsubscribe,
  toggleSubscription as apiToggle,
  refreshFeed as apiRefreshFeed,
  fetchFeed as apiFetchFeed,
  markFeedRead as apiMarkRead,
  markAllFeedRead as apiMarkAllRead,
  fetchUnreadCount as apiFetchUnreadCount,
  type Subscription,
  type FeedItem,
} from '@/services/subscription'

interface SubscriptionStore {
  subscriptions: Subscription[]
  feedItems: FeedItem[]
  unreadCount: number
  loading: boolean

  fetchSubscriptions: () => Promise<void>
  subscribe: (url: string) => Promise<boolean>
  unsubscribe: (id: number) => Promise<void>
  toggleSubscription: (id: number) => Promise<void>
  fetchFeed: (limit?: number, offset?: number, type?: string, order?: 'desc' | 'asc') => Promise<void>
  markRead: (id: number) => Promise<void>
  markAllRead: () => Promise<void>
  refreshFeed: () => Promise<void>
  fetchUnreadCount: () => Promise<void>
}

export const useSubscriptionStore = create<SubscriptionStore>()(
  devtools((set, get) => ({
    subscriptions: [],
    feedItems: [],
    unreadCount: 0,
    loading: false,

    fetchSubscriptions: async () => {
      try {
        const subs = await apiFetchSubscriptions()
        set({ subscriptions: subs || [] })
      } catch { }
    },

    subscribe: async (url: string) => {
      try {
        const res = await apiSubscribe(url) as any
        const status = res?.fetch_status
        const count = res?.items_count || 0
        const statsHint = res?.stats_hint

        if (status === 'failed') {
          toast.error(res?.warning || '订阅成功但获取内容失败，请稍后刷新重试')
        } else if (status === 'empty') {
          toast.success('订阅成功，该博主暂无可获取的内容')
        } else {
          toast.success(`订阅成功，获取了 ${count} 条动态`)
        }

        // 显示频道统计提示
        if (statsHint && (statsHint.subscriber_count > 1 || statsHint.note_count > 0)) {
          toast.success(
            `该频道已有 ${statsHint.subscriber_count} 位用户订阅，共 ${statsHint.video_count} 个视频，其中 ${statsHint.note_count} 个视频已有现成笔记可直接使用！`,
            { duration: 6000 }
          )
        }

        get().fetchSubscriptions()
        get().fetchFeed()
        get().fetchUnreadCount()
        return true
      } catch (e: any) {
        toast.error(e?.response?.data?.detail || e?.message || '订阅失败')
        return false
      }
    },

    unsubscribe: async (id: number) => {
      try {
        await apiUnsubscribe(id)
        toast.success('已取消订阅')
        get().fetchSubscriptions()
      } catch {
        toast.error('取消订阅失败')
      }
    },

    toggleSubscription: async (id: number) => {
      try {
        await apiToggle(id)
        get().fetchSubscriptions()
      } catch { }
    },

    fetchFeed: async (limit = 20, offset = 0, type?: string, order?: 'desc' | 'asc') => {
      set({ loading: true })
      try {
        const items = await apiFetchFeed(limit, offset, type, order)
        set({ feedItems: items || [] })
      } catch { } finally {
        set({ loading: false })
      }
    },

    markRead: async (id: number) => {
      try {
        await apiMarkRead(id)
        set(state => ({
          feedItems: state.feedItems.map(f => f.id === id ? { ...f, is_read: 1 } : f),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }))
      } catch { }
    },

    markAllRead: async () => {
      try {
        await apiMarkAllRead()
        set(state => ({
          feedItems: state.feedItems.map(f => ({ ...f, is_read: 1 })),
          unreadCount: 0,
        }))
      } catch { }
    },

    refreshFeed: async () => {
      try {
        const res = await apiRefreshFeed() as any
        const added = res?.added || 0
        const error = res?.error
        if (error) {
          toast.error(`刷新失败: ${error}`)
        } else if (added > 0) {
          toast.success(`刷新完成，新增 ${added} 条`)
        } else {
          toast.success('刷新完成，暂无新内容')
        }
        get().fetchFeed()
        get().fetchUnreadCount()
      } catch {
        toast.error('刷新失败')
      }
    },

    fetchUnreadCount: async () => {
      try {
        const res = await apiFetchUnreadCount()
        set({ unreadCount: (res as any)?.count || 0 })
      } catch { }
    },
  }))
)