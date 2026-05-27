import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sparkles, Link, SlidersHorizontal, Upload, Clipboard, Zap, Loader2, Wand2, FileBox, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
import { uploadFile } from '@/services/upload.ts'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { checkNoteAvailability } from '@/services/subscription'

type TabType = 'link' | 'upload'

interface QuickAddProps {
  className?: string
}

export function QuickAdd({ className }: QuickAddProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('link')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelSelectOpen, setModelSelectOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<string>('auto')
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [multiFileMode, setMultiFileMode] = useState<'separate' | 'merge'>('separate')
  const { selectedModel, modelList, loadEnabledModels } = useModelStore()
  const { addPendingTask } = useTaskStore()
  const autoSubmitRef = useRef(false)

  // 笔记可用性预检对话框
  const [availabilityDialog, setAvailabilityDialog] = useState<{ available: boolean; task_id?: string; title?: string } | null>(null)

  // 初始化时加载可用模型列表
  useEffect(() => {
    if (modelList.length === 0) {
      loadEnabledModels()
    }
  }, [])

  // 从 URL 参数读取链接并自动触发提交
  useEffect(() => {
    const urlParam = searchParams.get('url')
    if (!urlParam || autoSubmitRef.current) return

    autoSubmitRef.current = true
    setInputValue(urlParam)
    setSearchParams({})

    // 等待状态更新和模型加载后自动提交
    const trySubmit = async () => {
      // 等待模型列表加载
      if (modelList.length === 0) {
        await new Promise<void>(resolve => {
          const check = setInterval(() => {
            if (useModelStore.getState().modelList.length > 0) {
              clearInterval(check)
              resolve()
            }
          }, 100)
          // 最多等待 5 秒
          setTimeout(() => { clearInterval(check); resolve() }, 5000)
        })
      }

      setIsGenerating(true)
      try {
        const currentModels = useModelStore.getState().modelList
        const currentSelected = useModelStore.getState().selectedModel
        const isSmart = currentSelected === 'smart'
        const modelInfo = isSmart ? null : currentModels.find(m => m.id === currentSelected)

        const settings = useSummarySettingsStore.getState()
        const platform = settings.style || 'minimal'

        // 自动检测平台
        const url = urlParam.trim().toLowerCase()
        const detected =
          url.includes('bilibili.com') || url.includes('b23.tv') ? 'bilibili' :
          url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' :
          url.includes('douyin') ? 'douyin' :
          url.includes('xiaohongshu.com') || url.includes('xhslink.com') ? 'xiaohongshu' :
          url.includes('kuaishou') ? 'kuaishou' :
          'bilibili'

        const payload = {
          video_url: urlParam.trim(),
          platform: detected,
          quality: 'medium',
          smart_mode: isSmart,
          model_name: isSmart ? '' : (modelInfo?.model_name || ''),
          provider_id: isSmart ? '' : String(modelInfo?.provider_id || ''),
          style: settings.style || 'minimal',
          format: settings.selectedFormats || [],
          extras: settings.extras || '',
          video_understanding: settings.videoUnderstanding || false,
          video_interval: settings.videoInterval || 4,
          grid_size: [settings.gridCols || 3, settings.gridRows || 3],
          screenshot: settings.selectedFormats?.includes('screenshot') || false,
          link: settings.selectedFormats?.includes('link') || false,
          output_language: settings.outputLanguage || 'zh',
        }

        const response = await generateNote(payload)
        if (response && response.task_id) {
          addPendingTask(response.task_id, detected, payload)
          setInputValue('')
          toast.success('笔记生成任务已提交！')
        }
      } catch {
        console.error('自动提交生成笔记失败')
      } finally {
        setIsGenerating(false)
      }
    }

    trySubmit()
  }, [searchParams, setSearchParams, modelList.length, addPendingTask])

  const {
    style,
    outputLanguage,
    videoUnderstanding,
    setVideoUnderstanding,
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
      url.includes('cctv.com') ? 'cctv' :
      url.includes('douyin') ? 'douyin' :
      url.includes('xiaohongshu.com') || url.includes('xhslink.com') ? 'xiaohongshu' :
      url.includes('kuaishou') ? 'kuaishou' :
      null
    setDetectedPlatform(match)
  }, [inputValue, selectedPlatform])

  // 实际使用的平台（智能选择时用检测结果，否则用用户选择）
  const effectivePlatform = selectedPlatform === 'auto'
    ? (detectedPlatform || 'bilibili')
    : selectedPlatform

  // 智能优选模式判断
  const isSmartMode = selectedModel === 'smart'

  // 获取选中的模型名称
  const selectedModelName = isSmartMode
    ? '智能优选'
    : selectedModel
      ? modelList.find(m => m.id === selectedModel)?.model_name || '默认模型'
      : '默认模型'

  // 获取选中的模型信息
  const selectedModelInfo = isSmartMode
    ? null
    : selectedModel
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

    // URL 格式校验
    const urlPattern = /^https?:\/\/.+\..+/i
    if (!urlPattern.test(inputValue.trim())) {
      toast.error('请输入有效的视频链接（以 http:// 或 https:// 开头）')
      return
    }

    // 智能优选模式下跳过模型验证
    if (!isSmartMode && !selectedModelInfo) {
      toast.error('请选择模型')
      return
    }

    // 预检笔记可用性
    try {
      const checkResult = await checkNoteAvailability(inputValue.trim(), effectivePlatform)
      if (checkResult?.available) {
        setAvailabilityDialog(checkResult as { available: boolean; task_id?: string; title?: string })
        return
      }
    } catch {
      console.error('笔记可用性预检失败')
    }

    await doGenerateNote()
  }

  const doGenerateNote = async () => {
    setIsGenerating(true)

    try {
      // 构建请求参数
      const payload = {
        video_url: inputValue.trim(),
        platform: effectivePlatform,
        quality: 'medium',
        smart_mode: isSmartMode,
        model_name: isSmartMode ? '' : (selectedModelInfo?.model_name || ''),
        provider_id: isSmartMode ? '' : String(selectedModelInfo?.provider_id || ''),
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
    } catch {
      console.error('生成笔记失败')
    } finally {
      setIsGenerating(false)
    }
  }

  const ACCEPT_TYPES = 'video/*,.mp4,audio/*,.mp3,.mpeg,.mpga,.m4a,.wav,.webm,.acc,.flac,.ogg,.opus,.wma,.wmv,.mov,.avi,.mkv'

  const pickFiles = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = ACCEPT_TYPES
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      if (files.length + selectedFiles.length > 10) {
        toast.error('最多同时选择 10 个文件')
        return
      }
      setSelectedFiles(prev => [...prev, ...files])
    }
    input.click()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith('video/') || f.type.startsWith('audio/')
    )
    if (files.length === 0) {
      toast.error('请拖入音视频文件')
      return
    }
    if (files.length + selectedFiles.length > 10) {
      toast.error('最多同时选择 10 个文件')
      return
    }
    setSelectedFiles(prev => [...prev, ...files])
  }

  const handleUploadGenerate = async () => {
    if (selectedFiles.length === 0) return

    if (!isSmartMode && !selectedModelInfo) {
      toast.error('请选择模型')
      return
    }

    if (multiFileMode === 'merge') {
      toast.error('合并功能正在开发中，请选择"独立任务"模式')
      return
    }

    setIsGenerating(true)
    let successCount = 0

    for (const file of selectedFiles) {
      try {
        const fd = new FormData()
        fd.append('file', file)
        const uploadRes = await uploadFile(fd)

        const isAudio = file.type.startsWith('audio/')
        const payload = {
          video_url: uploadRes.url,
          platform: isAudio ? 'local_audio' : 'local',
          quality: 'medium' as const,
          smart_mode: isSmartMode,
          model_name: isSmartMode ? '' : (selectedModelInfo?.model_name || ''),
          provider_id: isSmartMode ? '' : String(selectedModelInfo?.provider_id || ''),
          style: style || 'minimal',
          format: selectedFormats || [],
          extras: extras || '',
          video_understanding: videoUnderstanding || false,
          video_interval: videoInterval || 4,
          grid_size: [gridCols || 3, gridRows || 3],
          screenshot: selectedFormats?.includes('screenshot') || false,
          link: false,
          output_language: outputLanguage || 'zh',
        }

        const res = await generateNote(payload)
        if (res?.task_id) {
          addPendingTask(res.task_id, payload.platform, payload)
          successCount++
        }
      } catch (err) {
        toast.error(`${file.name} 提交失败`)
      }
    }

    if (successCount > 0) {
      setSelectedFiles([])
      toast.success(`已提交 ${successCount} 个笔记生成任务`)
    }
    setIsGenerating(false)
  }

  return (
    <div className={cn("flex flex-col items-center justify-center w-full h-full gap-6 p-4 md:p-8", className)}>
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

      {/* 链接输入 */}
      {activeTab === 'link' && (
      <div className="w-full max-w-[1000px] flex flex-col gap-4">
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
      )}

      {/* 上传标签页 */}
      {activeTab === 'upload' && (
      <div className="w-full max-w-[800px] flex flex-col items-center gap-4">
        {/* 上传区域 */}
        <div
          className="w-full flex flex-col items-center justify-center gap-4 py-6 px-4
                     border-2 border-dashed border-input rounded-lg
                     bg-background hover:border-pink-200 dark:hover:border-pink-400/30
                     transition-shadow cursor-pointer shadow-sm"
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={handleDrop}
          onClick={pickFiles}
        >
          <FileBox className="w-8 h-8 text-muted-foreground -mb-2" />

          {/* 视觉化总结开关 */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-current/20">
            <Label htmlFor="visual-summary" className="text-sm font-medium cursor-pointer">视觉化总结</Label>
            <Switch
              id="visual-summary"
              checked={videoUnderstanding}
              onCheckedChange={setVideoUnderstanding}
              className="data-[state=checked]:bg-pink-400"
            />
          </div>

          <Button variant="default" className="mb-2" type="button">选择音视频文件</Button>

          <div className="text-center px-2">
            <p className="text-sm text-foreground/50">
              <span className="font-semibold">点击上传或拖拽至此处</span>
              <span className="pl-1">可同时选择多个文件 (单个文件大小 ≤2G)</span>
            </p>
            <span className="text-xs text-foreground/40">
              支持格式：mp3, mp4, mov, mpg, m4a, wav, webm, avi, mkv 等
            </span>
          </div>
        </div>

        {/* 已选文件列表 */}
        {selectedFiles.length > 0 && (
          <div className="w-full flex flex-col gap-2">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background">
                <span className="flex-1 text-sm truncate">{file.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  className="p-1 hover:bg-accent rounded transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFiles(prev => prev.filter((_, i) => i !== idx))
                  }}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 多文件处理选项 */}
        {selectedFiles.length > 1 && (
          <div className="w-full flex items-center gap-2 px-1">
            <span className="text-sm text-muted-foreground">多文件处理：</span>
            <button
              className={cn(
                "px-3 py-1 rounded-md text-sm transition-colors",
                multiFileMode === 'separate'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMultiFileMode('separate')}
            >
              每个独立任务
            </button>
            <button
              className={cn(
                "px-3 py-1 rounded-md text-sm transition-colors",
                multiFileMode === 'merge'
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMultiFileMode('merge')}
            >
              合并为一个任务
            </button>
          </div>
        )}

        {/* 提交按钮 */}
        <Button
          className="w-[280px] h-12 rounded-3xl bg-foreground text-primary-foreground hover:bg-foreground/90 flex items-center gap-2 text-base font-medium"
          onClick={handleUploadGenerate}
          disabled={selectedFiles.length === 0 || isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          {isGenerating ? '提交中...' : `生成笔记 (${selectedFiles.length})`}
        </Button>
      </div>
      )}

      {/* 总结设置对话框 */}
      <SummarySettings open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* 模型选择对话框 */}
      <ModelSelectDialog open={modelSelectOpen} onOpenChange={setModelSelectOpen} />

      {/* 笔记可用性预检对话框 */}
      {availabilityDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAvailabilityDialog(null)}>
          <div className="bg-background rounded-lg shadow-lg max-w-md w-full p-6 relative" onClick={e => e.stopPropagation()}>
            <button
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setAvailabilityDialog(null)}
              aria-label="关闭"
            >
              <X className="size-4" />
            </button>
            <h3 className="text-lg font-bold mb-2">发现已有笔记</h3>
            <p className="text-muted-foreground mb-4">
              该视频已有现成笔记{availabilityDialog.title ? `「${availabilityDialog.title}」` : ''}，可以直接查看，无需重新生成。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setAvailabilityDialog(null); doGenerateNote() }}>
                重新生成
              </Button>
              <Button onClick={() => {
                if (availabilityDialog.task_id) {
                  // 调用生成接口，后端会自动复用
                  const payload = {
                    video_url: inputValue.trim(),
                    platform: effectivePlatform,
                    quality: 'medium' as const,
                    smart_mode: isSmartMode,
                    model_name: isSmartMode ? '' : (selectedModelInfo?.model_name || ''),
                    provider_id: isSmartMode ? '' : String(selectedModelInfo?.provider_id || ''),
                    style: style || 'minimal',
                  }
                  generateNote(payload).then(res => {
                    if (res?.task_id) {
                      addPendingTask(res.task_id, effectivePlatform, payload)
                      setInputValue('')
                      toast.success('笔记已保存到我的笔记！')
                    }
                  }).catch(() => toast.error('保存笔记失败'))
                }
              }}>
              保存到我的笔记
              </Button>
            </div>
          </div>
        </div>
      )}
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
