import { FC, useState, useEffect, useRef, useMemo } from 'react'
import {
  Download,
  RotateCw,
  Trash2,
  FolderPlus,
  Search,
  LoaderCircle,
  Play,
  Rss,
  ChevronDown,
  FileText,
  Sparkles,
  X,
  LayoutList,
  LayoutGrid,
  Columns3,
} from 'lucide-react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type VisibilityState,
  type SortingState,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getTasks, delete_task, generateNote } from '@/services/note'
import { TableSkeleton } from '@/components/Skeletons'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '@/components/ConfirmDialog'
import { getBaseURL } from '@/utils/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSystemStore } from '@/store/configStore'
import { useTaskStore, type Task } from '@/store/taskStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { quickViewNote } from '@/services/subscription'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { getColumns, type NoteItem, PlatformIconSmall } from './columns'

const getProxiedCoverUrl = (coverUrl: string, platform: string) => {
  if (!coverUrl) return ''
  const isLocal = platform === 'local' || platform === 'local_audio'
  if (isLocal) return coverUrl
  return `/api/image_proxy?url=${encodeURIComponent(coverUrl)}`
}

function NoteEmptyState({ onQuickAdd }: { onQuickAdd: () => void }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileText />
        </EmptyMedia>
        <EmptyTitle>暂无笔记</EmptyTitle>
        <EmptyDescription>
          生成笔记后将显示在这里
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center gap-2">
        <Button variant="outline" onClick={() => window.open('/', '_self')}>
          浏览首页
        </Button>
      </EmptyContent>
    </Empty>
  )
}

// 根据 taskStore 获取实时状态
function getRealtimeStatus(item: NoteItem, taskStoreTasks: { id: string; status: string }[]): string {
  const storeTask = taskStoreTasks.find(t => t.id === item.task_id)
  return storeTask?.status || item.status
}

