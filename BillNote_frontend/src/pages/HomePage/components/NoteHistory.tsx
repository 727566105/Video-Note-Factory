import { useTaskStore } from '@/store/taskStore'
import { ScrollArea } from '@/components/ui/scroll-area.tsx'
import { Badge } from '@/components/ui/badge.tsx'
import { cn } from '@/lib/utils.ts'
import { Button } from '@/components/ui/button.tsx'
import PinyinMatch from 'pinyin-match'
import Fuse from 'fuse.js'
import { ArrowUpDown, XIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BiliBiliLogo, DouyinLogo, YoutubeLogo, KuaishouLogo, LocalLogo } from '@/components/Icons/platform.tsx'

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip.tsx'
import LazyImage from "@/components/LazyImage.tsx";
import ImagePreviewDialog from "@/components/ImagePreviewDialog.tsx";
import {FC, useState ,useEffect, useMemo } from 'react'

const PLATFORMS = [
  { value: 'all', label: '全部' },
  { value: 'bilibili', label: '哔哩哔哩' },
  { value: 'douyin', label: '抖音' },
  { value: 'local', label: '本地视频' },
  { value: 'kuaishou', label: '快手' },
  { value: 'youtube', label: 'YouTube' },
]

const PLATFORM_LABEL_MAP: Record<string, string> = {
  bilibili: 'B站',
  douyin: '抖音',
  local: '本地',
  kuaishou: '快手',
  youtube: 'YouTube',
}

const PLATFORM_ICON_MAP: Record<string, React.FC> = {
  bilibili: BiliBiliLogo,
  douyin: DouyinLogo,
  local: LocalLogo,
  kuaishou: KuaishouLogo,
  youtube: YoutubeLogo,
}

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
  const fuse = useMemo(() => new Fuse(tasks, {
    keys: ['audioMeta.title'],
    threshold: 0.4
  }), [tasks])

  const queueStats = useMemo(() => {
    const running = tasks.filter(t => t.status !== 'SUCCESS' && t.status !== 'FAILED' && t.status !== 'QUEUED').length
    const queued = tasks.filter(t => t.status === 'QUEUED').length
    return { running, queued }
  }, [tasks])
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
  const filteredTasks = useMemo(() => (search.trim()
      ? fuse.search(search).map(result => result.item)
      : tasks
  )
    .filter(task => platformFilter === 'all' || task.platform === platformFilter)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    }), [search, fuse, tasks, platformFilter, sortOrder])
  if (filteredTasks.length === 0) {
    return (
      <>
        {/* 进度概览条 */}
        {(queueStats.running > 0 || queueStats.queued > 0) && (
          <div className="mb-2 flex items-center gap-3 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
            <span>执行中 <b>{queueStats.running}</b></span>
            {queueStats.queued > 0 && (
              <>
                <span className="text-blue-300">|</span>
                <span>排队中 <b>{queueStats.queued}</b></span>
              </>
            )}
          </div>
        )}
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
      {/* 进度概览条 */}
      {(queueStats.running > 0 || queueStats.queued > 0) && (
        <div className="mb-2 flex items-center gap-3 rounded-md bg-blue-50 px-3 py-1.5 text-xs text-blue-700">
          <span>执行中 <b>{queueStats.running}</b></span>
          {queueStats.queued > 0 && (
            <>
              <span className="text-blue-300">|</span>
              <span>排队中 <b>{queueStats.queued}</b></span>
            </>
          )}
        </div>
      )}
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
                    ? task.audioMeta.cover_url || '/local-video-cover.svg'
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
                      task.audioMeta.cover_url ? `${task.audioMeta.cover_url}` : '/local-video-cover.svg'
                    }
                    alt="封面"
                    className="h-10 w-12 rounded-md object-cover"
                    onError={(e) => { e.currentTarget.src = '/local-video-cover.svg' }}
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
            <div className={'mt-2 flex items-center gap-1 text-[10px]'}>
                {task.status === 'SUCCESS' && (
                  <div className={'bg-primary w-10 rounded p-0.5 text-center text-white'}>
                    已完成
                  </div>
                )}
                {task.status === 'QUEUED' && (
                  <div className={'w-10 rounded bg-amber-500 p-0.5 text-center text-white'}>
                    排队中
                  </div>
                )}
                {task.status !== 'SUCCESS' && task.status !== 'FAILED' && task.status !== 'QUEUED' ? (
                  <div className={'w-10 rounded bg-green-500 p-0.5 text-center text-white'}>
                    生成中
                  </div>
                ) : (
                  <></>
                )}
                {task.status === 'FAILED' && (
                  <div className={'w-10 rounded bg-red-500 p-0.5 text-center text-white'}>失败</div>
                )}
                <div className={'flex items-center gap-0.5 rounded bg-neutral-200 px-1.5 py-0.5 text-neutral-600'}>
                  {(() => {
                    const Icon = PLATFORM_ICON_MAP[task.platform]
                    return Icon ? <Icon className="h-3 w-3 rounded-sm" /> : null
                  })()}
                  {PLATFORM_LABEL_MAP[task.platform] || task.platform}
                </div>
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
