import { useState, useEffect } from 'react'
import { useModelStore } from '@/store/modelStore'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModelSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ModelSelectDialog({ open, onOpenChange }: ModelSelectDialogProps) {
  const { modelList, loading, loadEnabledModels, selectedModel, setSelectedModel } = useModelStore()
  const [tempSelected, setTempSelected] = useState(selectedModel)

  useEffect(() => {
    if (open) {
      loadEnabledModels()
      setTempSelected(selectedModel)
    }
  }, [open, loadEnabledModels, selectedModel])

  const handleConfirm = () => {
    if (tempSelected) {
      setSelectedModel(tempSelected)
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            选择默认模型
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              加载中...
            </div>
          ) : modelList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
              <p>暂无可用模型</p>
              <p className="text-xs mt-1">请先在设置中添加模型</p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {modelList.map((model) => (
                  <div
                    key={model.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      tempSelected === model.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted"
                    )}
                    onClick={() => setTempSelected(model.id)}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                        tempSelected === model.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                      )}
                    >
                      {tempSelected === model.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground">{model.model_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {model.provider_id}
                      </div>
                    </div>
                    {tempSelected === model.id && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!tempSelected || loading}
            className="gap-1.5"
          >
            <Check className="w-4 h-4" />
            确认选择
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
