import { useState, useEffect } from 'react'
import { Sparkles, Link, SlidersHorizontal, Upload, Clipboard, Zap, Loader2, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { videoPlatforms } from '@/constant/note.ts'
import { SummarySettings } from '@/components/SummarySettings'
import { ModelSelectDialog } from '@/components/ModelSelectDialog'
import { useModelStore } from '@/store/modelStore'
import { useTaskStore } from '@/store/taskStore'
import { generateNote } from '@/services/note.ts'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'

type TabType = 'link' | 'upload'

interface QuickAddProps {
  className?: string
}

export function QuickAdd({ className }: QuickAddProps) {
  const [activeTab, setActiveTab] = useState<TabType>('link')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelSelectOpen, setModelSelectOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('auto')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const { selectedModel, modelList, loadEnabledModels } = useModelStore()
  const { addPendingTask } = useTaskStore()

  // 初始化时加载可用模型列表
  useEffect(() => {
    if (modelList.length === 0) {
      loadEnabledModels()
    }
  }, [])
  const {
    style,
    outputLanguage,
    videoUnderstanding,
    videoInterval,
    gridCols,
    gridRows,
    selectedFormats,
    extras,
  } = useSummarySettingsStore()

  // URL 自动识别平台（仅在"智能选择"模式下生效）
  useEffect(() => {
    if (selectedPlatform !== 'auto') return
    const url = inputValue.trim().toLowerCase()
    if (!url) {
      setDetectedPlatform(null)
      return
    }
    const match =
      url.includes('bilibili.com') || url.includes('b23.tv') ? 'bilibili' :
      url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' :
      url.includes('douyin') ? 'douyin' :
      url.includes('kuaishou') ? 'kuaishou' :
      null
    setDetectedPlatform(match)
  }, [inputValue, selectedPlatform])

  // 实际使用的平台（智能选择时用检测结果，否则用用户选择）
  const effectivePlatform = selectedPlatform === 'auto'
    ? (detectedPlatform || 'bilibili')
    : selectedPlatform

  // 获取选中的模型名称
  const selectedModelName = selectedModel
    ? modelList.find(m => m.id === selectedModel)?.model_name || '默认模型'
    : '默认模型'

  // 获取选中的模型信息
  const selectedModelInfo = selectedModel
    ? modelList.find(m => m.id === selectedModel)
    : null

  // 快速粘贴功能
  const handleQuickPaste = async () => {
    try {
      // 检查剪贴板 API 是否可用
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        toast.error('浏览器不支持自动粘贴，请使用 Ctrl+V 手动粘贴')
        return
      }

      const text = await navigator.clipboard.readText()
      if (text) {
        setInputValue(text)
        toast.success('粘贴成功')
      } else {
        toast.error('剪贴板为空')
      }
    } catch (err) {
      console.error('粘贴失败:', err)
      // 常见错误：用户未授权或不在 HTTPS 环境
      toast.error('无法读取剪贴板，请手动粘贴或使用 Ctrl+V')
    }
  }

  // 生成笔记
  const handleGenerateNote = async () => {
    // 验证输入
    if (!inputValue.trim()) {
      toast.error('请输入视频链接')
      return
    }

    // 验证模型选择
    if (!selectedModelInfo) {
      toast.error('请选择模型')
      return
    }

    setIsGenerating(true)

    try {
      // 构建请求参数
      const payload = {
        video_url: inputValue.trim(),
        platform: effectivePlatform,
        quality: 'medium',
        model_name: selectedModelInfo.model_name,
        provider_id: String(selectedModelInfo.provider_id),
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

      // 调用生成笔记 API
      const response = await generateNote(payload)

      if (response && response.task_id) {
        const taskId = response.task_id

        // 添加任务到 store
        addPendingTask(taskId, effectivePlatform, payload)

        // 清空输入框
        setInputValue('')

        toast.success('笔记生成任务已提交！')
      }
    } catch (err) {
      console.error('生成笔记失败:', err)
      toast.error('生成笔记失败，请稍后重试')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className={cn("flex flex-col items-center justify-center h-full gap-6 p-8", className)}>
      {/* 标题区域 */}
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-3xl font-semibold bg-gradient-to-r from-[#FF6B9D] to-[#9B59B6] bg-clip-text text-transparent">
          VideoNote
        </h1>
        <p className="text-lg text-foreground">
          让你的音视频看得快，搜得到，用得好
        </p>
      </div>

      {/* 标签容器 */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1.5 bg-muted p-1.5 rounded-md">
          <TabButton
            icon={<Link className="w-4 h-4" />}
            label="链接"
            isActive={activeTab === 'link'}
            onClick={() => setActiveTab('link')}
          />
          <TabButton
            icon={<Upload className="w-4 h-4" />}
            label="上传"
            isActive={activeTab === 'upload'}
            onClick={() => setActiveTab('upload')}
          />
        </div>
      </div>

      {/* 输入框容器 */}
      <div className="w-full max-w-[800px] flex flex-col gap-4">
        <div className="flex flex-col border-2 border-border rounded-xl bg-background overflow-hidden">
          {/* 输入框 */}
          <div className="p-4">
            <textarea
              placeholder="请输入视频网站链接"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="w-full h-20 resize-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-sm"
            />
          </div>

          {/* 操作栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center gap-1.5 h-8 px-3 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                onClick={() => setSettingsOpen(true)}
              >
                <SlidersHorizontal className="w-4 h-4" />
                总结设置
              </button>
              <button
                className="flex items-center justify-center gap-1.5 h-8 px-3 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                onClick={() => setModelSelectOpen(true)}
              >
                <Sparkles className="w-4 h-4" />
                {selectedModelName}
              </button>
              {/* 平台选择下拉器 */}
              <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                <SelectTrigger className="h-8 px-3 border-0 bg-transparent gap-1.5 text-sm text-foreground hover:bg-accent rounded-md focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                  {selectedPlatform === 'auto' ? (
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      <span>智能选择</span>
                      {detectedPlatform && (
                        <span className="text-xs text-muted-foreground">
                          ({videoPlatforms.find(p => p.value === detectedPlatform)?.label || detectedPlatform})
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4">{videoPlatforms.find(p => p.value === selectedPlatform)?.logo()}</div>
                      <span>{videoPlatforms.find(p => p.value === selectedPlatform)?.label}</span>
                    </div>
                  )}
                </SelectTrigger>
                <SelectContent>
                  {/* 智能选择选项 */}
                  <SelectItem value="auto">
                    <div className="flex items-center gap-2">
                      <Wand2 className="w-4 h-4" />
                      <span>智能选择</span>
                    </div>
                  </SelectItem>
                  {videoPlatforms?.filter(p => p.value !== 'local' && p.value !== 'local_audio').map(p => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4">{p.logo()}</div>
                        <span>{p.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center justify-center gap-1.5 h-8 px-3 text-sm text-foreground hover:bg-accent rounded-md transition-colors"
                onClick={handleQuickPaste}
              >
                <Clipboard className="w-4 h-4" />
                快速粘贴
              </button>
            </div>
          </div>
        </div>

        {/* 生成笔记按钮 */}
        <div className="flex justify-center">
          <Button
            className="w-[280px] h-12 rounded-3xl bg-foreground text-primary-foreground hover:bg-foreground/90 flex items-center gap-2 text-base font-medium"
            onClick={handleGenerateNote}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {isGenerating ? '生成中...' : '生成笔记'}
          </Button>
        </div>

        {/* 底部链接 */}
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <button className="flex items-center justify-center gap-1.5 h-8 px-3 hover:bg-accent hover:text-foreground rounded-md transition-colors">
            <Zap className="w-4 h-4" />
            热门链接
          </button>
          <button className="flex items-center justify-center gap-1.5 h-8 px-3 hover:bg-accent hover:text-foreground rounded-md transition-colors">
            <Link className="w-4 h-4" />
            批量链接
          </button>
        </div>
      </div>

      {/* 总结设置对话框 */}
      <SummarySettings open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* 模型选择对话框 */}
      <ModelSelectDialog open={modelSelectOpen} onOpenChange={setModelSelectOpen} />
    </div>
  )
}

interface TabButtonProps {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}

function TabButton({ icon, label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-normal transition-all",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "bg-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
    </button>
  )
}
