import { useState } from 'react'
import toast from 'react-hot-toast'
import { BookOpen, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSiyuanStore } from '@/store/siyuanStore'

interface ExportSiyuanButtonProps {
  taskId: string
  disabled?: boolean
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

/**
 * 思源笔记导出按钮组件
 * 用于将笔记导出到思源笔记
 */
export function ExportSiyuanButton({
  taskId,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className = '',
}: ExportSiyuanButtonProps) {
  const { isConfigured, isExporting, exportNote } = useSiyuanStore()
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    // 检查是否已配置
    if (!isConfigured) {
      toast.error('请先在设置中配置思源笔记')
      return
    }

    setLoading(true)
    try {
      await exportNote(taskId)
      toast.success('导出成功！笔记已保存到思源笔记')
    } catch (error) {
      console.error('思源笔记导出失败:', error)
      const errorMessage =
        error instanceof Error ? error.message : '导出失败，请检查配置'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      onClick={handleExport}
      disabled={disabled || loading || isExporting || !isConfigured}
      variant={variant}
      size={size}
      className={className}
      title={!isConfigured ? '请先配置思源笔记' : '导出到思源笔记'}
    >
      {loading || isExporting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>导出中...</span>
        </>
      ) : (
        <>
          <BookOpen className="w-4 h-4" />
          <span>思源笔记</span>
        </>
      )}
    </Button>
  )
}
