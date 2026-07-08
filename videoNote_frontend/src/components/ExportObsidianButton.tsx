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
      await exportNote(taskId)
      toast.success('导出成功！笔记已保存到 Obsidian')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '导出失败，请检查配置'
      toast.error(errorMessage)
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
