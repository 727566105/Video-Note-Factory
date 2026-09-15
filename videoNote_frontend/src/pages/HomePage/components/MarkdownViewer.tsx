import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { ArrowRight, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import Error from '@/components/Lottie/error.tsx'
import Loading from '@/components/Lottie/Loading.tsx'
import Idle from '@/components/Lottie/Idle.tsx'
import StepBar from '@/pages/HomePage/components/StepBar.tsx'
import { FC } from 'react'
import { useTaskStore } from '@/store/taskStore'
import { noteStyles } from '@/constant/note.ts'
import { MarkdownHeader } from '@/pages/HomePage/components/MarkdownHeader.tsx'
import TranscriptViewer from '@/pages/HomePage/components/transcriptViewer.tsx'
import MarkmapEditor from '@/pages/HomePage/components/MarkmapComponent.tsx'
import ConfirmDialog from '@/components/ConfirmDialog'
import MarkdownRenderer from '@/components/MarkdownRenderer'

interface VersionNote {
  ver_id: string
  content: string
  style: string
  model_name: string
  created_at?: string
}

interface MarkdownViewerProps {
  content: string | VersionNote[]
  status: 'idle' | 'loading' | 'success' | 'failed'
}

const steps = [
  { label: '解析链接', key: 'PARSING' },
  { label: '下载音频', key: 'DOWNLOADING' },
  { label: '转写文字', key: 'TRANSCRIBING' },
  { label: '总结内容', key: 'SUMMARIZING' },
  { label: '保存完成', key: 'SUCCESS' },
]

const MarkdownViewer: FC<MarkdownViewerProps> = ({ status }) => {
  const [copied, setCopied] = useState(false)

  // 用正确的 selector 模式获取 currentTask，避免反模式
  const currentTask = useTaskStore(state => {
    const task = state.tasks.find(t => t.id === state.currentTaskId)
    return task || null
  })
  const removeTask = useTaskStore(state => state.removeTask)
  const taskStatus = currentTask?.status || 'PENDING'
  const retryTask = useTaskStore.getState().retryTask
  const isMultiVersion = Array.isArray(currentTask?.markdown)
  const [showTranscribe, setShowTranscribe] = useState(false)
  const [viewMode, setViewMode] = useState<'map' | 'preview'>('preview')

  // 删除确认弹窗
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // 合并为单个状态对象，避免多次 setState 导致多次渲染
  const [versionState, setVersionState] = useState({
    currentVerId: '',
    selectedContent: '',
    modelName: '',
    style: '',
    createTime: '',
    smartSwitched: false,
  })

  // 多版本内容处理
  useEffect(() => {
    if (!currentTask) return

    if (!isMultiVersion) {
      setVersionState({
        currentVerId: '',
        selectedContent: currentTask.markdown as string || '',
        modelName: currentTask.used_model_name || currentTask.formData.model_name || '未知模型',
        style: currentTask.formData.style || 'detailed',
        createTime: currentTask.createdAt,
        smartSwitched: currentTask.smart_switched || false,
      })
    } else {
      const latestVersion = [...currentTask.markdown].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]

      if (latestVersion) {
        setVersionState({
          currentVerId: latestVersion.ver_id,
          selectedContent: latestVersion.content,
          modelName: latestVersion.model_name || '未知模型',
          style: latestVersion.style || 'detailed',
          createTime: latestVersion.created_at || '',
        })
      }
    }
  }, [currentTask?.id, currentTask?.markdown])

  useEffect(() => {
    if (!currentTask || !isMultiVersion) return
    if (!versionState.currentVerId) return

    const currentVer = currentTask.markdown.find(v => v.ver_id === versionState.currentVerId)
    if (currentVer) {
      setVersionState(prev => ({
        ...prev,
        selectedContent: currentVer.content,
        modelName: currentVer.model_name || '未知模型',
        style: currentVer.style || 'detailed',
        createTime: currentVer.created_at || '',
      }))
    }
  }, [versionState.currentVerId])

  const setCurrentVerId = (id: string) => {
    setVersionState(prev => ({ ...prev, currentVerId: id }))
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(versionState.selectedContent)
      setCopied(true)
      toast.success('已复制到剪贴板')
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      toast.error('复制失败')
    }
  }

  const handleDownload = () => {
    const name = currentTask?.audioMeta?.title || 'note'
    const blob = new Blob([versionState.selectedContent], { type: 'text/markdown;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDelete = async () => {
    if (!currentTask?.id) return

    try {
      await removeTask(currentTask.id)
      toast.success('删除成功')
    } catch (e) {
    }
  }

  if (status === 'loading') {
    return (
      <div className=”flex h-full w-full flex-col items-center justify-center space-y-4 text-neutral-500”>
        <StepBar steps={steps} currentStep={taskStatus} />
        <Loading className=”h-5 w-5” />
        <div className=”text-center text-sm”>
          <p className=”text-lg font-bold”>正在生成笔记，请稍候…</p>
          <p className=”mt-2 text-xs text-neutral-500”>这可能需要几秒钟时间，取决于视频长度</p>
        </div>
      </div>
    )
  }

  if (status === 'idle') {
    return (
      <div className=”flex h-full w-full flex-col items-center justify-center space-y-3 text-neutral-500”>
        <Idle />
        <div className=”text-center”>
          <p className=”text-lg font-bold”>输入视频链接并点击”生成笔记”</p>
          <p className=”mt-2 text-xs text-neutral-500”>支持哔哩哔哩、YouTube 、抖音等视频平台</p>
        </div>
      </div>
    )
  }

  if (status === 'failed' && !isMultiVersion) {
    const errorMessage = currentTask?.message || '请检查后台或稍后再试'
    return (
      <div className=”flex h-full w-full flex-col items-center justify-center gap-4 space-y-3”>
        <Error />
        <div className="text-center">
          <p className="text-lg font-bold text-red-500">笔记生成失败</p>
          <p className="mt-2 mb-2 text-xs text-red-400">{errorMessage}</p>

          <Button onClick={() => retryTask(currentTask.id)} size="lg">
            重试
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col">
      <MarkdownHeader
        currentTask={currentTask}
        isMultiVersion={isMultiVersion}
        currentVerId={versionState.currentVerId}
        setCurrentVerId={setCurrentVerId}
        modelName={versionState.modelName}
        style={versionState.style}
        smartSwitched={versionState.smartSwitched}
        noteStyles={noteStyles}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onDelete={() => setDeleteDialogOpen(true)}
        createAt={versionState.createTime}
        showTranscribe={showTranscribe}
        setShowTranscribe={setShowTranscribe}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      {viewMode === 'map' ? (
        <div className="flex w-full flex-1 overflow-hidden bg-background">
          <div className={'w-full'}>
            <MarkmapEditor
              value={versionState.selectedContent}
              onChange={() => {}}
              height="100%" // 根据需求可以设定百分比或固定高度
              title={currentTask?.audioMeta?.title || '思维导图'}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 min-h-0 flex-col bg-background">
          {versionState.selectedContent && versionState.selectedContent !== 'loading' && versionState.selectedContent !== 'empty' ? (
            <>
              <div className="flex-1 overflow-y-auto p-3 md:p-6">
                <MarkdownRenderer content={versionState.selectedContent} />
              </div>
              {showTranscribe && (
                <div className={'ml-2 w-2/4'}>
                  <TranscriptViewer />
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="w-[300px] flex-col justify-items-center">
                <div className="bg-primary-light mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                  <ArrowRight className="text-primary h-8 w-8" />
                </div>
                <p className="mb-2 text-neutral-600">输入视频链接并点击"生成笔记"按钮</p>
                <p className="text-xs text-neutral-500">支持哔哩哔哩、YouTube等视频网站</p>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="删除笔记"
        description="确定要删除这条笔记吗？此操作不可恢复。"
        confirmText="删除"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default MarkdownViewer
