import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Trash2, GripVertical, Sparkles, Settings2, LoaderCircle, FolderOpen,
  SquarePlus, Share2, Brain, Map, Pencil, ArrowUpDown, MoreHorizontal,
  RotateCcw, SlidersHorizontal, Download, AlertCircle, ListVideo,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCollectionStore } from '@/store/collectionStore'
import { shareCollection as apiShare, unshareCollection as apiUnshare, editCollectionSummary as apiEditSummary, updateItemsOrder as apiUpdateItemsOrder } from '@/services/collection'
import { toast } from 'sonner'
import { useModelStore } from '@/store/modelStore'
import { useProviderStore } from '@/store/providerStore'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import { SummarySettings, type LocalSummaryValues } from '@/components/SummarySettings'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { ExportDialog } from '@/components/ExportDialog'
import { TrajectoryTimeline } from './components/TrajectoryTimeline'
import { TrajectorySummaryCard } from './components/TrajectorySummaryCard'

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentDetail, loading, generating, fetchDetail, removeItem, generateSummary, updateCollection } = useCollectionStore()
  const { provider: providers, fetchProviderList } = useProviderStore()
  const { modelList, loadEnabledModels } = useModelStore()

  // 总结设置对话框
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 导出对话框
  const [exportOpen, setExportOpen] = useState(false)

  // 本地总结设置值（初始值从全局设置继承）
  const globalSettings = useSummarySettingsStore()
  const [localSettings, setLocalSettings] = useState<LocalSummaryValues>({
    summaryMode: globalSettings.summaryMode,
    style: globalSettings.style,
    outputLanguage: globalSettings.outputLanguage,
    videoUnderstanding: globalSettings.videoUnderstanding,
    videoInterval: globalSettings.videoInterval,
    gridCols: globalSettings.gridCols,
    gridRows: globalSettings.gridRows,
    selectedFormats: globalSettings.selectedFormats,
    extras: globalSettings.extras,
  })

  // 编辑信息
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')

  // 编辑视频（管理合集条目）
  const [manageVideosOpen, setManageVideosOpen] = useState(false)

  // 编辑总结
  const [editingSummary, setEditingSummary] = useState(false)
  const [editSummaryContent, setEditSummaryContent] = useState('')


  useEffect(() => {
    if (id) fetchDetail(id)
  }, [id])

  useEffect(() => {
    if (providers.length === 0) fetchProviderList()
    if (modelList.length === 0) loadEnabledModels()
  }, [])

  useEffect(() => {
    if (currentDetail) {
      setEditName(currentDetail.name)
      setEditDesc(currentDetail.description || '')
    }
  }, [currentDetail])

  // 当前总结的模式变化时，同步到「总结设置」弹窗（用户未重新生成前保留其选择）
  const currentSummaryMode = currentDetail?.summary?.summary_mode
  useEffect(() => {
    if (currentSummaryMode && ['overview', 'comparison', 'timeline', 'mindmap', 'trajectory'].includes(currentSummaryMode)) {
      setLocalSettings(prev => ({ ...prev, summaryMode: currentSummaryMode }))
    }
  }, [currentSummaryMode])

  const handleRemoveItem = async (taskId: string) => {
    if (!id) return
    await removeItem(id, taskId)
  }

  const handleMoveItem = async (taskId: string, direction: 'up' | 'down') => {
    if (!id) return
    const items = currentDetail?.items ?? []
    const idx = items.findIndex(i => i.task_id === taskId)
    if (idx < 0) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= items.length) return
    const next = [...items]
    ;[next[idx], next[targetIdx]] = [next[targetIdx], next[idx]]
    await apiUpdateItemsOrder(id, next.map(i => i.task_id))
    await fetchDetail(id)
  }

  const handleGenerate = async (mode?: string) => {
    if (!id) return
    await generateSummary(id, localSettings.style, undefined, undefined, localSettings.extras, mode ?? localSettings.summaryMode)
  }

  const handleSaveEdit = async () => {
    if (!id) return
    await updateCollection(id, { name: editName, description: editDesc })
    setEditOpen(false)
    fetchDetail(id)
  }

  // 时间轴列宽拖拽调整（trajectory 左右布局）
  const timelineRef = useRef<HTMLDivElement>(null)
  const [timelineWidth, setTimelineWidth] = useState(360)
  const [isResizing, setIsResizing] = useState(false)

  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const container = timelineRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setIsResizing(true)
    document.body.style.userSelect = 'none'
    const onMove = (ev: PointerEvent) => {
      setTimelineWidth(Math.min(560, Math.max(260, ev.clientX - rect.left)))
    }
    const onUp = () => {
      setIsResizing(false)
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (loading && !currentDetail) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!currentDetail) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <p className="text-muted-foreground">合集不存在</p>
        <Button variant="link" onClick={() => navigate('/library')}>返回合集列表</Button>
      </div>
    )
  }

  const summary = currentDetail.summary

  return (
    <div className="h-full overflow-auto p-4 md:p-6 space-y-5">
      {/* ====== 1. 页面头部 ====== */}
      <div className="space-y-4">
        {/* 移动端返回 */}
        <div className="flex items-center gap-2 md:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/library')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium text-base truncate">{currentDetail.name}</span>
        </div>

        {/* 头部卡片 */}
        <div className="flex items-start gap-4">
          <Button variant="outline" size="sm" className="hidden md:flex shrink-0" onClick={() => navigate('/library')}>
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold truncate">{currentDetail.name}</h1>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground">
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>编辑合集</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-sm font-medium">名称</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} className="mt-1.5" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">描述</label>
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="mt-1.5" rows={3} />
                    </div>
                    <Button onClick={handleSaveEdit} className="w-full">保存</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            {currentDetail.description && (
              <p className="text-sm text-muted-foreground mt-1">{currentDetail.description}</p>
            )}
          </div>
        </div>

        {/* 操作按钮行 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="h-8" onClick={() => navigate('/notes')}>
            <SquarePlus className="w-4 h-4 mr-1.5" />
            批量添加
          </Button>
          <Button variant="outline" size="sm" className="h-8" onClick={async () => {
            if (!id) return
            const token = await useCollectionStore.getState().shareCollection(id)
            if (token) {
              const url = `${window.location.origin}/library/${id}?share=${token}`
              try { await navigator.clipboard.writeText(url); toast.success('分享链接已复制') }
              catch { toast.info(`分享链接: ${url}`) }
            }
          }}>
            <Share2 className="w-4 h-4 mr-1.5" />
            分享合集
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="w-4 h-4 mr-2" />编辑信息
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setManageVideosOpen(true)}>
                <ListVideo className="w-4 h-4 mr-2" />编辑视频
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={async () => {
                if (!id) return
                if (!confirm('确定删除此合集？')) return
                await useCollectionStore.getState().deleteCollection(id)
                navigate('/library')
              }}>
                <Trash2 className="w-4 h-4 mr-2" />删除合集
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ====== 2. AI 总结区 ====== */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-violet-500" />
            <span className="text-sm font-medium">归纳总结</span>
          </div>
          {summary?.content && (
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setExportOpen(true)}>
                <Download className="w-3.5 h-3.5 mr-1" />导出
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => handleGenerate('mindmap')} disabled={generating}>
                <Map className="w-3.5 h-3.5 mr-1" />思维导图
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => {
                if (!summary?.content) return
                setEditSummaryContent(summary.content)
                setEditingSummary(true)
              }}>
                <Pencil className="w-3.5 h-3.5 mr-1" />编辑总结
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleGenerate}
                disabled={generating}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                {generating ? '生成中...' : '重新总结'}
              </Button>
            </div>
          )}
        </div>

        {/* 内容已变更提醒 */}
        {currentDetail.summary_stale && summary?.content && !editingSummary && (
          <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-500">
            <AlertCircle className="size-4 shrink-0" />
            <span>合集内容已变更（新增/删除了笔记），当前总结可能已过时</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-yellow-600 hover:text-yellow-700 dark:text-yellow-500"
              onClick={handleGenerate}
              disabled={generating}
            >
              重新生成
            </Button>
          </div>
        )}

        {editingSummary ? (
          <div className="space-y-2">
            <Textarea value={editSummaryContent} onChange={e => setEditSummaryContent(e.target.value)} className="min-h-[200px]" />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => setEditingSummary(false)}>取消</Button>
              <Button size="sm" onClick={async () => {
                if (!id) return
                await apiEditSummary(id, editSummaryContent)
                await fetchDetail(id)
                setEditingSummary(false)
                toast.success('总结已保存')
              }}>保存</Button>
            </div>
          </div>
        ) : summary?.content ? (
          summary.summary_mode === 'trajectory' ? (
            /* trajectory：左时间轴（可拖拽调宽）+ 右分析报告，大屏并排、小屏堆叠 */
            <div className="relative flex flex-col lg:flex-row gap-4 items-start">
              {currentDetail.items.length > 0 && (
                <div
                  ref={timelineRef}
                  className="relative w-full lg:w-[var(--tlw)] shrink-0 rounded-lg border border-border bg-card/50 p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto"
                  style={{ '--tlw': `${timelineWidth}px` } as React.CSSProperties}
                >
                  <TrajectoryTimeline
                    items={currentDetail.items}
                    onSelect={(taskId) => navigate(`/notes/${taskId}`)}
                  />
                </div>
              )}
              {/* 拖拽分隔条（跟随左列右缘，双击复位） */}
              <div
                className="absolute hidden lg:block z-10 w-[14px] cursor-col-resize"
                style={{ left: `calc(${timelineWidth}px - 7px)` }}
                onPointerDown={startResize}
                onDoubleClick={() => setTimelineWidth(360)}
                title="拖动调整时间轴宽度，双击复位"
              >
                <div
                  className={cn(
                    "absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-border/70 transition-colors",
                    isResizing ? "bg-primary/60" : "hover:bg-primary/40"
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <TrajectorySummaryCard content={summary.content} />
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg bg-muted/30 p-4">
              <ReactMarkdown>{summary.content}</ReactMarkdown>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center py-8 text-muted-foreground">
            {generating ? (
              <>
                <LoaderCircle className="w-8 h-8 mb-2 animate-spin text-violet-500" />
                <p className="text-sm">AI 正在分析合集内容...</p>
              </>
            ) : (
              <>
                <p className="text-sm mb-3">AI 将分析合集内所有视频内容，生成结构化总结</p>
                <Button
                  onClick={handleGenerate}
                  disabled={currentDetail.items.length === 0}
                  className="bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 text-white"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  立即总结
                </Button>
              </>
            )}
          </div>
        )}

        {/* 总结设置按钮 */}
        <div className="pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setSettingsOpen(true)}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            总结设置
          </Button>
        </div>
      </div>

      {/* 总结设置对话框 */}
      <SummarySettings
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        mode="local"
        localValues={localSettings}
        onLocalChange={setLocalSettings}
      />

      {/* 导出对话框 — 复用笔记详情的导出组件 */}
      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        selectedContent={summary?.content || ''}
        collectionId={id}
        collectionTitle={currentDetail?.name || '合集总结'}
      />

      {/* ====== 3. 内容统计栏 ====== */}
      <div className="flex items-center justify-between gap-3 py-2 border-b">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {currentDetail.items.length} 个内容
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1" />排序
          </Button>
        </div>
      </div>

      {/* ====== 4. 条目列表 ====== */}
      {currentDetail.items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mb-3 opacity-30" />
          <p className="text-sm font-medium">暂无视频</p>
          <p className="text-xs mt-1">从笔记列表添加视频到合集</p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentDetail.items.map(item => (
            <div
              key={item.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-xl border border-border bg-card",
                "hover:bg-accent/40 transition-colors group"
              )}
            >
              {/* 拖拽手柄 */}
              <div className="pt-1 cursor-grab text-muted-foreground/40 hover:text-muted-foreground">
                <GripVertical className="w-4 h-4" />
              </div>

              {/* 缩略图 */}
              <div className="w-24 h-14 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                {item.cover_url ? (
                  <img src={item.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                )}
                {/* 作者叠加 */}
                {item.author && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-0.5">
                    <span className="text-[10px] text-white truncate block">{item.author}</span>
                  </div>
                )}
              </div>

              {/* 信息 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate hover:text-blue-500 cursor-pointer transition-colors" onClick={() => navigate(`/notes/${item.task_id}`)}>{item.title || '无标题'}</p>
                {item.platform && (
                  <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    {item.platform}
                  </span>
                )}
              </div>

              {/* 删除按钮 */}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveItem(item.task_id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* ====== 编辑合集视频对话框 ====== */}
      <Dialog open={manageVideosOpen} onOpenChange={setManageVideosOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>编辑合集视频</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2 max-h-[420px] overflow-y-auto">
            {(currentDetail?.items ?? []).length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">合集暂无视频</p>
            ) : (
              (currentDetail?.items ?? []).map((item, idx, arr) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
                >
                  <div className="w-16 h-10 rounded-md overflow-hidden bg-muted shrink-0">
                    {item.cover_url ? (
                      <img src={item.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FolderOpen className="w-4 h-4 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title || '无标题'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.platform && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                          {item.platform}
                        </span>
                      )}
                      {item.created_at && (
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50"
                      disabled={idx === 0}
                      onClick={() => handleMoveItem(item.task_id, 'up')}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/50"
                      disabled={idx === arr.length - 1}
                      onClick={() => handleMoveItem(item.task_id, 'down')}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground/40 hover:text-destructive"
                      onClick={() => handleRemoveItem(item.task_id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted-foreground">
              {currentDetail?.items.length ?? 0} 个视频 · 可用↑↓调整顺序
            </span>
            <Button size="sm" onClick={() => setManageVideosOpen(false)}>完成</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CollectionDetail
