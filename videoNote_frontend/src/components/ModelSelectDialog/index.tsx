import { useState, useEffect } from 'react'
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Sparkles, X, Bot } from 'lucide-react'
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
      <DialogContent showCloseButton={false} className="w-full sm:w-[375px] max-w-[calc(100%-2rem)] sm:max-w-[375px] p-0 gap-0 overflow-hidden rounded-lg border border-border bg-popover">
        {/* 标题栏 */}
        <div className="flex items-center justify-between h-[52px] sm:h-[56px] px-4">
          <DialogTitle className="text-base sm:text-[17px] font-semibold text-popover-foreground">
            选择模型
          </DialogTitle>
          <DialogDescription className="sr-only">
            从列表中选择一个AI模型用于生成笔记
          </DialogDescription>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 标题分隔线 */}
        <div className="h-px bg-border" />

        {/* 搜索框 */}
        <div className="flex items-center gap-2 h-[40px] sm:h-[44px] px-4">
          <Search className="w-[16px] sm:w-[18px] h-[16px] sm:h-[18px] text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索模型..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 text-[14px] sm:text-[15px] bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* 搜索分隔线 */}
        <div className="h-px bg-border" />

        {/* 智能优选 */}
        <button
          className={cn(
            "flex items-center gap-[10px] w-full px-4 py-2.5 sm:py-3 transition-colors",
            selectedModel === 'smart' ? "bg-accent" : "hover:bg-accent/50"
          )}
          onClick={() => handleSelectModel('smart')}
        >
          <Sparkles className="w-[16px] sm:w-[18px] h-[16px] sm:h-[18px] text-foreground" />
          <span className="text-[14px] sm:text-[15px] font-medium text-foreground">智能优选</span>
        </button>

        {/* 模型列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
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
          <ScrollArea className="h-[240px] sm:h-[280px]">
            {Object.entries(groupedModels).map(([provider, models]) => (
              <div key={provider}>
                {/* 分组标题 */}
                <div className="px-4 pt-2 sm:pt-3 pb-1">
                  <span className="text-[12px] sm:text-[13px] font-medium text-muted-foreground">{provider}</span>
                </div>
                {/* 模型项 */}
                {models.map((model) => (
                  <button
                    key={model.id}
                    className={cn(
                      "flex items-center justify-between w-full px-4 py-2.5 sm:py-3 transition-colors",
                      selectedModel === model.id ? "bg-accent" : "hover:bg-accent/50"
                    )}
                    onClick={() => handleSelectModel(model.id)}
                  >
                    <div className="flex items-center gap-[10px]">
                      <Bot className="w-4 sm:w-5 h-4 sm:h-5 text-foreground" />
                      <span className="text-[14px] sm:text-[15px] text-foreground">{model.model_name}</span>
                    </div>
                    {selectedModel === model.id && (
                      <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        已选
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}