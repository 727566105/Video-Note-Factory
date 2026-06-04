import request from '@/utils/request'

export interface CollectionInfo {
  id: string
  user_id: number
  name: string
  description: string | null
  cover_url: string | null
  category: string | null
  sort_order: number
  created_at: string | null
  updated_at: string | null
  item_count?: number
}

export interface CollectionItem {
  id: string
  task_id: string
  position: number
  added_at: string | null
  title?: string
  cover_url?: string
  platform?: string
  author?: string
  author_id?: string
  video_id?: string
  duration?: number
}

export interface CollectionSummary {
  id: string
  collection_id: string
  content: string | null
  style: string | null
  model_name: string | null
  provider_id: string | null
  extras: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CollectionDetail extends CollectionInfo {
  items: CollectionItem[]
  summary?: CollectionSummary
}

// 注意：request.ts 拦截器在 code===0 时已直接返回 res.data（实际数据）
// 所以这里直接用返回值，不再 .data?.data

export async function getCollections(): Promise<CollectionInfo[]> {
  const data = await request.get('/collections')
  return data ?? []
}

export async function createCollection(params: {
  name: string
  description?: string
  category?: string
  task_ids?: string[]
}): Promise<CollectionInfo> {
  return await request.post('/collections', params)
}

export async function updateCollection(id: string, params: {
  name?: string
  description?: string
  cover_url?: string
  category?: string
  sort_order?: number
}): Promise<CollectionInfo> {
  return await request.put(`/collections/${id}`, params)
}

export async function deleteCollection(id: string): Promise<void> {
  await request.delete(`/collections/${id}`)
}

export async function getCollectionDetail(id: string): Promise<CollectionDetail> {
  return await request.get(`/collections/${id}`)
}

export async function addItemsToCollection(collectionId: string, taskIds: string[]): Promise<number> {
  const data = await request.post(`/collections/${collectionId}/items`, { task_ids: taskIds })
  return data?.added ?? 0
}

export async function removeItemFromCollection(collectionId: string, taskId: string): Promise<void> {
  await request.delete(`/collections/${collectionId}/items/${taskId}`)
}

export async function updateItemsOrder(collectionId: string, orderedTaskIds: string[]): Promise<void> {
  await request.put(`/collections/${collectionId}/items/order`, { ordered_task_ids: orderedTaskIds })
}

export async function getCollectionSummary(collectionId: string): Promise<CollectionSummary | null> {
  return await request.get(`/collections/${collectionId}/summary`)
}

export async function generateCollectionSummary(params: {
  collectionId: string
  style?: string
  model_name?: string
  provider_id?: string
  extras?: string
}): Promise<CollectionSummary> {
  const { collectionId, ...body } = params
  return await request.post(`/collections/${collectionId}/generate_summary`, body)
}
