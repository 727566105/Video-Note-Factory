import { useState, useEffect } from 'react'
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Search, Sparkles, Bot, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface ModelSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelSelectDialog({ open, onOpenChange }: ModelSelectDialogProps) {
  const { modelList, loading, loadEnabledModels, selectedModel, setSelectedModel } = useModelStore()
  const { provider, fetchProviderList } = useProviderStore()
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (open) {
      loadEnabledModels()
      fetchProviderList()
      setSearchQuery('')
    }
  }, [open, loadEnabledModels, fetchProviderList])

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId)
    onOpenChange(false)
  }

  const filteredModels = modelList.filter(model =>
    model.model_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // provider_id → 供应商名称映射
  const providerNameMap = provider.reduce((acc, p) => {
    acc[String(p.id)] = p.name
    return acc
  }, {} as Record<string, string>)

  // 按供应商分组
  const groupedModels = filteredModels.reduce((acc, model) => {
    const providerName = providerNameMap[model.provider_id] || model.provider_id
    if (!acc[providerName]) acc[providerName] = []
    acc[providerName].push(model)
    return acc
  }, {} as Record<string, typeof modelList>)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:w-[400px] max-w-[calc(100%-2rem)] sm:max-w-[400px]">
        {/* 标准头部 */}
        <DialogHeader>
          <DialogTitle>选择模型</DialogTitle>
          <DialogDescription>从列表中选择一个 AI 模型用于生成笔记</DialogDescription>
        </DialogHeader>

        {/* 搜索框 — 使用标准 Input 组件 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="搜索模型..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 模型列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : modelList.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><Bot /></EmptyMedia>
              <EmptyTitle>暂无可用模型</EmptyTitle>
              <EmptyDescription>请先在设置中添加模型</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="h-[320px] -mx-1 pr-1">
            <div className="space-y-4 px-1">
              {/* 智能优选 */}
              <button
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left",
                  selectedModel === 'smart'
                    ? "bg-primary/10 ring-1 ring-primary/30"
                    : "hover:bg-accent"
                )}
                onClick={() => handleSelectModel('smart')}
              >
                <div className={cn(
                  "flex items-center justify-center size-9 rounded-lg shrink-0",
                  selectedModel === 'smart' ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                )}>
                  <Sparkles className="size-4" />
                </div>
                <span className="flex-1 text-sm font-medium text-foreground">智能优选</span>
                {selectedModel === 'smart' && (
                  <Check className="size-4 text-primary shrink-0" />
                )}
              </button>

              {/* 按供应商分组 */}
              {Object.entries(groupedModels).map(([providerName, models]) => (
                <div key={providerName} className="space-y-0.5">
                  {/* 分组标题 */}
                  <div className="px-3 pt-1 pb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{providerName}</span>
                  </div>
                  {/* 模型项 */}
                  {models.map((model) => {
                    const isSelected = selectedModel === model.id
                    return (
                      <button
                        key={model.id}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left",
                          isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-accent"
                        )}
                        onClick={() => handleSelectModel(model.id)}
                      >
                        <div className={cn(
                          "flex items-center justify-center size-9 rounded-lg shrink-0",
                          isSelected ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                        )}>
                          <Bot className="size-4" />
                        </div>
                        <span className={cn(
                          "flex-1 text-sm truncate",
                          isSelected ? "font-medium text-foreground" : "text-foreground"
                        )}>
                          {model.model_name}
                        </span>
                        {isSelected && (
                          <Check className="size-4 text-primary shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}

              {/* 搜索无结果 */}
              {filteredModels.length === 0 && modelList.length > 0 && (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Search className="size-6 mb-2 opacity-40" />
                  <p className="text-sm">未找到匹配的模型</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
