import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PROGRESS_STEPS = [
  { key: 'PARSING', label: '解析', order: 1 },
  { key: 'DOWNLOADING', label: '下载', order: 2 },
  { key: 'TRANSCRIBING', label: '转写', order: 3 },
  { key: 'SUMMARIZING', label: '总结', order: 4 },
  { key: 'SAVING', label: '保存', order: 5 },
  { key: 'SUCCESS', label: '完成', order: 6 },
]

export const getStepProgress = (status: string): { currentStep: number; stepLabel: string } => {
  const step = PROGRESS_STEPS.find(s => s.key === status)
  if (!step) {
    if (status === 'FAILED') return { currentStep: 0, stepLabel: '失败' }
    if (status === 'CANCELLED') return { currentStep: 0, stepLabel: '已取消' }
    if (status === 'QUEUED' || status === 'PENDING') return { currentStep: 0, stepLabel: '排队' }
    return { currentStep: 0, stepLabel: '未知' }
  }
  return { currentStep: step.order, stepLabel: step.label }
}

export const isProcessingStatus = (status: string): boolean => {
  return ['PARSING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'FORMATTING', 'SAVING', 'PROCESSING', 'RUNNING'].includes(status)
}

export function hasMarkdownContent(markdown: string | unknown[] | undefined): boolean {
  if (!markdown) return false
  if (typeof markdown === 'string') return markdown.trim() !== ''
  if (Array.isArray(markdown)) return markdown.length > 0
  return false
}

export function ProcessingSpinner({ status, onCancel }: { status: string; onCancel?: () => void }) {
  const { currentStep, stepLabel } = getStepProgress(status)
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <Loader2 className="size-8 animate-spin text-primary" />
      <div className="text-base font-medium text-foreground">{stepLabel}中...</div>
      <div className="text-sm text-muted-foreground">{currentStep}/6 步骤</div>
      <div className="w-[240px] flex gap-1">
        {PROGRESS_STEPS.map((step, idx) => (
          <div
            key={step.key}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-all duration-300',
              idx < currentStep ? 'bg-primary' : 'bg-muted'
            )}
          />
        ))}
      </div>
      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
        >
          取消生成
        </button>
      )}
    </div>
  )
}
