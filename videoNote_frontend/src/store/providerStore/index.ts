import { create } from 'zustand'
import { IProvider, IResponse } from '@/types'
import {
  addProvider,
  deleteProvider,
  getProviderById,
  getProviderList,
  updateProviderById,
  batchAddModels,
  BatchAddModelItem,
} from '@/services/model.ts'

interface ProviderStore {
  provider: IProvider[]
  loading: boolean
  setProvider: (provider: IProvider) => void
  setAllProviders: (providers: IProvider[]) => void
  getProviderById: (id: number) => IProvider | undefined
  getProviderList: () => IProvider[]
  fetchProviderList: () => Promise<void>
  loadProviderById: (id: string) => Promise<IProvider>
  addNewProvider: (provider: IProvider) => Promise<void>
  addNewProviderWithModels: (provider: IProvider, models: string[]) => Promise<string>
  updateProvider: (provider: IProvider) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
}

interface ProviderPayload {
  provider_id?: number
  provider_name?: string
  provider_type?: string
  api_key?: string
  base_url?: string
  [key: string]: unknown
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  provider: [],
  loading: false,

  // 添加或更新一个 provider
  setProvider: newProvider =>
    set(state => {
      const exists = state.provider.find(p => p.id === newProvider.id)
      if (exists) {
        return {
          provider: state.provider.map(p => (p.id === newProvider.id ? newProvider : p)),
        }
      } else {
        return { provider: [...state.provider, newProvider] }
      }
    }),

  // 设置整个 provider 列表
  setAllProviders: providers => set({ provider: providers }),
  loadProviderById: async (id: string) => {
    const res:IResponse<IProvider> = await getProviderById(id)

      const item = res
      return {
        id: item.id,
        name: item.name,
        logo: item.logo,
        logoUrl: item.logo_url,
        apiKey: item.api_key,
        baseUrl: item.base_url,
        type: item.type,
        enabled: item.enabled,
      }

  },
  addNewProvider: async (provider: IProvider) => {
    const payload: ProviderPayload = {
      ...provider,
      api_key: provider.api_key ?? provider.apiKey,
      base_url: provider.base_url ?? provider.baseUrl,
    }
    delete payload.apiKey
    delete payload.baseUrl
    try {
      const data = await addProvider(payload as Parameters<typeof addProvider>[0])
      const item = data
      await get().fetchProviderList()
      return item.id || item
    } catch (error) {
      throw error
    }
  },
  // 一气呵成：保存供应商 + 批量添加模型
  addNewProviderWithModels: async (provider: IProvider, modelNames: string[]) => {
    const payload: ProviderPayload = {
      ...provider,
      api_key: provider.api_key ?? provider.apiKey,
      base_url: provider.base_url ?? provider.baseUrl,
    }
    delete payload.apiKey
    delete payload.baseUrl
    const data = await addProvider(payload as Parameters<typeof addProvider>[0])
    const newId = data.id || data

    if (modelNames.length > 0) {
      const items: BatchAddModelItem[] = modelNames.map(name => ({
        provider_id: newId,
        model_name: name,
      }))
      await batchAddModels(items)
    }

    await get().fetchProviderList()
    return newId
  },
  // 按 id 获取单个 provider
  getProviderById: id => get().provider.find(p => p.id === id),
  updateProvider: async (provider: IProvider) => {
    try {
      const data: ProviderPayload = {
        id: provider.id,
      }
      
      // 只添加非 undefined 的字段
      if (provider.name !== undefined) data.name = provider.name
      if (provider.apiKey !== undefined) data.api_key = provider.apiKey
      if (provider.baseUrl !== undefined) data.base_url = provider.baseUrl
      if (provider.type !== undefined) data.type = provider.type
      if (provider.enabled !== undefined) data.enabled = provider.enabled
      if (provider.logo !== undefined) data.logo = provider.logo
      if (provider.logoUrl !== undefined) data.logo_url = provider.logoUrl
      
      const res = await updateProviderById(data)
      await get().fetchProviderList()
      return res
    } catch (error) {
      throw error
    }
  },
  deleteProvider: async (id: string) => {
    try {
      await deleteProvider(id)
      await get().fetchProviderList()
    } catch (error) {
      throw error
    }
  },
  getProviderList: () => get().provider,
  fetchProviderList: async () => {
    try {
      set({ loading: true })
      const res  = await getProviderList()

        set({
          loading: false,
          provider: res.map(
            (item: {
              id: string
              name: string
              logo: string
              logo_url: string
              api_key: string
              base_url: string
              type: string
              enabled: number
            }) => {
              return {
                id: item.id,
                name: item.name,
                logo: item.logo,
                logoUrl: item.logo_url,
                apiKey: item.api_key,
                baseUrl: item.base_url,
                type: item.type,
                enabled: item.enabled,
              }
            }
          ),
        })
    } catch (error) {
      set({ loading: false })
    }
  },
}))