// 瀑布流卡片 - 带笔记内容懒加载（参考设计样式）
function MasonryNoteCard({
  item,
  onClick,
  onDelete,
  onPlay,
  onSubscribe,
  isSubscribed,
  failedCovers,
  handleCoverError,
  realtimeStatus,
}: {
  item: NoteItem
  onClick: () => void
  onDelete: () => void
  onPlay: () => void
  onSubscribe: () => void
  isSubscribed: boolean
  failedCovers: Set<string>
  handleCoverError: (id: string) => void
  realtimeStatus: string
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [notePreview, setNotePreview] = useState<string | null>(null)
  const [loadingNote, setLoadingNote] = useState(false)
  const fetched = useRef(false)

  const isSuccess = realtimeStatus === 'SUCCESS'

  useEffect(() => {
    if (!cardRef.current || !isSuccess) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !fetched.current) {
          fetched.current = true
          setLoadingNote(true)
          quickViewNote(item.task_id)
            .then(res => {
              if (res?.markdown) setNotePreview(res.markdown.slice(0, 500))
            })
            .catch(() => {})
            .finally(() => setLoadingNote(false))
        }
      },
      { rootMargin: '200px' }
    )
    observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [item.task_id, isSuccess])

  return (
    <div
      ref={cardRef}
      className="group rounded-xl border bg-card overflow-hidden cursor-pointer transition-shadow hover:shadow-md mb-4 break-inside-avoid"
      onClick={onClick}
    >
      {/* 封面 */}
      <div className="relative aspect-video bg-muted overflow-hidden">
        {item.cover && !failedCovers.has(item.id) ? (
          <img
            src={item.cover}
            alt=""
            className="w-full h-full object-cover"
            onError={() => handleCoverError(item.id)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-1">
            <PlatformIconSmall platform={item.platform} />
          </div>
        )}
        {(realtimeStatus === 'PENDING' || realtimeStatus === 'RUNNING' || realtimeStatus === 'QUEUED') && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <LoaderCircle className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
        {item.author && (
          <div className="absolute bottom-0 left-0 flex items-center gap-1">
            <span className="bg-opacity-50 rounded bg-gray-800 p-1 px-2 text-sm font-bold text-white">
              {item.author}
            </span>
            {['bilibili', 'youtube', 'douyin', 'kuaishou'].includes(item.platform) && (
              <button
                className={cn(
                  'p-1 rounded transition-all',
                  isSubscribed
                    ? 'bg-primary/80 text-white'
                    : 'bg-foreground/60 text-background hover:bg-primary/80 hover:text-white'
                )}
                onClick={(e) => { e.stopPropagation(); onSubscribe() }}
              >
                <Rss className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
        <button
          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 标题 + 作者 + 笔记预览 */}
      <div className="p-4">
        <div className="text-base font-medium text-foreground line-clamp-2 leading-snug">{item.title}</div>
        {item.author && (
          <div className="mt-1 text-xs font-semibold text-sky-500">{item.author}</div>
        )}

        {/* 笔记预览 */}
        {isSuccess && (
          <div className="mt-2 relative">
            {loadingNote ? (
              <div className="space-y-1.5">
                <div className="h-2.5 bg-muted rounded w-full" />
                <div className="h-2.5 bg-muted rounded w-4/5" />
                <div className="h-2.5 bg-muted rounded w-3/5" />
              </div>
            ) : notePreview ? (
              <div className="relative max-h-48 overflow-hidden">
                <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {notePreview.replace(/[#*_\[\]>`]/g, '')}
                </div>
                {/* 底部渐变遮罩 */}
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 完整总结按钮 */}
      {isSuccess && (
        <div className="flex justify-end px-4 pb-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClick() }}
          >
            完整总结
          </Button>
        </div>
      )}
    </div>
  )
}

export const NoteListPage: FC = () => {
  const navigate = useNavigate()
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState('')
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  const [failedCovers, setFailedCovers] = useState<Set<string>>(new Set())
  const [playDialogOpen, setPlayDialogOpen] = useState(false)
  const [playItem, setPlayItem] = useState<NoteItem | null>(null)
  const [coverPreviewOpen, setCoverPreviewOpen] = useState(false)
  const [coverPreviewSrc, setCoverPreviewSrc] = useState('')
  const noteViewMode = useSystemStore(state => state.noteViewMode)
  const setNoteViewMode = useSystemStore(state => state.setNoteViewMode)
  const { subscribe, subscriptions } = useSubscriptionStore()
  const { style, outputLanguage, videoUnderstanding, videoInterval, gridCols, gridRows, selectedFormats, extras } = useSummarySettingsStore()
  const notesRef = useRef(notes)

  // 判断是否已订阅（通过作者名匹配）
  const isSubscribed = (author: string): boolean => {
    return subscriptions.some(s => s.channel_name === author)
  }

  // 是否支持订阅的平台
  const isSubscribable = (platform: string): boolean => {
    return ['bilibili', 'youtube', 'douyin', 'kuaishou'].includes(platform)
  }
  const handleCoverError = (id: string) => {
    setFailedCovers(prev => new Set(prev).add(id))
  }

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  // 监听 taskStore 中任务状态变化，有任务完成时刷新列表
  const taskStoreTasks = useTaskStore(state => state.tasks)
  useEffect(() => {
    const hasPending = taskStoreTasks.some(
      t => t.status !== 'SUCCESS' && t.status !== 'FAILED'
    )
    // 只有当前列表中有非终态任务且 store 里有完成的任务时才刷新
    if (!hasPending) return
    const completedInStore = taskStoreTasks.some(
      t => t.status === 'SUCCESS' && notesRef.current.some(n => n.task_id === t.id && n.status !== 'SUCCESS')
    )
    if (completedInStore) {
      fetchNotes()
    }
  }, [taskStoreTasks])

  const fetchNotes = async () => {
    setLoading(true)
    try {
      const response = await getTasks(100)
      if (response && response.tasks) {
        const formattedNotes = response.tasks.map((task: any) => ({
          id: task.task_id,
          task_id: task.task_id,
          cover: getProxiedCoverUrl(task.cover_url || task.note?.audio_meta?.cover_url || '', task.platform),
          platform: task.platform || 'unknown',
          title: task.title || task.note?.audio_meta?.title || task.note?.title || '无标题',
          author: task.author || task.note?.audio_meta?.raw_info?.owner?.name
            || task.note?.audio_meta?.raw_info?.uploader || '',
          note: task.note?.markdown || '',
          created_at: task.created_at || '',
          status: task.status || 'UNKNOWN',
          video_url: task.video_url || '',
        }))
        setNotes(formattedNotes)
      }
    } catch (error) {
      toast.error('获取笔记列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchNotes() }, [])

  const toggleSelectAll = () => {
    if (selectedRows.length === notes.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(notes.map(item => item.id))
    }
  }

  const toggleSelectRow = (id: string) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(rowId => rowId !== id))
    } else {
      setSelectedRows([...selectedRows, id])
    }
  }

  const handleDelete = async () => {
    try {
      await delete_task({ task_id: deleteTargetId })
      toast.success('删除成功')
      fetchNotes()
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) return
    try {
      await Promise.all(
        selectedRows.map(taskId => delete_task({ task_id: taskId }))
      )
      toast.success(`成功删除 ${selectedRows.length} 条笔记`)
      setSelectedRows([])
      setBatchDeleteDialogOpen(false)
      fetchNotes()
    } catch {
      toast.error('部分笔记删除失败')
      fetchNotes()
    }
  }

  const handleRegenerate = async (item: NoteItem) => {
    if (!item.video_url) {
      toast.error('无法获取视频链接')
      return
    }
    try {
      const payload = {
        video_url: item.video_url,
        platform: item.platform,
        task_id: item.task_id,
        quality: 'medium',
        smart_mode: true,
        model_name: '',
        provider_id: '',
        style: style || 'minimal',
        format: selectedFormats || [],
        extras: extras || '',
        video_understanding: videoUnderstanding || false,
        video_interval: videoInterval || 4,
        grid_size: [gridCols || 3, gridRows || 3],
        screenshot: selectedFormats?.includes('screenshot') || false,
        link: selectedFormats?.includes('link') || false,
        output_language: outputLanguage || 'zh',
      }
      const response = await generateNote(payload)
      if (response?.task_id) {
        // 同步更新 taskStore 状态，确保详情页能立即响应
        useTaskStore.getState().updateTaskContent(item.task_id, { status: 'PENDING' })
        toast.success('已重新提交生成任务')
        fetchNotes()
      }
    } catch {
      toast.error('重新生成失败')
    }
  }

  const handleNoteClick = (item: NoteItem) => {
    navigate(`/notes/${item.id}`)
  }

  const filteredNotes = notes.filter(note => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      note.title.toLowerCase().includes(query) ||
      note.note.toLowerCase().includes(query) ||
      note.platform.toLowerCase().includes(query)
    )
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex flex-col gap-4 p-6 shrink-0">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">总结记录</h1>
        </div>

        {/* 分隔线 */}
        <div className="h-px bg-border" />

        {/* 标签行 */}
        <div className="flex items-center justify-between">
          <Select value={noteViewMode} onValueChange={(v) => setNoteViewMode(v as 'table' | 'card' | 'masonry')}>
            <SelectTrigger className="w-[130px] hover:bg-accent">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="table"><span className="flex items-center gap-2"><LayoutList className="size-4" />表格</span></SelectItem>
              <SelectItem value="card"><span className="flex items-center gap-2"><LayoutGrid className="size-4" />卡片</span></SelectItem>
              <SelectItem value="masonry"><span className="flex items-center gap-2"><Columns3 className="size-4" />瀑布流</span></SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 工具栏 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索笔记..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-80 pl-9"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <FolderPlus className="w-4 h-4" />
              添加到合集
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              disabled={selectedRows.length === 0 || noteViewMode !== 'table'}
              title={noteViewMode !== 'table' ? '切换到表格视图进行批量删除' : ''}
              onClick={() => setBatchDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
              批量删除
            </Button>
                      </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchNotes}>
              <RotateCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </div>

      {/* 视图内容 */}
      {noteViewMode === 'table' ? (
        <DataTable
          data={filteredNotes}
          loading={loading}
          selectedRows={selectedRows}
          onSelectRow={toggleSelectRow}
          onSelectAll={toggleSelectAll}
          onRowClick={handleNoteClick}
          onDelete={(taskId) => {
            setDeleteTargetId(taskId)
            setDeleteDialogOpen(true)
          }}
          onRegenerate={handleRegenerate}
          onSubscribe={subscribe}
          failedCovers={failedCovers}
          onCoverError={handleCoverError}
          isSubscribed={isSubscribed}
          isSubscribable={isSubscribable}
          taskStoreTasks={taskStoreTasks}
        />
      ) : noteViewMode === 'card' ? (
        /* 卡片视图 */
        <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          {loading ? (
            <TableSkeleton rows={3} />
          ) : filteredNotes.length === 0 ? (
            <NoteEmptyState onQuickAdd={() => navigate('/')} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {filteredNotes.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-xl border border-border bg-background overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20"
                  onClick={() => handleNoteClick(item)}
                >
                  {/* 封面 */}
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    {item.cover && !failedCovers.has(item.id) ? (
                      <img src={item.cover} alt="" className="w-full h-full object-cover cursor-zoom-in" onError={() => handleCoverError(item.id)} onClick={(e) => { e.stopPropagation(); setCoverPreviewSrc(item.cover); setCoverPreviewOpen(true) }} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                        <PlatformIconSmall platform={item.platform} />
                      </div>
                    )}
                    {/* 加载状态 */}
                    {(item.status === 'PENDING' || item.status === 'RUNNING' || item.status === 'QUEUED') && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <LoaderCircle className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
                    {/* 播放按钮（本地文件） */}
                    {(item.platform === 'local' || item.platform === 'local_audio') && item.video_url && (
                      <button
                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPlayItem(item)
                          setPlayDialogOpen(true)
                        }}
                      >
                        <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center">
                          <Play className="w-8 h-8 text-white ml-1" />
                        </div>
                      </button>
                    )}
                    {/* 作者徽章 + 订阅按钮 */}
                    {item.author && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded text-xs text-background bg-foreground/80">
                          {item.author}
                        </span>
                        {isSubscribable(item.platform) && (
                          <button
                            className={cn(
                              "p-1 rounded transition-all",
                              isSubscribed(item.author)
                                ? "bg-primary/80 text-white"
                                : "bg-foreground/60 text-background hover:bg-primary/80 hover:text-white"
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isSubscribed(item.author)) {
                                toast.info('已订阅该频道')
                              } else {
                                subscribe(item.video_url)
                              }
                            }}
                          >
                            <Rss className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                    {/* 删除按钮 */}
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTargetId(item.task_id)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* 信息 */}
                  <div className="p-3">
                    <div className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{item.title}</div>
                    {item.author && (
                      <div className="mt-1.5 text-xs text-primary">{item.author}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* 瀑布流视图 */
        <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          {loading ? (
            <TableSkeleton rows={3} />
          ) : filteredNotes.length === 0 ? (
            <NoteEmptyState onQuickAdd={() => navigate('/')} />
          ) : (
            <div className="columns-[280px] gap-4">
              {filteredNotes.map((item) => (
                <MasonryNoteCard
                  key={item.id}
                  item={item}
                  onClick={() => handleNoteClick(item)}
                  onDelete={() => { setDeleteTargetId(item.task_id); setDeleteDialogOpen(true) }}
                  onPlay={() => { setPlayItem(item); setPlayDialogOpen(true) }}
                  onSubscribe={() => isSubscribed(item.author) ? toast.info('已订阅该频道') : subscribe(item.video_url)}
                  isSubscribed={isSubscribed(item.author)}
                  failedCovers={failedCovers}
                  handleCoverError={handleCoverError}
                  realtimeStatus={getRealtimeStatus(item, taskStoreTasks)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 播放弹窗 */}
      <Dialog open={playDialogOpen} onOpenChange={setPlayDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="truncate">{playItem?.title || '播放'}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {playItem?.platform === 'local' ? (
              <video
                src={`${getBaseURL()}${playItem.video_url}`}
                controls
                autoPlay
                className="w-full rounded-lg max-h-[70vh]"
              />
            ) : playItem?.platform === 'local_audio' ? (
              <audio
                src={`${getBaseURL()}${playItem.video_url}`}
                controls
                autoPlay
                className="w-full mt-4"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* 封面预览弹窗 */}
      <Dialog open={coverPreviewOpen} onOpenChange={setCoverPreviewOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[800px] p-0 overflow-hidden bg-black/90 border-none">
          <DialogHeader className="sr-only">
            <DialogTitle>封面预览</DialogTitle>
          </DialogHeader>
          <div className="relative">
            {coverPreviewSrc && (
              <img src={coverPreviewSrc} alt="封面预览" className="w-full" />
            )}
            <button
              type="button"
              onClick={() => setCoverPreviewOpen(false)}
              className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="size-4" />
            </button>
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

      <ConfirmDialog
        open={batchDeleteDialogOpen}
        onOpenChange={setBatchDeleteDialogOpen}
        title="删除选中笔记"
        description={`确定要删除选中的 ${selectedRows.length} 条笔记吗？此操作不可恢复。`}
        confirmText="删除"
        variant="destructive"
        onConfirm={handleBatchDelete}
      />
    </div>
  )
}

export default NoteListPage

function DataTable({
  data,
  loading,
  selectedRows,
  onSelectRow,
  onSelectAll,
  onRowClick,
  onDelete,
  onRegenerate,
  onSubscribe,
  failedCovers,
  onCoverError,
  isSubscribed,
  isSubscribable,
  taskStoreTasks,
}: {
  data: NoteItem[]
  loading: boolean
  selectedRows: string[]
  onSelectRow: (id: string) => void
  onSelectAll: () => void
  onRowClick: (item: NoteItem) => void
  onDelete: (taskId: string) => void
  onRegenerate: (item: NoteItem) => void
  onSubscribe: (url: string) => void
  failedCovers: Set<string>
  onCoverError: (id: string) => void
  isSubscribed: (author: string) => boolean
  isSubscribable: (platform: string) => boolean
  taskStoreTasks: Task[]
}) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = useMemo(
    () =>
      getColumns({
        selectedRows,
        onSelectRow,
        onSelectAll,
        onRowClick,
        onDelete,
        onRegenerate,
        onSubscribe,
        failedCovers,
        onCoverError,
        isSubscribed,
        isSubscribable,
        taskStoreTasks,
      }),
    [selectedRows, onSelectRow, onSelectAll, onRowClick, onDelete, onRegenerate, onSubscribe, failedCovers, onCoverError, isSubscribed, isSubscribable, taskStoreTasks],
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: setSorting,
    state: {
      columnVisibility,
      sorting,
    },
    initialState: {
      pagination: { pageSize: 10 },
    },
  })

  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const totalCount = table.getFilteredRowModel().rows.length

  return (
    <div className="flex-1 min-h-0 border border-border rounded-lg overflow-auto flex flex-col mx-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-sm text-muted-foreground">
          已选择 {selectedCount} 行（共 {totalCount} 行）
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              列 <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(value)}
                >
                  {column.id === 'select' ? '选择' : column.id === 'cover' ? '封面' : column.id === 'title' ? '标题' : column.id === 'note' ? '笔记' : column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-muted/50">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-48 text-center">
                <TableSkeleton rows={5} />
              </TableCell>
            </TableRow>
          ) : table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length}>
                <NoteEmptyState onQuickAdd={() => navigate('/')} />
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  'cursor-pointer transition-all duration-200',
                  selectedRows.includes(row.original.id) && 'bg-accent',
                )}
                onClick={() => onRowClick(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* 分页 */}
      <div className="flex items-center justify-between px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(value) => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50].map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span>行/页</span>
        </div>
        <div className="flex items-center justify-end space-x-2">
          <span className="text-sm text-muted-foreground">
            第 {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} 页
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            下一页
          </Button>
        </div>
      </div>
    </div>
  )
}

