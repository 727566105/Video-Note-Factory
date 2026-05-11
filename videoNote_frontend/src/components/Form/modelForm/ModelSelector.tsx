import { useState, useEffect } from 'react'
import { useModelStore } from '@/store/modelStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import toast from 'react-hot-toast'
import { RefreshCw, Search, Check, X } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { batchAddModels } from '@/services/model'

interface ExistingModel {
  id: string
  model_name: string
}

interface ModelSelectorProps {
  providerId: string
  existingModels?: ExistingModel[]
  onDeleteModel?: (modelId: string) => void
  onModelsAdded?: () => void
}

export function ModelSelector({ providerId, existingModels = [], onDeleteModel, onModelsAdded }: ModelSelectorProps) {
  const { models, loading, loadModels } = useModelStore()
  const [search, setSearch] = useState('')
  const [selectedModels, setSelectedModels] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const existingModelNames = existingModels.map(m => m.model_name)

  // 过滤模型列表
  const filteredModels = models.filter(model => {
    const keywords = search.trim().toLowerCase().split(/\s+/)
    const target = model.id.toLowerCase()
    return keywords.every(kw => target.includes(kw))
  })

  // 可选的模型（排除已添加的）
  const availableCount = filteredModels.filter(m => !existingModelNames.includes(m.id)).length

  // 加载模型列表
  useEffect(() => {
    if (providerId) {
      loadModels(providerId)
    }
  }, [providerId])

  // 刷新模型列表
  const handleRefresh = () => {
    if (providerId) {
      loadModels(providerId)
    }
  }

  // 全选/取消全选（仅可选模型）
  const handleSelectAll = () => {
    const available = filteredModels.filter(m => !existingModelNames.includes(m.id))
    if (selectedModels.length === available.length) {
      setSelectedModels([])
    } else {
      setSelectedModels(available.map(m => m.id))
    }
  }

  // 单个模型选择
  const handleToggle = (modelId: string) => {
    setSelectedModels(prev =>
      prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId]
    )
  }

  // 批量添加模型
  const handleAddModels = async () => {
    if (selectedModels.length === 0) {
      toast.error('请选择至少一个模型')
      return
    }

    const duplicateNames = selectedModels.filter(name => existingModelNames.includes(name))
    const newModelNames = selectedModels.filter(name => !existingModelNames.includes(name))

    if (newModelNames.length === 0) {
      toast('这些模型已添加，无需重复添加', { icon: '⚠️' })
      setSelectedModels([])
      return
    }

    try {
      setSubmitting(true)
      const items = newModelNames.map(name => ({
        provider_id: providerId,
        model_name: name,
      }))
      await batchAddModels(items)

      if (duplicateNames.length > 0) {
        toast.success(`已添加 ${newModelNames.length} 个新模型，跳过 ${duplicateNames.length} 个已存在模型`)
      } else {
        toast.success(`成功添加 ${newModelNames.length} 个模型 🎉`)
      }

      setSelectedModels([])
      if (onModelsAdded) {
        onModelsAdded()
      }
    } catch (error) {
      toast.error('添加模型失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-background p-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
            <Check className="h-4 w-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">模型管理</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? '加载中' : '刷新列表'}
        </Button>
      </div>

      {/* 左右分栏 */}
      <div className="flex gap-4">
        {/* 左侧：可选模型 */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">可选模型</span>
            {filteredModels.length > 0 && (
              <button onClick={handleSelectAll} className="text-primary hover:text-primary">
                {selectedModels.length === availableCount ? '取消全选' : '全选'}
              </button>
            )}
          </div>

          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索模型名称..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-8 text-sm"
            />
          </div>

          {/* 模型列表 */}
          <ScrollArea className="h-[280px] rounded-md border">
            {filteredModels.length > 0 ? (
              <div className="p-1">
                {filteredModels.map(model => {
                  const isExisting = existingModelNames.includes(model.id)
                  return (
                    <div
                      key={model.id}
                      className={`flex items-center gap-2 py-1.5 px-2 rounded text-sm ${
                        isExisting
                          ? 'bg-muted cursor-not-allowed'
                          : 'hover:bg-muted cursor-pointer'
                      }`}
                      onClick={() => !isExisting && handleToggle(model.id)}
                    >
                      <Checkbox
                        checked={selectedModels.includes(model.id)}
                        disabled={isExisting}
                        onCheckedChange={() => !isExisting && handleToggle(model.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`truncate ${isExisting ? 'text-muted-foreground' : 'text-foreground'}`}>
                          {model.id}
                        </div>
                      </div>
                      {isExisting && (
                        <span className="shrink-0 text-xs text-muted-foreground">已添加</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                {search ? '未找到匹配的模型' : '暂无可用模型'}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* 右侧：已启用模型 */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              已启用 <span className="text-primary">({existingModels.length})</span>
            </span>
          </div>

          {/* 占位（与左侧搜索框对齐） */}
          <div className="h-8" />

          {/* 已启用模型列表 */}
          <ScrollArea className="h-[280px] rounded-md border">
            {existingModels.length > 0 ? (
              <div className="p-1">
                {existingModels.map(model => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between gap-2 py-1.5 px-2 rounded text-sm hover:bg-muted group"
                  >
                    <span className="truncate text-foreground">{model.model_name}</span>
                    {onDeleteModel && (
                      <button
                        onClick={() => onDeleteModel(model.id)}
                        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
                暂无已启用模型
              </div>
            )}
          </ScrollArea>
        </div>
      </div>

      {/* 底部操作 */}
      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">
          已选 <span className="font-semibold text-primary">{selectedModels.length}</span> 个模型
        </span>
        <Button
          onClick={handleAddModels}
          disabled={submitting || selectedModels.length === 0}
          size="sm"
          className="gap-1.5"
        >
          <Check className="h-4 w-4" />
          {submitting ? '添加中...' : '添加已选模型'}
        </Button>
      </div>
    </div>
  )
}