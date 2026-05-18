import { FC, useState, useEffect, useRef } from 'react'
import {
  Download,
  RotateCw,
  Columns,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FolderPlus,
  Search,
  LoaderCircle,
  Play,
  Rss,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getTasks, delete_task, get_task_status } from '@/services/note'
import { TableSkeleton } from '@/components/Skeletons'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '@/components/ConfirmDialog'
import { getBaseURL } from '@/utils/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo } from '@/components/Icons/platform'
import { useSystemStore } from '@/store/configStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'

const getProxiedCoverUrl = (coverUrl: string, platform: string) => {
  if (!coverUrl) return ''
  const isLocal = platform === 'local' || platform === 'local_audio'
  if (isLocal) return coverUrl
  return `/api/image_proxy?url=${encodeURIComponent(coverUrl)}`
}

const PROGRESS_STEPS = [
  { key: 'PARSING', label: '解析', order: 1 },
  { key: 'DOWNLOADING', label: '下载', order: 2 },
  { key: 'TRANSCRIBING', label: '转写', order: 3 },
  { key: 'SUMMARIZING', label: '总结', order: 4 },
  { key: 'SAVING', label: '保存', order: 5 },
  { key: 'SUCCESS', label: '完成', order: 6 },
]

const getStepProgress = (status: string): { currentStep: number; stepLabel: string } => {
  const step = PROGRESS_STEPS.find(s => s.key === status)
  if (!step) {
    if (status === 'FAILED') return { currentStep: 0, stepLabel: '失败' }
    if (status === 'QUEUED' || status === 'PENDING') return { currentStep: 0, stepLabel: '排队' }
    return { currentStep: 0, stepLabel: '未知' }
  }
  return { currentStep: step.order, stepLabel: step.label }
}

const isProcessingStatus = (status: string): boolean => {
  return ['PARSING', 'DOWNLOADING', 'TRANSCRIBING', 'SUMMARIZING', 'FORMATTING', 'SAVING'].includes(status)
}

interface NoteItem {
  id: string
  task_id: string
  cover: string
  platform: string
  title: string
  author: string
  note: string
  created_at: string
  status: string
  video_url: string
}

