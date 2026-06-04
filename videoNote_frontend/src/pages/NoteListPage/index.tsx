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
  Rows4,
  Filter,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { useSystemStore } from '@/store/configStore'
import { useTaskStore, type Task } from '@/store/taskStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { quickViewNote } from '@/services/subscription'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { getColumns, type NoteItem, PlatformIconSmall } from './columns'
import { TagEditorPopover } from '@/components/TagEditorPopover'
import { Badge } from '@/components/ui/badge'
import { MultiSelectFilter, type FilterOption } from '@/components/MultiSelectFilter'
import { AuthorFilter } from '@/components/AuthorFilter'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, XiaohongshuLogo, CCTVLogo, LocalLogo, AudioLogo } from '@/components/Icons/platform'
import { getAuthors, type AuthorInfo } from '@/services/author'
import { useIsMobile } from '@/hooks/use-mobile'

// 平台筛选选项
const PLATFORM_OPTIONS: FilterOption[] = [
  { value: 'bilibili', label: 'B站' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'douyin', label: '抖音' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'kuaishou', label: '快手' },
  { value: 'local', label: '本地视频' },
  { value: 'local_audio', label: '本地音频' },
]

// 状态筛选选项
const STATUS_OPTIONS: FilterOption[] = [
  { value: 'SUCCESS', label: '成功' },
  { value: 'FAILED', label: '失败' },
  { value: 'PENDING', label: '等待中' },
  { value: 'QUEUED', label: '排队中' },
  { value: 'PARSING', label: '解析中' },
  { value: 'DOWNLOADING', label: '下载中' },
  { value: 'TRANSCRIBING', label: '转写中' },
  { value: 'SUMMARIZING', label: '总结中' },
  { value: 'SAVING', label: '保存中' },
]

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

function getRealtimeStatus(item: NoteItem, taskStoreTasks: { id: string; status: string }[]): string {
  const storeTask = taskStoreTasks.find(t => t.id === item.task_id)
  return storeTask?.status || item.status
}

