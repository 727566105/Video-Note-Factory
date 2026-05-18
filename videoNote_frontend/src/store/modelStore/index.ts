import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  fetchModels,
  addModel,
  fetchEnableModels,
  fetchEnableModelById,
  deleteModelById
} from '@/services/model'
import { saveUserPreferences } from '@/services/userPreferences'

interface IModel {
  id: string
  created: number
  object: string
  owned_by: string
  permission: string
  root: string
}

interface IModelListItem {
  id: string
  provider_id: string
  model_name: string
  created_at?: string
}

interface ModelStore {
  models: IModel[]
  modelList: IModelListItem[]
  loading: boolean
  selectedModel: string

  loadModels: (providerId: string) => Promise<void>
  loadModelsById: (providerId: string) => Promise<IModelListItem[]>
  loadEnabledModels: () => Promise<void>
  addNewModel: (providerId: string, modelId: string) => Promise<void>
  deleteModel: (modelId: number) => Promise<void>
  setSelectedModel: (modelId: string) => void
  loadFromServer: (data: Record<string, any>) => void
  clearModels: () => void
}

export const useModelStore = create<ModelStore>()(
  devtools((set) => ({
    models: [],
    modelList: [],
    loading: false,
    selectedModel: '',

    loadEnabledModels: async () => {
      try {
        set({ loading: true })
        const list = await fetchEnableModels()
        set({ modelList: list })
      } catch (error) {
        set({ modelList: [] })
      } finally {
        set({ loading: false })
      }
    },

    loadModels: async (providerId: string) => {
      try {
        set({ loading: true })
        const res = await fetchModels(providerId)

        let models: IModel[] = []

        if (Array.isArray(res.models)) {
          models = res.models
        } else if (res.models?.data && Array.isArray(res.models.data)) {
          models = res.models.data
        }

        set({ models })
      } catch (error) {
        set({ models: [] })
      } finally {
        set({ loading: false })
      }
    },

    loadModelsById: async (providerId: string) => {
      try {
        const models = await fetchEnableModelById(providerId)
        return models
      } catch (error) {
        return []
      }
    },

    addNewModel: async (providerId: string, modelId: string) => {
      try {
        const res = await addModel({ provider_id: providerId, model_name: modelId })

        if (res.code === 0) {
          set((state) => ({
            models: [
              ...state.models,
              {
                id: modelId,
                created: Date.now(),
                object: 'model',
                owned_by: '',
                permission: '',
                root: '',
              },
            ],
          }))
        } else {
        }
      } catch (error) {
      }
    },

    deleteModel: async (modelId: number) => {
      try {
        await deleteModelById(modelId)
        set((state) => ({
          models: state.models.filter((model) => model.id !== modelId.toString())
        }))
      } catch (error) {
      }
    },

    setSelectedModel: (modelId: string) => {
      set({ selectedModel: modelId })
      saveUserPreferences({ model: { selectedModel: modelId } })
    },

    loadFromServer: (data: Record<string, any>) => {
      if (data.selectedModel) {
        set({ selectedModel: data.selectedModel })
      }
    },

    clearModels: () => set({ models: [], selectedModel: '', modelList: [] }),
  }))
)
