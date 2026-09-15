import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTaskStore, type Task } from '@/store/taskStore'
import { useSystemStore } from '@/store/configStore'
import { DetailSkeleton } from '@/components/Skeletons'
import LeftPanel from './LeftPanel'
import RightPanel, { type LocalSettings } from './RightPanel'
import DetailNav from './DetailNav'
import { Loader2, ArrowLeft, Video, FileText, CircleX, Ban, FileQuestion } from 'lucide-react'
import { isProcessingStatus, hasMarkdownContent, ProcessingSpinner } from './processing'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { useModelStore } from '@/store/modelStore'
import { toast } from 'sonner'

type ErrorCategory = {
  type: string
  label: string
  color: string
}

function classifyError(msg: string, platform?: string): ErrorCategory {
  const m = msg.toLowerCase()
  if (/429|rate.?limit|限流|访问量过大|too many/.test(m))
    return { type: 'rate_limit', label: 'API 限流', color: 'bg-orange-100 text-orange-700' }
  if (/cookie|验证.*失败|登录.*过期|cookie.*失效|被反爬/.test(m) || (platform === 'douyin' && /解析|parse|download|获取.*失败/.test(m)))
    return { type: 'cookie', label: 'Cookie 过期', color: 'bg-amber-100 text-amber-700' }
  if (/下载|download|video\.?download|yt-dlp/.test(m))
    return { type: 'download', label: '下载失败', color: 'bg-red-100 text-red-700' }
  if (/供应商|provider|api.?地址|api.?key|connect.?test/.test(m))
    return { type: 'provider', label: '供应商错误', color: 'bg-purple-100 text-purple-700' }
  if (/模型|model|转写|transcri|gpt|summar|总结|格式化|formatt/.test(m))
    return { type: 'model', label: '模型调用失败', color: 'bg-blue-100 text-blue-700' }
  if (/connection|timeout|连接|超时|network|网络/.test(m))
    return { type: 'network', label: '网络连接失败', color: 'bg-yellow-100 text-yellow-700' }
  return { type: 'unknown', label: '生成失败', color: 'bg-gray-100 text-gray-700' }
}

function ProcessingView({ status, taskId }: { status: string; taskId: string }) {
  const cancelTask = useTaskStore(state => state.cancelTask)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-background">
      <ProcessingSpinner status={status} onCancel={() => cancelTask(taskId)} />
      <div className="text-xs text-muted-foreground">刷新页面后进度条仍会实时展示</div>
    </div>
  )
}

function QueuedView({ taskId }: { taskId: string }) {
  const cancelTask = useTaskStore(state => state.cancelTask)
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="size-8 animate-spin text-amber-500" />
      <div className="text-lg font-medium text-foreground">排队等待中...</div>
      <div className="text-sm text-muted-foreground">任务正在排队，请稍候</div>
      <button
        onClick={() => cancelTask(taskId)}
        className="mt-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
      >
        取消排队
      </button>
    </div>
  )
}