const isProcessingStatus = (status: string) =>
  ['PENDING', 'QUEUED', 'PARSING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'FORMATTING', 'SAVING'].includes(status)

// 平台名称映射
const platformLabel: Record<string, string> = {
  bilibili: 'B站',
  youtube: 'YouTube',
  douyin: '抖音',
  xiaohongshu: '小红书',
  kuaishou: '快手',
  cctv: '央视网',
  local: '本地视频',
  local_audio: '本地音频',
}

// 平台图标映射（封面叠加层用）
const platformIconMap: Record<string, React.ReactNode> = {
  bilibili: <BiliBiliLogo className="w-3.5 h-3.5" />,
  youtube: <YoutubeLogo className="w-3.5 h-3.5" />,
  douyin: <DouyinLogo className="w-3.5 h-3.5" />,
  kuaishou: <KuaishouLogo className="w-3.5 h-3.5" />,
  xiaohongshu: <XiaohongshuLogo className="w-3.5 h-3.5" />,
  cctv: <CCTVLogo className="w-3.5 h-3.5" />,
  local: <LocalLogo className="w-3.5 h-3.5" />,
  local_audio: <AudioLogo className="w-3.5 h-3.5" />,
}

// 标签显示行（圆角胶囊样式 + # 前缀）
function TagsRow({ item, onTagsUpdate }: { item: NoteItem; onTagsUpdate: (id: string, tags: any) => void }) {
  const hasTags = (item.tags?.platform_tags?.length || 0) > 0 || (item.tags?.ai_tags?.length || 0) > 0 || (item.tags?.manual_tags?.length || 0) > 0
  return (
    <div className="flex gap-2 flex-wrap items-center mt-2" onClick={e => e.stopPropagation()}>
      {/* 平台标签 - 蓝色 */}
      {item.tags?.platform_tags?.map((tag, i) => (
        <span key={`p${i}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
          {tag}
        </span>
      ))}
      {/* AI 标签 - 紫色 */}
      {item.tags?.ai_tags?.map((tag, i) => (
        <span key={`a${i}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100">
          #{tag}
        </span>
      ))}
      {/* 手动标签 - 绿色 */}
      {item.tags?.manual_tags?.map((tag, i) => (
        <span key={`m${i}`} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors cursor-pointer bg-green-50 text-green-600 border-green-200 hover:bg-green-100">
          #{tag}
        </span>
      ))}
      {/* 编辑按钮 */}
      <TagEditorPopover
        taskId={item.task_id}
        tags={item.tags}
        onUpdate={(newTags) => onTagsUpdate(item.id, newTags)}
        hideTrigger
      />
    </div>
  )
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
  onTagsUpdate,
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
  onTagsUpdate: (id: string, tags: any) => void
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
        {isProcessingStatus(realtimeStatus) && (
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
        {/* 平台标识 */}
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-foreground/60 flex items-center justify-center">
          {platformIconMap[item.platform] || <LocalLogo className="w-3.5 h-3.5" />}
        </div>
        <button
          className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all z-10"
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

        {/* 标签 */}
        <TagsRow item={item} onTagsUpdate={onTagsUpdate} />

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
  const isMobile = useIsMobile()
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  // 筛选状态
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([])
  const [authors, setAuthors] = useState<AuthorInfo[]>([])
  const [deleteTargetId, setDeleteTargetId] = useState('')
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false)
  const [failedCovers, setFailedCovers] = useState<Set<string>>(new Set())
  const [playDialogOpen, setPlayDialogOpen] = useState(false)
  const [playItem, setPlayItem] = useState<NoteItem | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const localStorageViewMode = useSystemStore(state => state.noteViewMode)
  const setNoteViewMode = useSystemStore(state => state.setNoteViewMode)
  // 移动端自动使用卡片视图，桌面端使用 localStorage 存储
  const noteViewMode = isMobile ? 'card' : (localStorageViewMode || 'table')
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
  const handleTagsUpdate = (id: string, tags: any) => {
    setNotes(prev => prev.map(note => note.id === id ? { ...note, tags } : note))
  }

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  // 用 ref 记录上次各任务的状态，只在任务完成时触发一次刷新（非定时轮询）
  const prevStatusRef = useRef<Map<string, string>>(new Map())
  const taskStoreTasks = useTaskStore(state => state.tasks)
  useEffect(() => {
    const currentStatuses = new Map<string, string>()
    for (const t of taskStoreTasks) {
      currentStatuses.set(t.id, t.status)
    }

    // 检测是否有任务刚完成（上一次不是 SUCCESS，现在是 SUCCESS）
    const justCompleted = taskStoreTasks.some(t => {
      const prevStatus = prevStatusRef.current.get(t.id)
      return t.status === 'SUCCESS' && prevStatus !== undefined && prevStatus !== 'SUCCESS'
    })

    prevStatusRef.current = currentStatuses

    if (justCompleted) {
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
          author: task.author || task.author_name || task.note?.audio_meta?.raw_info?.owner?.name
            || task.note?.audio_meta?.raw_info?.uploader || '',
          note: task.note?.versions?.[0]?.content || task.note?.markdown || '',
          created_at: task.created_at || '',
          status: task.status || 'UNKNOWN',
          video_url: task.video_url || '',
          tags: task.tags ? (() => {
            try {
              return JSON.parse(task.tags)
            } catch {
              return undefined
            }
          })() : undefined,
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

  // 加载博主列表
  useEffect(() => {
    getAuthors().then(res => {
      if (res?.authors) setAuthors(res.authors)
    }).catch(() => {})
  }, [])

  // 博主筛选选项（带笔记数量）
  const authorOptions: FilterOption[] = useMemo(() => {
    if (authors.length === 0) {
      // 从笔记列表中提取去重博主作为 fallback
      const authorMap = new Map<string, number>()
      for (const n of notes) {
        if (n.author) {
          authorMap.set(n.author, (authorMap.get(n.author) || 0) + 1)
        }
      }
      return Array.from(authorMap.entries()).map(([name, count]) => ({
        value: name, label: name, count,
      }))
    }
    return authors.map(a => ({
      value: a.author_name,
      label: a.author_name,
      count: a.video_count,
    }))
  }, [authors, notes])

  // 筛选器已选数量
  const totalSelectedFilters = selectedAuthors.length + selectedPlatforms.length + selectedStatuses.length

  const toggleSelectAll = (pageIds: string[]) => {
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedRows.includes(id))
    if (allPageSelected) {
      setSelectedRows([])
    } else {
      setSelectedRows(pageIds)
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
    // 文本搜索
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!note.title.toLowerCase().includes(query) &&
          !note.note.toLowerCase().includes(query) &&
          !note.platform.toLowerCase().includes(query)) {
        return false
      }
    }
    // 平台筛选
    if (selectedPlatforms.length > 0 && !selectedPlatforms.includes(note.platform)) {
      return false
    }
    // 状态筛选
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(note.status)) {
      return false
    }
    // 博主筛选
    if (selectedAuthors.length > 0 && !selectedAuthors.includes(note.author)) {
      return false
    }
    return true
  })

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex flex-col gap-3 p-4 md:p-6 md:gap-4 shrink-0">
        {/* 标题行 - 仅桌面端显示 */}
        {!isMobile && (
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">笔记列表</h1>
          </div>
        )}

        {/* 分隔线 */}
        <div className="h-px bg-border" />

        {/* 标签行 - 移动端隐藏视图切换 */}
        {!isMobile && (
          <div className="flex items-center justify-between">
            <Select value={localStorageViewMode} onValueChange={(v) => setNoteViewMode(v as 'table' | 'card' | 'masonry' | 'compact')}>
              <SelectTrigger className="w-[150px] hover:bg-accent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="table"><span className="flex items-center gap-2"><LayoutList className="size-4" />表格</span></SelectItem>
                <SelectItem value="card"><span className="flex items-center gap-2"><LayoutGrid className="size-4" />卡片</span></SelectItem>
                <SelectItem value="compact"><span className="flex items-center gap-2"><Rows4 className="size-4" />紧凑</span></SelectItem>
                <SelectItem value="masonry"><span className="flex items-center gap-2"><Columns3 className="size-4" />瀑布流</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 工具栏 */}
        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <div className="relative flex-1 md:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索笔记..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:max-w-80 pl-9"
              />
            </div>
            {/* 筛选组件 - 桌面端 */}
            <div className="hidden md:flex items-center gap-3">
              <AuthorFilter
                options={authorOptions}
                selected={selectedAuthors}
                onChange={setSelectedAuthors}
              />
              <MultiSelectFilter
                label="平台"
                options={PLATFORM_OPTIONS}
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
              <MultiSelectFilter
                label="状态"
                options={STATUS_OPTIONS}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
              />
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

            {/* 移动端筛选按钮 */}
            <Button
              variant="outline"
              size="sm"
              className="md:hidden gap-1.5"
              onClick={() => setFilterSheetOpen(true)}
            >
              <Filter className="w-4 h-4" />
              筛选
              {totalSelectedFilters > 0 && (
                <Badge variant="secondary" className="ml-0.5 h-5 px-1">{totalSelectedFilters}</Badge>
              )}
            </Button>
          </div>

          {/* 刷新按钮 */}
          <Button variant="outline" size="icon" className="h-8 w-8 hidden md:flex" onClick={fetchNotes}>
            <RotateCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 md:hidden" onClick={fetchNotes}>
            <RotateCw className={cn("w-4 h-4", loading && "animate-spin")} />
          </Button>
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
          onTagsUpdate={handleTagsUpdate}
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
                      <img src={item.cover} alt="" className="w-full h-full object-cover" onError={() => handleCoverError(item.id)} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                        <PlatformIconSmall platform={item.platform} />
                      </div>
                    )}
                    {/* 加载状态 */}
                    {isProcessingStatus(getRealtimeStatus(item, taskStoreTasks)) && (
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
                    {/* 平台标识 */}
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-foreground/60 flex items-center justify-center">
                      {platformIconMap[item.platform] || <LocalLogo className="w-3.5 h-3.5" />}
                    </div>
                    {/* 删除按钮 */}
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all z-10"
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
                    {/* 标签 */}
                    <div className="mt-2" onClick={e => e.stopPropagation()}>
                      <TagsRow item={item} onTagsUpdate={handleTagsUpdate} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : noteViewMode === 'compact' ? (
        /* 紧凑视图 */
        <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          {loading ? (
            <TableSkeleton rows={3} />
          ) : filteredNotes.length === 0 ? (
            <NoteEmptyState onQuickAdd={() => navigate('/')} />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {filteredNotes.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-xl border border-border bg-background overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20"
                  onClick={() => handleNoteClick(item)}
                >
                  {/* 封面 */}
                  <div className="relative aspect-video bg-muted overflow-hidden">
                    {item.cover && !failedCovers.has(item.id) ? (
                      <img src={item.cover} alt="" className="w-full h-full object-cover" onError={() => handleCoverError(item.id)} />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1">
                        <PlatformIconSmall platform={item.platform} />
                      </div>
                    )}
                    {isProcessingStatus(getRealtimeStatus(item, taskStoreTasks)) && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <LoaderCircle className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                    {/* 作者徽章 */}
                    {item.author && (
                      <div className="absolute bottom-1 left-1 flex items-center gap-1">
                        <span className="px-1.5 py-0.5 rounded text-[10px] text-background bg-foreground/80 line-clamp-1 max-w-[80%]">
                          {item.author}
                        </span>
                      </div>
                    )}
                    {/* 平台标识 */}
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-foreground/60 flex items-center justify-center">
                      {platformIconMap[item.platform] || <LocalLogo className="w-3 h-3" />}
                    </div>
                    {/* 删除按钮 */}
                    <button
                      className="absolute top-1.5 right-1.5 p-1 rounded-md bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all z-10"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeleteTargetId(item.task_id)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  {/* 信息 */}
                  <div className="p-2">
                    <div className="text-xs font-medium text-foreground line-clamp-2 leading-snug">{item.title}</div>
                    {item.author && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground truncate">{item.author}</div>
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
                  onTagsUpdate={handleTagsUpdate}
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

      {/* 移动端筛选 Sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="h-[60vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>筛选条件</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">博主</label>
              <AuthorFilter
                options={authorOptions}
                selected={selectedAuthors}
                onChange={setSelectedAuthors}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">平台</label>
              <MultiSelectFilter
                label="平台"
                options={PLATFORM_OPTIONS}
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">状态</label>
              <MultiSelectFilter
                label="状态"
                options={STATUS_OPTIONS}
                selected={selectedStatuses}
                onChange={setSelectedStatuses}
              />
            </div>
          </div>
          <SheetFooter className="flex-row gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedAuthors([])
                setSelectedPlatforms([])
                setSelectedStatuses([])
              }}
            >
              清除筛选
            </Button>
            <Button onClick={() => setFilterSheetOpen(false)}>
              应用
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
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
  onTagsUpdate,
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
  onTagsUpdate: (id: string, tags: any) => void
}) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [sorting, setSorting] = useState<SortingState>([])

  const selectedRowsSetRef = useRef(new Set<string>(selectedRows))
  selectedRowsSetRef.current = new Set(selectedRows)

  const columns = useMemo(
    () =>
      getColumns({
        selectedRowsSet: selectedRowsSetRef.current,
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
        onTagsUpdate,
      }),
    [onSelectRow, onSelectAll, onRowClick, onDelete, onRegenerate, onSubscribe, failedCovers, onCoverError, isSubscribed, isSubscribable, taskStoreTasks, onTagsUpdate],
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

  const selectedCount = selectedRows.length
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

