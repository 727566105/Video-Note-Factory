import { useState, useEffect } from 'react'
import {
  Copy,
  Download,
  MoreHorizontal,
  ListVideo,
  CheckCircle,
  Edit,
  BrainCircuit,
  FileText,
  Trash,
  RefreshCw,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import MarkmapEditor from '@/pages/HomePage/components/MarkmapComponent'
import TranscriptViewer from '@/pages/HomePage/components/transcriptViewer'
import { ExportPDFButton } from '@/components/ExportPDFButton'
import { ExportSiyuanButton } from '@/components/ExportSiyuanButton'
import { ExportImageButton } from '@/components/ExportImageButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useTaskStore, type Task, type Markdown } from '@/store/taskStore'
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import { noteStyles, outputLanguages } from '@/constant/note'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TabKey = 'summary' | 'transcript' | 'mindmap'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'summary', label: '全文总结' },
  { key: 'transcript', label: '字幕脚本' },
  { key: 'mindmap', label: '思维导图' },
]

interface RightPanelProps {
  task: Task
}

interface LocalSettings {
  style: string
  outputLanguage: string
  modelName: string
  providerId: string
}

export default function RightPanel({ task }: RightPanelProps) {
  const navigate = useNavigate()
  const removeTask = useTaskStore(state => state.removeTask)
  const retryTask = useTaskStore(state => state.retryTask)
  const setCurrentTask = useTaskStore(state => state.setCurrentTask)
  const modelList = useModelStore(state => state.modelList)
  const providers = useProviderStore(state => state.provider)
  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 独立的生成配置，不受全局 summarySettings 影响
  const [localSettings, setLocalSettings] = useState<LocalSettings>({
    style: task.formData?.style || 'minimal',
    outputLanguage: task.formData?.output_language || 'zh',
    modelName: task.formData?.model_name || '',
    providerId: task.formData?.provider_id || '',
  })

  // 设置 currentTaskId，让 TranscriptViewer 等组件能读取当前任务
  useEffect(() => {
    setCurrentTask(task.id)
  }, [task.id, setCurrentTask])

  const isMultiVersion = Array.isArray(task.markdown)
  const [currentVerId, setCurrentVerId] = useState('')

  const [selectedContent, setSelectedContent] = useState('')
  const [modelName, setModelName] = useState('')
  const [styleName, setStyleName] = useState('')
  const [createTime, setCreateTime] = useState('')

  // 初始化版本
  useEffect(() => {
    if (!isMultiVersion) {
      setSelectedContent(typeof task.markdown === 'string' ? task.markdown : '')
      setModelName(task.formData?.model_name || '')
      const sName = noteStyles.find(v => v.value === task.formData?.style)?.label || task.formData?.style || ''
      setStyleName(sName)
      setCreateTime(task.createdAt || '')
      return
    }

    const versions = task.markdown as Markdown[]
    const latest = [...versions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]

    if (latest) {
      setCurrentVerId(latest.ver_id)
      setSelectedContent(latest.content)
      setModelName(latest.model_name || '')
      const sName = noteStyles.find(v => v.value === latest.style)?.label || latest.style || ''
      setStyleName(sName)
      setCreateTime(latest.created_at || '')
    }
  }, [task.id, task.markdown])

  // 版本切换
  useEffect(() => {
    if (!isMultiVersion || !currentVerId) return
    const versions = task.markdown as Markdown[]
    const ver = versions.find(v => v.ver_id === currentVerId)
    if (ver) {
      setSelectedContent(ver.content)
      setModelName(ver.model_name || '')
      const sName = noteStyles.find(v => v.value === ver.style)?.label || ver.style || ''
      setStyleName(sName)
      setCreateTime(ver.created_at || '')
    }
  }, [currentVerId])

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedContent)
    toast.success('已复制到剪贴板')
  }

  const handleDownload = () => {
    const name = task.audioMeta?.title || 'note'
    const blob = new Blob([selectedContent], { type: 'text/markdown;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleDelete = async () => {
    try {
      await removeTask(task.id)
      toast.success('删除成功')
      navigate('/notes')
    } catch {
      // removeTask 内部已 toast
    }
  }

  // 重新生成：使用独立的 localSettings
  const handleRegenerate = async () => {
    const model = modelList.find(m => m.model_name === localSettings.modelName) || modelList[0]
    if (!model) {
      toast.error('没有可用的模型，请先添加模型')
      return
    }

    const payload = {
      ...task.formData,
      model_name: model.model_name,
      provider_id: model.provider_id,
      style: localSettings.style,
      output_language: localSettings.outputLanguage,
    }

    try {
      await retryTask(task.id, payload)
      toast.success('重新生成任务已提交')
    } catch {
      // retryTask 内部已 toast
    }
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return ''
    const d = new Date(date)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '-')
  }

  return (
    <div className="flex flex-col h-full">
      {/* 标签栏 */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-2">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
          {tabs.map((tab) => {
            const TabIcon =
              tab.key === 'summary' ? FileText :
              tab.key === 'transcript' ? ListVideo :
              BrainCircuit
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1 h-8 px-3 rounded text-xs font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 信息行：版本切换 + 徽章 + 时间 */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          {isMultiVersion && (
            <Select value={currentVerId} onValueChange={setCurrentVerId}>
              <SelectTrigger className="h-7 w-[140px] text-xs">
                <SelectValue>
                  {currentVerId ? `版本（${currentVerId.slice(-6)}）` : '选择版本'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {((task.markdown as Markdown[]) || []).map(v => (
                  <SelectItem key={v.ver_id} value={v.ver_id}>
                    版本（{v.ver_id.slice(-6)}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {modelName && (
            <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-200 text-xs">
              {modelName}
            </Badge>
          )}
          {styleName && (
            <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200 text-xs">
              {styleName}
            </Badge>
          )}
          {createTime && (
            <span className="text-xs text-muted-foreground">{formatDate(createTime)}</span>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-1">
          <ActionBtn icon={<Copy className="w-3.5 h-3.5" />} label="复制" onClick={handleCopy} />
          <ActionBtn icon={<Download className="w-3.5 h-3.5" />} label="下载" onClick={handleDownload} />
          {task.id && <ExportPDFButton taskId={task.id} variant="ghost" size="sm" className="h-8 px-2 text-xs" />}
          {task.id && <ExportImageButton taskId={task.id} variant="ghost" size="sm" className="h-8 px-2 text-xs" />}
          {task.id && <ExportSiyuanButton taskId={task.id} variant="ghost" size="sm" className="h-8 px-2 text-xs" />}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 h-8 px-2 rounded-md border border-border text-xs hover:bg-accent transition-colors">
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" /> 导出 Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600 focus:text-red-600">
                <Trash className="mr-2 h-4 w-4" /> 删除笔记
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 状态行 */}
      <div className="flex items-center justify-between px-4 py-1">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-medium text-green-600">总结完成</span>
        </div>
        <div className="flex items-center gap-2">
          <ActionBtn icon={<Settings className="w-3.5 h-3.5" />} label="设置" onClick={() => setSettingsOpen(true)} />
          <ActionBtn icon={<RefreshCw className="w-3.5 h-3.5" />} label="重新生成" onClick={handleRegenerate} />
          <ActionBtn icon={<Edit className="w-3.5 h-3.5" />} label="编辑" />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-accent/30 m-4 p-4">
        {activeTab === 'summary' && (
          <MarkdownRenderer content={selectedContent} />
        )}
        {activeTab === 'transcript' && (
          <TranscriptViewer />
        )}
        {activeTab === 'mindmap' && (
          <MarkmapEditor
            value={selectedContent}
            onChange={() => {}}
            height="100%"
            title={task.audioMeta?.title || '思维导图'}
          />
        )}
      </div>

      {/* 生成设置对话框（独立于全局设置） */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-lg font-semibold">重新生成设置</DialogTitle>
            <DialogDescription className="sr-only">
              配置当前笔记的重新生成参数
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-5">
            {/* 模型选择 */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">模型</span>
              <Select
                value={localSettings.modelName}
                onValueChange={v => {
                  const model = modelList.find(m => m.model_name === v)
                  setLocalSettings(s => ({
                    ...s,
                    modelName: v,
                    providerId: model?.provider_id || s.providerId,
                  }))
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {modelList.map(m => {
                    const provider = providers.find(p => p.id === m.provider_id)
                    const displayName = provider ? `${provider.name}/${m.model_name}` : m.model_name
                    return (
                      <SelectItem key={m.id} value={m.model_name}>
                        {displayName}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* 笔记风格 */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">笔记风格</span>
              <Select
                value={localSettings.style}
                onValueChange={v => setLocalSettings(s => ({ ...s, style: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {noteStyles.find(s => s.value === localSettings.style)?.label || '选择风格'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {noteStyles.map(({ label, value, desc }) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex flex-col gap-1 py-0.5">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs text-muted-foreground">{desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 输出语言 */}
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">输出语言</span>
              <Select
                value={localSettings.outputLanguage}
                onValueChange={v => setLocalSettings(s => ({ ...s, outputLanguage: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {outputLanguages.find(l => l.value === localSettings.outputLanguage)?.label || '中文'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {outputLanguages.map(({ label, value }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

function ActionBtn({
  icon,
  label,
  highlight,
  onClick,
}: {
  icon: React.ReactNode
  label?: string
  highlight?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs transition-colors',
        highlight
          ? 'border border-pink-400 text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20'
          : 'border border-border text-foreground hover:bg-accent'
      )}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}
