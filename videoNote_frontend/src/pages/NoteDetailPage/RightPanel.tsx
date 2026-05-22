import { useState, useEffect } from 'react'
import {
  Copy,
  Download,
  MoreHorizontal,
  ListVideo,
  Edit,
  BrainCircuit,
  FileText,
  Trash,
  RefreshCw,
  Settings,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import OpenCC from 'opencc-js'

const twToCn = OpenCC.Converter({ from: 'tw', to: 'cn' })
import MarkdownRenderer from '@/components/MarkdownRenderer'
import MarkmapEditor from '@/pages/HomePage/components/MarkmapComponent'
import TranscriptViewer from '@/pages/HomePage/components/transcriptViewer'
import { ExportDialog } from '@/components/ExportDialog'
import { ExportSiyuanButton } from '@/components/ExportSiyuanButton'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useTaskStore, type Task, type Markdown } from '@/store/taskStore'
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import { getBaseURL } from '@/utils/api'
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
import { ButtonGroup } from '@/components/ui/button-group'

type TabKey = 'summary' | 'transcript' | 'mindmap' | 'original'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'summary', label: '全文总结' },
  { key: 'transcript', label: '字幕脚本' },
  { key: 'mindmap', label: '思维导图' },
  { key: 'original', label: '原文详情' },
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

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
              tab.key === 'mindmap' ? BrainCircuit :
              ScrollText
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

      {/* 状态行 */}
      <div className="flex items-center justify-end px-4 py-1">
        <div className="flex items-center gap-2">
          <ActionBtn icon={<Settings className="w-3.5 h-3.5" />} label="设置" onClick={() => setSettingsOpen(true)} />
          <ActionBtn icon={<RefreshCw className="w-3.5 h-3.5" />} label="重新生成" onClick={handleRegenerate} />
          <ActionBtn icon={<Edit className="w-3.5 h-3.5" />} label="编辑" />
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-border bg-accent/30 m-4">
        {/* Sticky 工具栏 */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 backdrop-blur-sm px-4 py-2">
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

          <div className="flex items-center gap-1">
            <ActionBtn icon={<Copy className="w-3.5 h-3.5" />} label="复制" onClick={handleCopy} />
            <ButtonGroup>
              <ActionBtn icon={<Download className="w-3.5 h-3.5" />} label="导出" onClick={() => setExportDialogOpen(true)} />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 h-8 px-2 rounded-md border border-border text-xs hover:bg-accent transition-colors">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600 focus:text-red-600">
                    <Trash className="mr-2 h-4 w-4" /> 删除笔记
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="p-4">
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
          {activeTab === 'original' && (
            task.transcript?.segments?.length > 0 ? (
              <div className="space-y-3">
                {groupSegments(task.transcript.segments).map((group, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-background overflow-hidden">
                    <ScreenshotImg taskId={task.id} time={group.startTime} />
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono font-medium">
                          {fmtTime(group.startTime)}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          - {fmtTime(group.endTime)}
                        </span>
                      </div>
                      <div className="text-sm leading-relaxed text-foreground">
                        {twToCn(group.text)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : task.transcript?.full_text ? (
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {twToCn(task.transcript.full_text)}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                暂无转写原文
              </div>
            )
          )}
        </div>
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

      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        task={task}
        selectedContent={selectedContent}
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

interface Seg { start: number; end: number; text: string }

function groupSegments(segments: Seg[]) {
  if (!segments.length) return []

  // Step 1: 根据总时长确定每组目标时长
  const totalDuration = segments[segments.length - 1].end - segments[0].start
  let targetDuration: number
  if (totalDuration < 180) targetDuration = 30        // <3min
  else if (totalDuration < 600) targetDuration = 45    // 3-10min
  else if (totalDuration < 1800) targetDuration = 60   // 10-30min
  else if (totalDuration < 3600) targetDuration = 90   // 30-60min
  else if (totalDuration < 10800) targetDuration = 120 // 1-3hr
  else targetDuration = 180                            // >3hr

  // Step 2: 计算间隙阈值（2.5倍中位数，至少2秒）
  const gaps: number[] = []
  for (let i = 1; i < segments.length; i++) {
    gaps.push(Math.max(0, segments[i].start - segments[i - 1].end))
  }
  const sortedGaps = [...gaps].sort((a, b) => a - b)
  const medianGap = sortedGaps[Math.floor(sortedGaps.length / 2)] || 1
  const gapThreshold = Math.max(medianGap * 2.5, 2.0)

  // Step 3: 遍历分组
  const groups: { startTime: number; endTime: number; text: string }[] = []
  let cur: { startTime: number; endTime: number; texts: string[] } | null = null

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    const gap = i > 0 ? Math.max(0, seg.start - segments[i - 1].end) : 0

    if (!cur) {
      cur = { startTime: seg.start, endTime: seg.end, texts: [seg.text] }
      continue
    }

    const groupDuration = seg.end - cur.startTime

    // 自然停顿 + 已有足够内容 → 断开
    if (gap > gapThreshold && groupDuration >= targetDuration * 0.7) {
      groups.push({ startTime: cur.startTime, endTime: cur.endTime, text: cur.texts.join(' ') })
      cur = { startTime: seg.start, endTime: seg.end, texts: [seg.text] }
      continue
    }

    // 超长强制断开
    if (groupDuration >= targetDuration * 1.5) {
      groups.push({ startTime: cur.startTime, endTime: cur.endTime, text: cur.texts.join(' ') })
      cur = { startTime: seg.start, endTime: seg.end, texts: [seg.text] }
      continue
    }

    cur.endTime = seg.end
    cur.texts.push(seg.text)
  }

  if (cur) {
    groups.push({ startTime: cur.startTime, endTime: cur.endTime, text: cur.texts.join(' ') })
  }

  // Step 4: 合并过短的组（<20字）
  if (!groups.length) return groups
  const result = [groups[0]]
  for (let i = 1; i < groups.length; i++) {
    const last = result[result.length - 1]
    if (groups[i].text.length < 20) {
      last.endTime = groups[i].endTime
      last.text += ' ' + groups[i].text
    } else {
      result.push(groups[i])
    }
  }

  return result
}

function fmtTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function ScreenshotImg({ taskId, time }: { taskId: string; time: number }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const src = `${getBaseURL()}/api/screenshot/${taskId}?t=${Math.floor(time)}`

  if (error) return null

  return (
    <div className="relative w-full aspect-video bg-muted/50">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
      <img
        src={src}
        alt={`截图 ${fmtTime(time)}`}
        className="w-full h-full object-cover"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
    </div>
  )
}