export const NoteListPage: FC = () => {
  const navigate = useNavigate()
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState('')
  const [failedCovers, setFailedCovers] = useState<Set<string>>(new Set())
  const [playDialogOpen, setPlayDialogOpen] = useState(false)
  const [playItem, setPlayItem] = useState<NoteItem | null>(null)
  const noteViewMode = useSystemStore(state => state.noteViewMode)
  const setNoteViewMode = useSystemStore(state => state.setNoteViewMode)
  const { subscribe, subscriptions } = useSubscriptionStore()
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

  useEffect(() => {
    const timer = setInterval(async () => {
      const pendingNotes = notesRef.current.filter(
        note => note.status !== 'SUCCESS' && note.status !== 'FAILED'
      )
      if (pendingNotes.length === 0) return

      for (const note of pendingNotes) {
        try {
          const res: any = await get_task_status(note.task_id)
          const status = res?.status as string
          if (status && status !== note.status) {
            if (status === 'SUCCESS') {
              const taskData = res?.result
              setNotes(prev => prev.map(n =>
                n.task_id === note.task_id
                  ? {
                    ...n,
                    status,
                    cover: getProxiedCoverUrl(taskData?.audio_meta?.cover_url || '', n.platform),
                    title: taskData?.audio_meta?.title || taskData?.title || n.title,
                    author: taskData?.audio_meta?.raw_info?.owner?.name
                      || taskData?.audio_meta?.raw_info?.uploader || n.author,
                    note: taskData?.markdown || '',
                  }
                  : n
              ))
              toast.success('笔记生成成功')
            } else {
              setNotes(prev => prev.map(n =>
                n.task_id === note.task_id
                  ? { ...n, status }
                  : n
              ))
            }
          }
        } catch (e) {
        }
      }
    }, 3000)

    return () => clearInterval(timer)
  }, [])

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
              <SelectItem value="table">表格</SelectItem>
              <SelectItem value="card">卡片</SelectItem>
              <SelectItem value="masonry">瀑布流</SelectItem>
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
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              批量导出
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetchNotes}>
              <RotateCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <Columns className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 视图内容 */}
      {noteViewMode === 'table' ? (
        <div className="flex-1 min-h-0 border border-border rounded-lg overflow-auto">
          <div className="flex items-center gap-4 px-4 py-3 bg-muted border-b border-border text-sm font-medium text-muted-foreground">
            <Checkbox
              checked={selectedRows.length === filteredNotes.length && filteredNotes.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <div className="w-32">封面</div>
            <div className="flex-1 min-w-0">标题</div>
            <div className="flex-1 min-w-0">笔记</div>
            <div className="w-24 text-right">操作菜单</div>
          </div>

          {loading && <TableSkeleton rows={5} />}

          {!loading && filteredNotes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <p>暂无笔记</p>
              <p className="text-xs mt-1">生成笔记后将显示在这里</p>
            </div>
          )}

          {!loading && filteredNotes.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0 cursor-pointer transition-all duration-200 hover:bg-accent hover:shadow-sm",
                selectedRows.includes(item.id) && "bg-accent"
              )}
              onClick={() => handleNoteClick(item)}
            >
              <Checkbox
                checked={selectedRows.includes(item.id)}
                onCheckedChange={() => toggleSelectRow(item.id)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="w-32">
                <div className="relative aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                  {item.cover && !failedCovers.has(item.id) ? (
                    <img src={item.cover} alt="" className="w-full h-full object-cover" onError={() => handleCoverError(item.id)} />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <PlatformIconSmall platform={item.platform} />
                      <span className="text-xs text-muted-foreground">{item.author || item.platform}</span>
                    </div>
                  )}
                  {(item.status === 'PENDING' || item.status === 'RUNNING' || item.status === 'QUEUED') && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <LoaderCircle className="w-6 h-6 text-white animate-spin" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{item.title}</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-muted-foreground">{item.author}</span>
                  {isSubscribable(item.platform) && item.author && (
                    <button
                      className={cn(
                        "flex items-center gap-0.5 text-xs transition-colors",
                        isSubscribed(item.author) ? "text-primary" : "text-muted-foreground hover:text-primary"
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
                {/* 进度条展示 */}
                {isProcessingStatus(item.status) && (() => {
                  const { currentStep, stepLabel } = getStepProgress(item.status)
                  return (
                    <div className="flex flex-col gap-1 mt-2">
                      <div className="flex items-center gap-2 text-xs">
                        <LoaderCircle className="w-3 h-3 animate-spin text-primary" />
                        <span className="text-primary">{stepLabel}</span>
                        <span className="text-muted-foreground">{currentStep}/6</span>
                      </div>
                      <div className="flex gap-1">
                        {PROGRESS_STEPS.map((step: { key: string; label: string; order: number }, idx: number) => (
                          <div
                            key={step.key}
                            className={cn(
                              'h-1 flex-1 rounded-full transition-all duration-300',
                              idx < currentStep ? 'bg-primary' : 'bg-muted'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {item.status === 'QUEUED' && (
                  <div className="flex items-center gap-2 text-xs mt-2 text-muted-foreground">
                    <LoaderCircle className="w-3 h-3 animate-spin" />
                    排队等待中...
                  </div>
                )}
                {item.status === 'FAILED' && (
                  <div className="text-xs mt-2 text-red-500">生成失败</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground truncate">{item.note}</div>
              </div>
              <div className="w-24 flex items-center justify-end gap-2">
                <button
                  className="p-1.5 hover:bg-accent rounded-md transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTargetId(item.task_id)
                    setDeleteDialogOpen(true)
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>每页行数</span>
              <select className="px-2 py-1 text-sm border border-border rounded-md bg-background">
                <option>10</option>
                <option>20</option>
                <option>50</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedRows.length}/{filteredNotes.length} 行
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <select className="px-2 py-1 text-sm border border-border rounded-md bg-background">
                  <option>1</option>
                </select>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : noteViewMode === 'card' ? (
        /* 卡片视图 */
        <div className="flex-1 min-h-0 overflow-auto px-6 pb-6">
          {loading ? (
            <TableSkeleton rows={3} />
          ) : filteredNotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <p>暂无笔记</p>
              <p className="text-xs mt-1">生成笔记后将显示在这里</p>
            </div>
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
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <p>暂无笔记</p>
              <p className="text-xs mt-1">生成笔记后将显示在这里</p>
            </div>
          ) : (
            <div className="columns-[280px] gap-4">
              {filteredNotes.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-xl border border-border bg-background overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/20 mb-4 break-inside-avoid"
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
                    {(item.status === 'PENDING' || item.status === 'RUNNING' || item.status === 'QUEUED') && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <LoaderCircle className="w-6 h-6 text-white animate-spin" />
                      </div>
                    )}
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
      )}

      {/* 播放弹窗 */}
      <Dialog open={playDialogOpen} onOpenChange={setPlayDialogOpen}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{playItem?.title || '播放'}</DialogTitle>
          </DialogHeader>
          {playItem?.platform === 'local' ? (
            <video
              src={`${getBaseURL()}${playItem.video_url}`}
              controls
              autoPlay
              className="w-full rounded-lg"
            />
          ) : playItem?.platform === 'local_audio' ? (
            <audio
              src={`${getBaseURL()}${playItem.video_url}`}
              controls
              autoPlay
              className="w-full mt-4"
            />
          ) : null}
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

export default NoteListPage

function PlatformIconSmall({ platform }: { platform: string }) {
  const iconMap: Record<string, React.ReactNode> = {
    bilibili: <BiliBiliLogo className="w-6 h-6" />,
    youtube: <YoutubeLogo className="w-6 h-6" />,
    douyin: <DouyinLogo className="w-6 h-6" />,
    kuaishou: <KuaishouLogo className="w-6 h-6" />,
    local: <LocalLogo className="w-6 h-6" />,
    local_audio: <AudioLogo className="w-6 h-6" />,
  }
  return <>{iconMap[platform] || <LocalLogo className="w-6 h-6" />}</>
}
