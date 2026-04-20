import { create } from 'zustand'
import { IProvider, IResponse } from '@/types'
import {
  addProvider,
  deleteProvider,
  getProviderById,
  getProviderList,
  updateProviderById,
} from '@/services/model.ts'

interface ProviderStore {
  provider: IProvider[]
  setProvider: (provider: IProvider) => void
  setAllProviders: (providers: IProvider[]) => void
  getProviderById: (id: number) => IProvider | undefined
  getProviderList: () => IProvider[]
  fetchProviderList: () => Promise<void>
  loadProviderById: (id: string) => Promise<void>
  addNewProvider: (provider: IProvider) => Promise<void>
  updateProvider: (provider: IProvider) => Promise<void>
  deleteProvider: (id: string) => Promise<void>
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  provider: [],

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
        apiKey: item.api_key,
        baseUrl: item.base_url,
        type: item.type,
        enabled: item.enabled,
      }

  },
  addNewProvider: async (provider: IProvider) => {
    const payload = {
      ...provider,
      api_key: provider.apiKey,
      base_url: provider.baseUrl,
    }
    try {
      const data = await addProvider(payload)
      // addProvider 已经返回 res.data，直接使用
      const item = data

      await get().fetchProviderList()
      return item.id || item
    } catch (error) {
      console.error('Error adding provider:', error)
      throw error
    }
  },
  // 按 id 获取单个 provider
  getProviderById: id => get().provider.find(p => p.id === id),
  updateProvider: async (provider: IProvider) => {
    try {
      const data: any = {
        id: provider.id,
      }
      
      // 只添加非 undefined 的字段
      if (provider.name !== undefined) data.name = provider.name
      if (provider.apiKey !== undefined) data.api_key = provider.apiKey
      if (provider.baseUrl !== undefined) data.base_url = provider.baseUrl
      if (provider.type !== undefined) data.type = provider.type
      if (provider.enabled !== undefined) data.enabled = provider.enabled
      if (provider.logo !== undefined) data.logo = provider.logo
      
      const res = await updateProviderById(data)
      if (res.data.code === 0) {
        await get().fetchProviderList()
      }
    } catch (error) {
      console.error('Error updating provider:', error)
      throw error
    }
  },
  deleteProvider: async (id: string) => {
    try {
      await deleteProvider(id)
      await get().fetchProviderList()
    } catch (error) {
      console.error('Error deleting provider:', error)
      throw error
    }
  },
  getProviderList: () => get().provider,
  fetchProviderList: async () => {
    try {
      const res  = await getProviderList()

        set({
          provider: res.map(
            (item: {
              id: string
              name: string
              logo: string
              api_key: string
              base_url: string
              type: string
              enabled: number
            }) => {
              return {
                id: item.id,
                name: item.name,
                logo: item.logo,
                apiKey: item.api_key,
                baseUrl: item.base_url,
                type: item.type,
                enabled: item.enabled,
              }
            }
          ),
        })
    } catch (error) {
      console.error('Error fetching provider list:', error)
    }
  },
}))