function FailedView({ message, taskId, platform }: { message?: string; taskId: string; platform?: string }) {
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)

  const handleRetry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      const store = useModelStore.getState()
      if (store.modelList.length === 0) {
        await store.loadEnabledModels()
      }
      const modelList = useModelStore.getState().modelList
      const task = useTaskStore.getState().tasks.find(t => t.id === taskId)
      const prevModel = task?.formData?.model_name
        ? modelList.find(m => m.model_name === task.formData.model_name)
        : null
      const model = prevModel || modelList[0]
      if (!model) {
        toast.error('没有可用的模型，请先在设置中添加模型')
        setRetrying(false)
        return
      }
      const payload = {
        ...task?.formData,
        model_name: model.model_name,
        provider_id: model.provider_id,
      }
      await useTaskStore.getState().retryTask(taskId, payload)
    } catch {
      setRetrying(false)
    }
  }

  const category = message ? classifyError(message, platform) : null

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background px-8">
      <div className="flex items-center gap-2 text-lg font-medium text-red-500">
        <CircleX className="h-5 w-5" />
        生成失败
      </div>
      {category && (
        <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-medium ${category.color}`}>
          {category.label}
        </span>
      )}
      {message && (
        <div className="w-full max-w-lg rounded-md border bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">错误详情</p>
          <p className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
            {message}
          </p>
        </div>
      )}
      {category?.type === 'cookie' && (
        <p className="text-sm text-amber-600">
          💡 抖音 Cookie 可能已过期，请在
          <button onClick={() => navigate('/settings/download')} className="underline hover:text-amber-700 mx-1">设置→下载配置</button>
          中更新 Cookie
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retrying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              重新生成中
            </>
          ) : (
            '重新生成'
          )}
        </button>
        <button
          onClick={() => navigate('/notes')}
          className="px-4 py-2 border rounded-md hover:bg-accent"
        >
          返回列表
        </button>
      </div>
    </div>
  )
}

/**
 * 旧笔记提示横幅：任务状态为 FAILED 但本地已有笔记内容时显示。
 * 场景：原作品已被作者删除/私密，但本地笔记仍可正常查看。
 */
function StaleNoteBanner({ message, platform }: { message: string; platform?: string }) {
  const category = message ? classifyError(message, platform) : null
  // 判断是否"原作品已删除"类错误（抖音/快手等平台 filter_detail）
  const isRemoteDeleted = /作品不可访问|作品权限|已被删除|作品不见了|filter_reason/.test(message || '')

  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm">
      <FileQuestion className="h-4 w-4 shrink-0 text-amber-600" />
      <span className="text-amber-800">
        {isRemoteDeleted
          ? '原作品已被删除或设为私密，以下为本地已生成的笔记内容'
          : `上次生成失败${category ? `（${category.label}）` : ''}，以下为本地已有的笔记内容`}
      </span>
    </div>
  )
}

// 用 memo 包裹子组件，防止拖拽时重新渲染
const MemoLeftPanel = memo(LeftPanel)
const MemoRightPanel = memo(RightPanel)
const MemoDetailNav = memo(DetailNav)

export default function NoteDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const task = useTaskStore(state => state.tasks.find((t: Task) => t.id === id))
  const loadTasksFromBackend = useTaskStore(state => state.loadTasksFromBackend)
  const panelSwapped = useSystemStore(state => state.panelSwapped)
  const [loading, setLoading] = useState(!task)
  const [notFound, setNotFound] = useState(false)
  const isMobile = useIsMobile()

  // 拖拽分割线
  const [leftWidth, setLeftWidth] = useState(520)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // 局部设置（隔离全局 store，仅影响当前笔记的重新生成）
  const [localSettings, setLocalSettings] = useState<LocalSettings>({
    style: task?.formData?.style || 'minimal',
    outputLanguage: task?.formData?.output_language || 'zh',
    modelName: task?.formData?.model_name || '',
    providerId: task?.formData?.provider_id || '',
    videoUnderstanding: task?.formData?.video_understanding ?? true,
    videoInterval: task?.formData?.video_interval || 4,
    gridCols: task?.formData?.grid_size?.[0] || 3,
    gridRows: task?.formData?.grid_size?.[1] || 3,
    selectedFormats: task?.formData?.format || ['toc', 'link', 'screenshot', 'summary'],
    extras: task?.formData?.extras || '',
  })

  // taskId 变化时重新初始化局部设置
  useEffect(() => {
    if (task) {
      setLocalSettings({
        style: task.formData?.style || 'minimal',
        outputLanguage: task.formData?.output_language || 'zh',
        modelName: task.formData?.model_name || '',
        providerId: task.formData?.provider_id || '',
        videoUnderstanding: task.formData?.video_understanding ?? true,
        videoInterval: task.formData?.video_interval || 4,
        gridCols: task.formData?.grid_size?.[0] || 3,
        gridRows: task.formData?.grid_size?.[1] || 3,
        selectedFormats: task.formData?.format || ['toc', 'link', 'screenshot', 'summary'],
        extras: task.formData?.extras || '',
      })
    }
  }, [task?.id])

  // 从后端加载（刷新状态，避免 localStorage 旧缓存导致显示过时状态）
  // 场景：localStorage 可能缓存了 FAILED，但后端 status.json 已被清理/状态已变
  useEffect(() => {
    if (!id) {
      setNotFound(true)
      setLoading(false)
      return
    }

    // task 不存在时显示骨架屏，存在时直接用（后台刷新后 selector 会自动更新）
    if (!task) {
      setLoading(true)
    }
    loadTasksFromBackend()
      .then(() => {
        // loadTasksFromBackend 会更新 store，task selector 会自动重新计算
        // 但这里我们无法直接读取更新后的 task，所以用 store.getState()
        const found = useTaskStore.getState().tasks.find((t: Task) => t.id === id)
        if (!found) {
          setNotFound(true)
        }
        setLoading(false)
      })
      .catch((e) => {
        console.error('从后端加载任务失败:', e)
        setNotFound(true)
        setLoading(false)
      })
  }, [id, loadTasksFromBackend])

  const onMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    let rafId: number | null = null
    let pendingWidth: number | null = null

    const updateWidth = () => {
      if (pendingWidth !== null) {
        setLeftWidth(pendingWidth)
        pendingWidth = null
      }
      rafId = null
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const containerRect = containerRef.current.getBoundingClientRect()
      const navWidth = 64
      const splitWidth = 16
      const leftMin = 380
      const rightMin = 420
      const newLeftWidth = e.clientX - containerRect.left
      const clamped = Math.max(leftMin, Math.min(newLeftWidth, containerRect.width - navWidth - splitWidth - rightMin))

      pendingWidth = clamped
      if (!rafId) {
        rafId = requestAnimationFrame(updateWidth)
      }
    }

    const onMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      if (pendingWidth !== null) {
        setLeftWidth(pendingWidth)
        pendingWidth = null
      }
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  if (loading) {
    return <DetailSkeleton />
  }

  if (!task || notFound) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">笔记未找到</p>
          <button
            onClick={() => navigate('/notes')}
            className="mt-4 text-sm text-primary hover:underline"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  // 任务进行中时：有已有内容则局部加载，无内容则全屏加载
  const processing = isProcessingStatus(task.status)
  const hasContent = hasMarkdownContent(task.markdown)
  if (processing && !hasContent) {
    return <ProcessingView status={task.status} taskId={task.id} />
  }

  // 排队中：有已有内容也局部显示
  const queued = task.status === 'QUEUED' || task.status === 'PENDING'
  if (queued && !hasContent) {
    return <QueuedView taskId={task.id} />
  }

  // 任务失败时：若本地已生成过笔记内容，仍正常显示笔记 + 顶部加"原作品已删除/生成失败"提示
  // 场景：任务曾成功生成笔记（有 note.md），后来原作品被作者删除，重新提交时下载失败变 FAILED
  if (task.status === 'FAILED' && !hasContent) {
    return <FailedView message={task.message} taskId={task.id} platform={task.platform} />
  }

  // 任务取消时显示取消提示
  if (task.status === 'CANCELLED') {
    return <FailedView message="任务已取消" taskId={task.id} />
  }

  // 状态未知（文件查找失败/状态文件损坏）：有内容正常显示，无内容提示重新获取
  if (task.status === 'UNKNOWN' && !hasContent) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <FileQuestion className="size-12 text-muted-foreground/40" />
        <div className="text-lg font-medium text-foreground">无法获取笔记状态</div>
        <div className="max-w-md text-sm text-muted-foreground">
          {task.message || '笔记文件可能正在生成，或文件路径发生变更。请尝试刷新页面或重新生成。'}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
          >
            刷新页面
          </button>
          <button
            onClick={() => navigate('/notes')}
            className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            返回列表
          </button>
        </div>
      </div>
    )
  }

  // 移动端：单页上下滚动布局（顶部栏由 SiteHeader 处理）
  if (isMobile) {
    return (
      <div className="flex flex-col bg-background">
        {/* 失败但有内容的提示横幅 */}
        {task.status === 'FAILED' && hasContent && (
          <StaleNoteBanner message={task.message} platform={task.platform} />
        )}
        {/* 视频信息区 */}
        <MemoLeftPanel
          task={task}
          localSettings={localSettings}
          onSettingsChange={setLocalSettings}
        />

        {/* 分隔线 */}
        <div className="h-2 bg-muted" />

        {/* 笔记内容区 */}
        <MemoRightPanel
          task={task}
          isProcessing={processing || queued}
          processingStatus={task.status}
          localSettings={localSettings}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* 失败但有内容的提示横幅 */}
      {task.status === 'FAILED' && hasContent && (
        <StaleNoteBanner message={task.message} platform={task.platform} />
      )}
      <div className="flex flex-1 min-h-0 overflow-hidden" ref={containerRef}>
      {/* 左栏（根据 panelSwapped 决定是视频还是笔记） */}
      <div className="flex flex-col overflow-hidden" style={{ width: leftWidth, minWidth: 380 }}>
        {/* 面板内容（带切换动画） */}
        <div
          key={`left-${panelSwapped}`}
          className="flex-1 min-h-0 animate-in fade-in slide-in-from-right-4 duration-300"
        >
          {panelSwapped ? (
            <MemoRightPanel
              task={task}
              isProcessing={processing || queued}
              processingStatus={task.status}
              localSettings={localSettings}
            />
          ) : (
            <MemoLeftPanel
              task={task}
              localSettings={localSettings}
              onSettingsChange={setLocalSettings}
            />
          )}
        </div>
      </div>

      {/* 拖拽分割线 */}
      <div
        data-guide="split-handle"
        className="w-4 shrink-0 cursor-col-resize flex flex-col items-center justify-center h-full relative group"
        onMouseDown={onMouseDown}
      >
        {/* 分割线条 */}
        <div className="h-full bg-border" style={{ width: '0.5px' }} />
        {/* 拖拽手柄 */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-3 h-12 rounded-md bg-background shadow-sm flex flex-col items-center justify-center gap-1">
          <div className="w-1.5 h-[1.5px] rounded-full bg-muted-foreground" />
          <div className="w-1.5 h-[1.5px] rounded-full bg-muted-foreground" />
          <div className="w-1.5 h-[1.5px] rounded-full bg-muted-foreground" />
        </div>
      </div>

      {/* 右栏（根据 panelSwapped 决定是笔记还是视频） */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* 面板内容（带切换动画） */}
        <div
          key={`right-${panelSwapped}`}
          className="h-full animate-in fade-in slide-in-from-left-4 duration-300"
        >
          {panelSwapped ? (
            <MemoLeftPanel
              task={task}
              localSettings={localSettings}
              onSettingsChange={setLocalSettings}
            />
          ) : (
            <MemoRightPanel
              task={task}
              isProcessing={processing || queued}
              processingStatus={task.status}
              localSettings={localSettings}
            />
          )}
        </div>
      </div>

      {/* 右侧导航栏 */}
      <MemoDetailNav />
      </div>
    </div>
  )
}
