import { useTaskStore } from '@/store/taskStore'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { cn } from '@/lib/utils.ts'
import { Button } from '@/components/ui/button.tsx'
import PinyinMatch from 'pinyin-match'
import Fuse from 'fuse.js'
import { ArrowUpDown, XIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import LazyImage from "@/components/LazyImage.tsx";
import ImagePreviewDialog from "@/components/ImagePreviewDialog.tsx";
import {FC, useState ,useEffect } from 'react'

const PLATFORMS = [
  { value: 'all', label: '全部' },
  { value: 'bilibili', label: '哔哩哔哩' },
  { value: 'douyin', label: '抖音' },
  { value: 'local', label: '本地视频' },
  { value: 'kuaishou', label: '快手' },
  { value: 'youtube', label: 'YouTube' },
]

interface NoteHistoryProps {
  onSelect: (taskId: string) => void
  selectedId: string | null
}

const NoteHistory: FC<NoteHistoryProps> = ({ onSelect, selectedId }) => {
  const tasks = useTaskStore(state => state.tasks)
  const removeTask = useTaskStore(state => state.removeTask)
  const baseURL = (String(import.meta.env.VITE_API_BASE_URL || 'api')).replace(/\/$/, '')
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const fuse = new Fuse(tasks, {
    keys: ['audioMeta.title'],
    threshold: 0.4
  })
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rawSearch === '') {
        setSearch('')
        return
      }
      setSearch(rawSearch)
    }, 300)

    return () => clearTimeout(timer)
  }, [rawSearch])
  const filteredTasks = (search.trim()
      ? fuse.search(search).map(result => result.item)
      : tasks
  )
    .filter(task => platformFilter === 'all' || task.platform === platformFilter)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })
  if (filteredTasks.length === 0) {
    return (
      <>
        {/* 筛选栏 */}
        <div className="mb-2 flex flex-wrap items-center gap-2 pt-2.5">
          <button
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-200 bg-white px-3 text-xs font-normal text-neutral-700 shadow-xs hover:bg-neutral-50"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortOrder === 'newest' ? '最新' : '最早'}
          </button>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[100px] h-8 px-3 text-xs font-normal py-1.5">
              <SelectValue placeholder="平台" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map(p => (
                <SelectItem key={p.value} value={p.value} className="text-xs">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mb-2">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索笔记标题..."
              className="w-full rounded border border-neutral-300 px-3 py-1 pr-8 text-sm outline-none focus:border-primary"
              value={rawSearch}
              onChange={e => setRawSearch(e.target.value)}
            />
            {rawSearch && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                onClick={() => setRawSearch('')}
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="rounded-md border border-neutral-200 bg-neutral-50 py-6 text-center">
          <p className="text-sm text-neutral-500">暂无记录</p>
        </div>
      </>
    )
  }


  return (
    <>
      {/* 筛选栏 */}
      <div className="mb-2 flex flex-wrap items-center gap-2 pt-2.5">
        <Button
          variant="outline"
          size="xs"
          onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          className="gap-1"
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortOrder === 'newest' ? '最新' : '最早'}
        </Button>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger size="sm" className="w-[100px] text-xs">
            <SelectValue placeholder="平台" />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map(p => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mb-2">
        <input
            type="text"
            placeholder="搜索笔记标题..."
            className="w-full rounded border border-neutral-300 px-3 py-1 text-sm outline-none focus:border-primary"
            value={rawSearch}
            onChange={e => setRawSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 pb-4">
        {filteredTasks.map(task => (
          <div
            key={task.id}
            onClick={() => onSelect(task.id)}
            className={cn(
              'flex cursor-pointer flex-col rounded-md border border-neutral-200 p-3',
              selectedId === task.id && 'border-primary bg-primary-light'
            )}
          >
            <div
              className={cn('flex items-center gap-4')}
            >
              {/* 封面图 */}
              <div
                className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation()
                  const url = task.platform === 'local'
                    ? task.audioMeta.cover_url || '/placeholder.png'
                    : task.audioMeta.cover_url
                      ? `${baseURL}/image_proxy?url=${encodeURIComponent(task.audioMeta.cover_url)}`
                      : '/placeholder.png'
                  setPreviewImageUrl(url)
                  setPreviewTitle(task.audioMeta.title || '未命名笔记')
                  setPreviewOpen(true)
                }}
              >
                {task.platform === 'local' ? (
                  <img
                    src={
                      task.audioMeta.cover_url ? `${task.audioMeta.cover_url}` : '/placeholder.png'
                    }
                    alt="封面"
                    className="h-10 w-12 rounded-md object-cover"
                  />
                ) : (
                    <LazyImage

                        src={
                          task.audioMeta.cover_url
                              ? `${baseURL}/image_proxy?url=${encodeURIComponent(task.audioMeta.cover_url)}`
                              : '/placeholder.png'
                        }
                        alt="封面"
                    />
                )}
              </div>

              {/* 标题 + 状态 */}

              <div className="flex w-full items-center justify-between gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="line-clamp-2 max-w-[180px] flex-1 overflow-hidden text-sm text-ellipsis">
                        {task.audioMeta.title || '未命名笔记'}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{task.audioMeta.title || '未命名笔记'}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className={'mt-2 flex items-center justify-between text-[10px]'}>
              <div className="shrink-0">
                {task.status === 'SUCCESS' && (
                  <div className={'bg-primary w-10 rounded p-0.5 text-center text-white'}>
                    已完成
                  </div>
                )}
                {task.status !== 'SUCCESS' && task.status !== 'FAILED' ? (
                  <div className={'w-10 rounded bg-green-500 p-0.5 text-center text-white'}>
                    等待中
                  </div>
                ) : (
                  <></>
                )}
                {task.status === 'FAILED' && (
                  <div className={'w-10 rounded bg-red-500 p-0.5 text-center text-white'}>失败</div>
                )}
              </div>
              {/*<div className="shrink-0">*/}
              {/*  {task.status === 'SUCCESS' && <Badge variant="default">已完成</Badge>}*/}
              {/*  {task.status !== 'SUCCESS' && task.status === 'FAILED' && (*/}
              {/*    <Badge variant="outline">等待中</Badge>*/}
              {/*  )}*/}
              {/*  {task.status === 'FAILED' && <Badge variant="destructive">失败</Badge>}*/}
              {/*</div>*/}
            </div>
          </div>
        ))}
      </div>
      <ImagePreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        imageUrl={previewImageUrl}
        title={previewTitle}
      />
    </>
  )
}

export default NoteHistory
