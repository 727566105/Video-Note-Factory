import { useState, forwardRef } from 'react'
import { toast } from 'sonner'
import { Box, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useObsidianStore } from '@/store/obsidianStore'

interface ExportObsidianButtonProps {
  taskId: string
  disabled?: boolean
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  /** 导出时传递的内容勾选项，未传则导出全部内容 */
  contentSections?: Record<string, any>
}

/**
 * Obsidian 导出按钮组件
 * 用于将笔记导出到 Obsidian
 */
export const ExportObsidianButton = forwardRef<HTMLButtonElement, ExportObsidianButtonProps>(({
  taskId,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className = '',
  contentSections,
}, ref) => {
  const { isConfigured, isExporting, exportNote } = useObsidianStore()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    // 检查是否已配置
    if (!isConfigured) {
      toast.error('请先在设置中配置 Obsidian')
      return
    }

    setLoading(true)
    try {
      await exportNote(taskId, contentSections)
      toast.success('导出成功！笔记已保存到 Obsidian')
    } catch (error: any) {
      // request 拦截器 reject 的是 {code, msg, data}，优先用 msg
      const errorMessage = error?.msg || (error instanceof Error ? error.message : '导出失败，请检查配置')
      toast.error(typeof errorMessage === 'string' ? errorMessage : '导出失败，请检查配置')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      ref={ref}
      onClick={handleExport}
      disabled={disabled || loading || isExporting || !isConfigured}
      variant={variant}
      size={size}
      className={className}
      title={!isConfigured ? '请先配置 Obsidian' : '导出到 Obsidian'}
    >
      {loading || isExporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>导出中...</span>
        </>
      ) : (
        <>
          <Box className="w-4 h-4" />
          <span>Obsidian</span>
        </>
      )}
    </Button>
  )
})
