import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { toast } from 'sonner'
import {
  getCollections as apiGetCollections,
  createCollection as apiCreate,
  updateCollection as apiUpdate,
  deleteCollection as apiDelete,
  getCollectionDetail as apiGetDetail,
  addItemsToCollection as apiAddItems,
  removeItemFromCollection as apiRemoveItem,
  generateCollectionSummary as apiGenSummary,
  type CollectionInfo,
  type CollectionDetail,
  type CollectionSummary,
} from '@/services/collection'

interface CollectionStore {
  collections: CollectionInfo[]
  currentDetail: CollectionDetail | null
  loading: boolean
  generating: boolean

  fetchCollections: () => Promise<void>
  createCollection: (name: string, description?: string, category?: string, taskIds?: string[]) => Promise<CollectionInfo | null>
  updateCollection: (id: string, params: Parameters<typeof apiUpdate>[1]) => Promise<void>
  deleteCollection: (id: string) => Promise<void>
  fetchDetail: (id: string) => Promise<void>
  addItems: (collectionId: string, taskIds: string[]) => Promise<number>
  removeItem: (collectionId: string, taskId: string) => Promise<void>
  generateSummary: (collectionId: string, style?: string, modelName?: string, providerId?: string, extras?: string) => Promise<CollectionSummary | null>
  clearDetail: () => void
}

export const useCollectionStore = create<CollectionStore>()(
  devtools((set, get) => ({
    collections: [],
    currentDetail: null,
    loading: false,
    generating: false,

    fetchCollections: async () => {
      set({ loading: true })
      try {
        const data = await apiGetCollections()
        set({ collections: data })
      } catch {
        toast.error('获取合集列表失败')
      } finally {
        set({ loading: false })
      }
    },

    createCollection: async (name, description, category, taskIds) => {
      try {
        const created = await apiCreate({ name, description, category, task_ids: taskIds })
        set(state => ({ collections: [created, ...state.collections] }))
        return created
      } catch {
        toast.error('创建合集失败')
        return null
      }
    },

    updateCollection: async (id, params) => {
      try {
        const updated = await apiUpdate(id, params)
        set(state => ({
          collections: state.collections.map(c => c.id === id ? { ...c, ...updated } : c),
        }))
      } catch {
        toast.error('更新合集失败')
      }
    },

    deleteCollection: async (id) => {
      try {
        await apiDelete(id)
        set(state => ({ collections: state.collections.filter(c => c.id !== id) }))
      } catch {
        toast.error('删除合集失败')
      }
    },

    fetchDetail: async (id) => {
      set({ loading: true })
      try {
        const data = await apiGetDetail(id)
        set({ currentDetail: data })
      } catch {
        toast.error('获取合集详情失败')
      } finally {
        set({ loading: false })
      }
    },

    addItems: async (collectionId, taskIds) => {
      try {
        const added = await apiAddItems(collectionId, taskIds)
        // 刷新详情
        await get().fetchDetail(collectionId)
        // 刷新列表计数
        await get().fetchCollections()
        return added
      } catch {
        toast.error('添加笔记失败')
        return 0
      }
    },

    removeItem: async (collectionId, taskId) => {
      try {
        await apiRemoveItem(collectionId, taskId)
        await get().fetchDetail(collectionId)
        await get().fetchCollections()
      } catch {
        toast.error('移除笔记失败')
      }
    },

    generateSummary: async (collectionId, style, modelName, providerId, extras) => {
      set({ generating: true })
      try {
        const result = await apiGenSummary({
          collectionId,
          style: style ?? 'minimal',
          model_name: modelName,
          provider_id: providerId,
          extras,
        })
        // 刷新详情
        await get().fetchDetail(collectionId)
        return result
      } catch {
        toast.error('生成合集总结失败')
        return null
      } finally {
        set({ generating: false })
      }
    },

    clearDetail: () => set({ currentDetail: null }),
  }))
)
