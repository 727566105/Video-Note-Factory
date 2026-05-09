import { useState, forwardRef } from 'react'
import { Image } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTaskStore } from '@/store/taskStore'
import ExportImageDialog from './ExportImageDialog'

interface ExportImageButtonProps {
  taskId: string
  disabled?: boolean
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

/**
 * 图文导出按钮组件
 * 点击后前端渲染笔记内容并生成 750px 宽度的长图，类似锤子笔记风格
 */
export const ExportImageButton = forwardRef<HTMLButtonElement, ExportImageButtonProps>(({
  taskId,
  disabled = false,
  variant = 'default',
  size = 'default',
  className = '',
}, ref) => {
  const [dialogOpen, setDialogOpen] = useState(false)

  // 从 taskStore 获取当前任务的完整数据
  const currentTask = useTaskStore(state => {
    const task = state.tasks.find(t => t.id === taskId)
    return task || null
  })

  const baseURL = (String(import.meta.env.VITE_API_BASE_URL || '').replace('/api', '') || '').replace(/\/$/, '')

  // 提取显示内容
  const getContent = () => {
    if (!currentTask?.markdown) return ''
    if (Array.isArray(currentTask.markdown)) {
      // 多版本取最新的
      const sorted = [...currentTask.markdown].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      return sorted[0]?.content || ''
    }
    return currentTask.markdown as string
  }

  const getTitle = () => {
    if (!currentTask) return '未命名笔记'
    if (currentTask.platform === 'local_audio' || currentTask.platform === 'local') {
      const filename = currentTask.formData?.video_url?.split('/').pop()
      if (filename) return filename
    }
    return currentTask.audioMeta?.title || '未命名笔记'
  }

  const getCoverUrl = () => {
    if (!currentTask?.audioMeta?.cover_url) return undefined
    const isLocal = currentTask.platform === 'local' || currentTask.platform === 'local_audio'
    if (isLocal) return currentTask.audioMeta.cover_url
    return `${baseURL}/api/image_proxy?url=${encodeURIComponent(currentTask.audioMeta.cover_url)}`
  }

  const getModelName = () => {
    if (!currentTask?.markdown) return currentTask?.formData?.model_name || ''
    if (Array.isArray(currentTask.markdown)) {
      const sorted = [...currentTask.markdown].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      return sorted[0]?.model_name || currentTask?.formData?.model_name || ''
    }
    return currentTask?.formData?.model_name || ''
  }

  return (
    <>
      <Button
        ref={ref}
        onClick={() => setDialogOpen(true)}
        disabled={disabled || !currentTask}
        variant={variant}
        size={size}
        className={className}
      >
        <Image className="w-4 h-4" />
        <span>导出图文</span>
      </Button>

      {currentTask && (
        <ExportImageDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          content={getContent()}
          title={getTitle()}
          coverUrl={getCoverUrl()}
          platform={currentTask.platform}
          modelName={getModelName()}
          createdAt={currentTask.createdAt}
        />
      )}
    </>
  )
})