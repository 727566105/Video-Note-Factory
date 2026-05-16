import { FC, useState, useEffect } from 'react'
import {
  Plus,
  Download,
  RotateCw,
  Columns,
  ChevronLeft,
  ChevronRight,
  Trash2,
  FolderPlus,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { getTasks, delete_task } from '@/services/note'
import { TableSkeleton } from '@/components/Skeletons'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '@/components/ConfirmDialog'
import { BiliBiliLogo, YoutubeLogo, DouyinLogo, KuaishouLogo, LocalLogo, AudioLogo } from '@/components/Icons/platform'

const getBaseURL = () => (String(import.meta.env.VITE_API_BASE_URL || 'api')).replace(/\/$/, '')

const getProxiedCoverUrl = (coverUrl: string, platform: string) => {
  if (!coverUrl) return ''
  const isLocal = platform === 'local' || platform === 'local_audio'
  if (isLocal) return coverUrl
  return `${getBaseURL()}/api/image_proxy?url=${encodeURIComponent(coverUrl)}`
}

// 表格数据类型
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
}

export const NoteListPage: FC = () => {
  const navigate = useNavigate()
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState('')

  // 获取笔记列表
  const fetchNotes = async () => {
    setLoading(true)
    try {
      const response = await getTasks(100)
      // axios 拦截器已经返回了 response.data，所以 response 就是 { tasks: [...] }
      if (response && response.tasks) {
        // 转换后端数据为前端格式
        const formattedNotes = response.tasks.map((task: any) => ({
          id: task.task_id,
          task_id: task.task_id,
          // 优先使用数据库字段，兜底从 note.audio_meta 读取
          cover: getProxiedCoverUrl(task.cover_url || task.note?.audio_meta?.cover_url || '', task.platform),
          platform: task.platform || 'unknown',
          title: task.title || task.note?.audio_meta?.title || task.note?.title || '无标题',
          author: task.author || task.note?.audio_meta?.raw_info?.owner?.name || '',
          note: task.note?.markdown || '',
          created_at: task.created_at || '',
          status: task.status || 'UNKNOWN'
        }))
        setNotes(formattedNotes)
      }
    } catch (error) {
      console.error('获取笔记列表失败:', error)
      toast.error('获取笔记列表失败')
    } finally {
      setLoading(false)
    }
  }

  // 初始加载
  useEffect(() => {
    fetchNotes()
  }, [])

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

  // 删除笔记
  const handleDelete = async () => {
    try {
      await delete_task({ task_id: deleteTargetId })
      toast.success('删除成功')
      fetchNotes()
    } catch (error) {
      console.error('删除失败:', error)
      toast.error('删除失败')
    }
  }

  // 点击笔记跳转详情页
  const handleNoteClick = (item: NoteItem) => {
    navigate(`/notes/${item.id}`)
  }

  // 过滤笔记
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
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-md">
              表格
            </button>
            <button className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
              卡片
            </button>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            新增
          </Button>
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

      {/* 表格容器 */}
      <div className="flex-1 min-h-0 border border-border rounded-lg overflow-auto">
          {/* 表头 */}
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

          {/* 加载状态 */}
          {loading && (
            <TableSkeleton rows={5} />
          )}

          {/* 空状态 */}
          {!loading && filteredNotes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground">
              <p>暂无笔记</p>
              <p className="text-xs mt-1">生成笔记后将显示在这里</p>
            </div>
          )}

          {/* 表格行 */}
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
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center overflow-hidden">
                  {item.cover ? (
                    <img src={item.cover} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1">
                      <PlatformIconSmall platform={item.platform} />
                      <span className="text-xs text-muted-foreground capitalize">{item.platform}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">{item.title}</div>
                <div className="text-sm text-muted-foreground">{item.author}</div>
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

          {/* 分页器 */}
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
