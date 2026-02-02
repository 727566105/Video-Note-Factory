import { useState, useEffect } from 'react'
import { useModelStore } from '@/store/modelStore'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'
import { RefreshCw, Plus, Search } from 'lucide-react'

interface ModelSelectorProps {
  providerId: string
  onModelAdded?: () => void
}

export function ModelSelector({ providerId, onModelAdded }: ModelSelectorProps) {
  const { models, loading, selectedModel, loadModels, setSelectedModel, addNewModel } =
    useModelStore()
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const filteredModels = models.filter(model => {
    const keywords = search.trim().toLowerCase().split(/\s+/)
    const target = model.id.toLowerCase()
    return keywords.every(kw => target.includes(kw))
  })

  useEffect(() => {
    if (providerId) {
      loadModels(providerId)
    }
  }, [providerId])

  const handleSubmit = async () => {
    if (!selectedModel) {
      toast.error('请选择一个模型')
      return
    }
    try {
      setSubmitting(true)
      await addNewModel(providerId, selectedModel)
      toast.success('添加模型成功 🎉')
      setSelectedModel('') // 清空选择
      if (onModelAdded) {
        onModelAdded()
      }
    } catch (error) {
      toast.error('添加失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Plus className="h-4 w-4 text-blue-600" />
          </div>
          <span className="font-medium text-gray-900">添加模型</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => loadModels(providerId)}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '加载中' : '刷新列表'}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="请选择要添加的模型" />
          </SelectTrigger>
          <SelectContent>
            <div className="sticky top-0 bg-white p-2 pb-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="搜索模型名称..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 pl-8"
                />
              </div>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {filteredModels.length > 0 ? (
                filteredModels.map((model, index) => (
                  <SelectItem 
                    key={`${model.id}-${index}`} 
                    value={model.id}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{model.id}</span>
                      {model.owned_by && (
                        <span className="text-xs text-gray-500">by {model.owned_by}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-gray-500">
                  {search ? '未找到匹配的模型' : '暂无可用模型'}
                </div>
              )}
            </div>
          </SelectContent>
        </Select>

        <Button 
          onClick={handleSubmit} 
          disabled={submitting || !selectedModel}
          className="gap-1.5 sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          {submitting ? '添加中...' : '添加模型'}
        </Button>
      </div>

      {models.length > 0 && (
        <div className="text-xs text-gray-500">
          共 {models.length} 个可用模型
        </div>
      )}
    </div>
  )
}
