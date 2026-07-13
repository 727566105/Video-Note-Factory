import { useState, useEffect, useRef } from 'react'
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
  ScrollText,
  Link,
  Share2,
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
import { ProcessingSpinner } from './processing'
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import { getBaseURL } from '@/utils/api'
import { noteStyles } from '@/constant/note'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ButtonGroup } from '@/components/ui/button-group'
import { useIsMobile } from '@/hooks/use-mobile'
import SharePosterDialog from '@/components/SharePosterDialog'

type TabKey = 'summary' | 'transcript' | 'mindmap' | 'original'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'summary', label: '全文总结' },
  { key: 'transcript', label: '字幕脚本' },
  { key: 'mindmap', label: '思维导图' },
  { key: 'original', label: '原文详情' },
]

interface RightPanelProps {
  task: Task
  isProcessing?: boolean
  processingStatus?: string
  localSettings: LocalSettings
}

export interface LocalSettings {
  style: string
  outputLanguage: string
  modelName: string
  providerId: string
  videoUnderstanding: boolean
  videoInterval: number
  gridCols: number
  gridRows: number
  selectedFormats: string[]
  extras: string
}

export default function RightPanel({ task, isProcessing, processingStatus, localSettings }: RightPanelProps) {
  const navigate = useNavigate()
  const removeTask = useTaskStore(state => state.removeTask)
  const retryTask = useTaskStore(state => state.retryTask)
  const setCurrentTask = useTaskStore(state => state.setCurrentTask)
  const loadTasksFromBackend = useTaskStore(state => state.loadTasksFromBackend)
  const modelList = useModelStore(state => state.modelList)
  const providers = useProviderStore(state => state.provider)
  const [activeTab, setActiveTab] = useState<TabKey>('summary')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
      video_understanding: localSettings.videoUnderstanding,
      video_interval: localSettings.videoInterval,
      grid_size: [localSettings.gridCols, localSettings.gridRows],
      format: localSettings.selectedFormats,
      extras: localSettings.extras,
    }

    try {
      await retryTask(task.id, payload)
      toast.success('重新生成任务已提交')

      // 轮询任务状态，完成后自动刷新页面数据
      if (pollRef.current) clearInterval(pollRef.current)
      pollRef.current = setInterval(async () => {
        try {
          await loadTasksFromBackend()
          const current = useTaskStore.getState().tasks.find(t => t.id === task.id)
          if (current && (current.status === 'SUCCESS' || current.status === 'FAILED')) {
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            if (current.status === 'SUCCESS') {
              toast.success('笔记生成完成')
            } else {
              toast.error('笔记生成失败')
            }
          }
        } catch {
          // 轮询失败不中断，继续下次轮询
        }
      }, 3000)
    } catch {
      // retryTask 内部已 toast
    }
  }

  // 组件卸载时清理轮询
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [])

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

  const isMobile = useIsMobile()

  // 移动端布局
  if (isMobile) {
    return (
      <div className="flex flex-col">
        {/* 标签栏 - 简化版 */}
        <div className="flex items-center px-3 pt-2 pb-2 shrink-0">
          <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-md">
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
                    'flex items-center justify-center h-8 px-3 rounded text-xs font-medium transition-colors whitespace-nowrap',
                    activeTab === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <TabIcon className="w-4 h-4" />
                </button>
              )
            })}
          </div>
          {/* 操作按钮 */}
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExportDialogOpen(true)}>
              <Download className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShareDialogOpen(true)} disabled={!selectedContent}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="px-3 pb-3">
          {/* 内容 - 不使用 overflow-hidden 的容器 */}
          {activeTab === 'summary' && (
            <div className="rounded-lg border border-border bg-accent/30 p-3">
              {isProcessing ? (
                <ProcessingSpinner status={processingStatus} />
              ) : selectedContent ? (
                <MarkdownRenderer content={twToCn(selectedContent)} />
              ) : (
                <div className="text-center text-muted-foreground py-8">暂无内容</div>
              )}
            </div>
          )}
          {activeTab === 'transcript' && (
            <TranscriptViewer task={task} />
          )}
          {activeTab === 'mindmap' && selectedContent && typeof selectedContent === 'string' && (
            <MarkmapEditor
              value={selectedContent}
              onChange={() => {}}
              height="400px"
              title={task.audioMeta?.title || '思维导图'}
            />
          )}
          {activeTab === 'mindmap' && (!selectedContent || typeof selectedContent !== 'string') && (
            <div className="rounded-lg border border-border bg-accent/30 p-3 text-center text-muted-foreground">暂无思维导图数据</div>
          )}
          {activeTab === 'original' && (
            <div className="rounded-lg border border-border bg-accent/30 p-3">
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>标题：</strong>{task.audioMeta?.title || task.title}</p>
                <p><strong>平台：</strong>{task.platform}</p>
                {task.audioMeta?.description && <p><strong>简介：</strong>{task.audioMeta?.description}</p>}
              </div>
            </div>
          )}
        </div>

        {/* 弹窗 */}
        <ExportDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} task={task} />
        <SharePosterDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          task={task}
          content={selectedContent}
        />
        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title="删除笔记"
          description="确定要删除这条笔记吗？"
          confirmText="删除"
          variant="destructive"
          onConfirm={handleDelete}
        />
      </div>
    )
  }

  // 桌面端布局
  return (
    <div className="flex h-full flex-col overflow-hidden bg-background/80">
      {/* 标签栏 */}
      <div data-guide="tab-bar" className="shrink-0 border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1">
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
                  'flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
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
          <div className="flex shrink-0 items-center gap-2">
            <ActionBtn icon={<Share2 className="w-3.5 h-3.5" />} label="分享" onClick={() => setShareDialogOpen(true)} disabled={!selectedContent} />
            <ActionBtn icon={<RefreshCw className={cn('w-3.5 h-3.5', isProcessing && 'animate-spin')} />} label="重新生成" onClick={handleRegenerate} disabled={isProcessing} dataGuide="regenerate-btn" />
            <ActionBtn icon={<Edit className="w-3.5 h-3.5" />} label="编辑" />
          </div>
        </div>
      </div>

      {/* 内容区 */}
      <div className="m-4 min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-background/85 shadow-sm">
        {/* Sticky 工具栏 */}
        <div data-guide="toolbar" className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur-sm">
          <div className="flex min-w-0 flex-col gap-2">
            {isMultiVersion && (
              <Select value={currentVerId} onValueChange={setCurrentVerId}>
                <SelectTrigger data-guide="version-select" className="h-8 w-[150px] text-xs">
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
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {modelName && (
                <Badge variant="secondary" className="inline-block max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap bg-pink-100 text-xs text-pink-700 hover:bg-pink-200 2xl:max-w-[240px]">
                  {modelName}
                </Badge>
              )}
              {styleName && (
                <Badge variant="secondary" className="inline-block max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap bg-cyan-100 text-xs text-cyan-700 hover:bg-cyan-200">
                  {styleName}
                </Badge>
              )}
              {createTime && (
                <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(createTime)}</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1">
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
                  <DropdownMenuItem onClick={() => {
                    const url = task.formData?.video_url || ''
                    navigator.clipboard.writeText(url)
                    toast.success(url ? '已复制视频链接' : '无可用链接')
                  }}>
                    <Link className="mr-2 h-4 w-4" /> 复制链接
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-red-600 focus:text-red-600">
                    <Trash className="mr-2 h-4 w-4" /> 删除笔记
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          </div>
        </div>

        {/* 内容区域 */}
        <div className={cn("p-4 md:p-6", activeTab === 'summary' && "mx-auto max-w-4xl", activeTab === 'mindmap' && "h-[600px] max-w-none")}>
          {isProcessing && processingStatus ? (
            <ProcessingSpinner status={processingStatus} />
          ) : activeTab === 'summary' ? (
            <MarkdownRenderer content={selectedContent} />
          ) : activeTab === 'transcript' ? (
            <TranscriptViewer />
          ) : activeTab === 'mindmap' ? (
            selectedContent && typeof selectedContent === 'string' ? (
              <MarkmapEditor
                value={selectedContent}
                onChange={() => {}}
                height="100%"
                title={task.audioMeta?.title || '思维导图'}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                暂无思维导图数据
              </div>
            )
          ) : activeTab === 'original' ? (
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
          ) : null}
        </div>
      </div>

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
      <SharePosterDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        task={task}
        content={selectedContent}
      />
    </div>
  )
}

function ActionBtn({
  icon,
  label,
  highlight,
  onClick,
  dataGuide,
  disabled,
}: {
  icon: React.ReactNode
  label?: string
  highlight?: boolean
  onClick?: () => void
  dataGuide?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      data-guide={dataGuide}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs transition-colors disabled:pointer-events-none disabled:opacity-45',
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
