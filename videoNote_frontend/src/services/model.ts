import request from '@/utils/request.ts'
import type { ProviderFormData } from '@/types/api'

export interface ProviderUpdateData {
  id: string
  name?: string
  api_key?: string
  base_url?: string
  logo?: string
  logo_url?: string
  type?: string
  enabled?: number
}

export interface ConnectionTestData {
  base_url: string
  api_key: string
}

export const getProviderList = async () => {
  return await request.get('/get_all_providers')
}
export const getProviderById = async (id: string) => {
  return await request.get(`/get_provider_by_id/${id}`)
}
export const updateProviderById = async (data: ProviderUpdateData) => {
  return await request.post('/update_provider', data)
}

export const addProvider = async (data: ProviderFormData) => {
  return await request.post('/add_provider', data)
}

export const testConnection = async (data: ConnectionTestData) => {
  return await request.post('/connect_test', data)
}

export const fetchModels = async (providerId: string) => {
  return await request.get('/model_list/' + providerId)
}

export const fetchEnableModelById = async (id: string) => {
  return await request.get('/model_enable/' + id)
}

export async function addModel(data: { provider_id: string; model_name: string }) {
  return request.post('/models', data)
}

export const fetchEnableModels = async () => {
  return await request.get('/model_list')
}

export const deleteModelById = async (modelId: number) => {
  return await request.get(`/models/delete/${modelId}`)
}

export const deleteProvider = async (id: string) => {
  return await request.delete(`/delete_provider/${id}`)
}

// 批量添加模型
export interface BatchAddModelItem {
  provider_id: string
  model_name: string
}

export const batchAddModels = async (items: BatchAddModelItem[]) => {
  // 如果后端没有批量接口，使用 Promise.all 并发调用
  return Promise.all(items.map(item => addModel(item)))
}

// 上传供应商图标
export const uploadIcon = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return await request.post('/upload_icon', formData)
}