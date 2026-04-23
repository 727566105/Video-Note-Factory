import { useTaskStore } from '@/store/taskStore'
import { cn } from '@/lib/utils.ts'
import { Button } from '@/components/ui/button.tsx'
import Fuse from 'fuse.js'
import { ArrowUpDown, XIcon } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BiliBiliLogo, DouyinLogo, YoutubeLogo, KuaishouLogo, LocalLogo, AudioLogo } from '@/components/Icons/platform.tsx'
import { noteStyles } from '@/constant/note.ts'

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
  { value: 'local_audio', label: '本地音频' },
  { value: 'kuaishou', label: '快手' },
  { value: 'youtube', label: 'YouTube' },
]

const STYLES = [
  { value: 'all', label: '全部风格' },
  ...noteStyles.map(s => ({ value: s.value, label: s.label })),
]

const PLATFORM_LABEL_MAP: Record<string, string> = {
  bilibili: 'B站',
  douyin: '抖音',
  local: '本地',
  local_audio: '本地音频',
  kuaishou: '快手',
  youtube: 'YouTube',
}

const PLATFORM_ICON_MAP: Record<string, React.FC> = {
  bilibili: BiliBiliLogo,
  douyin: DouyinLogo,
  local: LocalLogo,
  local_audio: AudioLogo,
  kuaishou: KuaishouLogo,
  youtube: YoutubeLogo,
}

const getTaskTitle = (task: { platform: string; formData?: { video_url?: string }; audioMeta: { title: string } }) => {
  if ((task.platform === 'local_audio' || task.platform === 'local') && task.formData?.video_url) {
    const filename = task.formData.video_url.split('/').pop() || ''
    if (filename) return filename
  }
  return task.audioMeta.title || '未命名笔记'
}

interface NoteHistoryProps {
  onSelect: (taskId: string) => void
  selectedId: string | null
}

const NoteHistory: FC<NoteHistoryProps> = ({ onSelect, selectedId }) => {
  const tasks = useTaskStore(state => state.tasks)
  const baseURL = (String(import.meta.env.VITE_API_BASE_URL || 'api')).replace(/\/$/, '')
  const [rawSearch, setRawSearch] = useState('')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [styleFilter, setStyleFilter] = useState('all')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const fuse = useMemo(() => new Fuse(tasks, {
    keys: ['audioMeta.title'],
    threshold: 0.4
  }), [tasks])
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
    .filter(task => styleFilter === 'all' || task.formData?.style === styleFilter)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime()
      const timeB = new Date(b.createdAt).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    }), [search, fuse, tasks, platformFilter, styleFilter, sortOrder])

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
        <Select value={styleFilter} onValueChange={setStyleFilter}>
          <SelectTrigger size="sm" className="w-[100px] text-xs">
            <SelectValue placeholder="风格" />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map(s => (
              <SelectItem key={s.value} value={s.value} className="text-xs">
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* 搜索框 */}
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

      {/* 内容区 */}
      {filteredTasks.length === 0 ? (
        <div className="rounded-md border border-neutral-200 bg-neutral-50 py-6 text-center">
          <p className="text-sm text-neutral-500">暂无记录</p>
        </div>
      ) : (
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
              <div className={cn('flex items-center gap-4')}>
                {/* 封面图 */}
                <div
                  className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    const isLocal = task.platform === 'local' || task.platform === 'local_audio'
                    const defaultCover = task.platform === 'local_audio' ? '/local-audio-cover.svg' : '/local-video-cover.svg'
                    const url = isLocal
                      ? task.audioMeta.cover_url || defaultCover
                      : task.audioMeta.cover_url
                        ? `${baseURL}/image_proxy?url=${encodeURIComponent(task.audioMeta.cover_url)}`
                        : '/placeholder.png'
                    setPreviewImageUrl(url)
                    setPreviewTitle(getTaskTitle(task))
                    setPreviewOpen(true)
                  }}
                >
                  {(task.platform === 'local' || task.platform === 'local_audio') ? (
                    <img
                      src={
                        task.platform === 'local_audio'
                          ? task.audioMeta.cover_url || '/local-audio-cover.svg'
                          : task.audioMeta.cover_url || '/local-video-cover.svg'
                      }
                      alt="封面"
                      className="h-10 w-12 rounded-md object-cover"
                      onError={(e) => { e.currentTarget.src = task.platform === 'local_audio' ? '/local-audio-cover.svg' : '/local-video-cover.svg' }}
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
                          {getTaskTitle(task)}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{getTaskTitle(task)}</p>
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
                ) : null}
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
      )}

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
