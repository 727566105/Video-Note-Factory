import { useEffect, useState } from 'react'
import { Sparkles, Eye, FileText, StickyNote, Check, Palette, Languages, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Field, FieldGroup } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { noteFormats, noteStyles, outputLanguages } from '@/constant/note.ts'
import { useSummarySettingsStore } from '@/store/summarySettingsStore'
import { toast } from 'sonner'

// 局部模式的值类型（用于详情页，不修改全局 store）
export interface LocalSummaryValues {
  summaryMode?: string
  style?: string
  outputLanguage?: string
  videoUnderstanding?: boolean
  videoInterval?: number
  gridCols?: number
  gridRows?: number
  selectedFormats?: string[]
  extras?: string
}

interface SummarySettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: 'global' | 'local'        // 默认 'global'
  variant?: 'note' | 'collection'  // 默认 'note'；collection 只显示合集总结相关项
  localValues?: LocalSummaryValues  // 局部模式：外部传入的值
  onLocalChange?: (values: LocalSummaryValues) => void  // 局部模式：变更回调
}

// 合集总结模式（与后端 collection.py 的 mode_prompts 对应）
// 注意：mindmap（思维导图）不在此列——它是页面上独立的快捷生成按钮
// （CollectionDetail 的 handleGenerate('mindmap')），不属于「总结模式」选择范畴
const summaryModes = [
  { value: 'overview', label: '综合概述' },
  { value: 'comparison', label: '对比分析' },
  { value: 'timeline', label: '时间线' },
  { value: 'trajectory', label: '博主画像' },
]

export function SummarySettings({
  open,
  onOpenChange,
  mode = 'global',
  variant = 'note',
  localValues,
  onLocalChange
}: SummarySettingsProps) {
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
  const isCollection = variant === 'collection'

  useEffect(() => {
    if (isCollection && activeTab === 'custom') {
      setActiveTab('default')
    }
  }, [activeTab, isCollection])

  // 从全局 store 读取（仅 global 模式使用）
  const globalStore = useSummarySettingsStore()

  // 根据模式决定使用哪个数据源
  const getSummaryMode = () => mode === 'local' ? (localValues?.summaryMode || 'overview') : globalStore.summaryMode
  const getStyle = () => mode === 'local' ? (localValues?.style || 'minimal') : globalStore.style
  const getOutputLanguage = () => mode === 'local' ? (localValues?.outputLanguage || 'zh') : globalStore.outputLanguage
  const getVideoUnderstanding = () => mode === 'local' ? (localValues?.videoUnderstanding ?? true) : globalStore.videoUnderstanding
  const getVideoInterval = () => mode === 'local' ? (localValues?.videoInterval || 4) : globalStore.videoInterval
  const getGridCols = () => mode === 'local' ? (localValues?.gridCols || 3) : globalStore.gridCols
  const getGridRows = () => mode === 'local' ? (localValues?.gridRows || 3) : globalStore.gridRows
  const getSelectedFormats = () => mode === 'local' ? (localValues?.selectedFormats || ['toc', 'link', 'screenshot', 'summary']) : globalStore.selectedFormats
  const getExtras = () => mode === 'local' ? (localValues?.extras || '') : globalStore.extras

  // 设置器：global 模式直接操作 store，local 模式调用回调
  const setSummaryMode = (value: string) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, summaryMode: value })
    } else {
      globalStore.setSummaryMode(value)
    }
  }
  const setStyle = (value: string) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, style: value })
    } else {
      globalStore.setStyle(value)
    }
  }
  const setOutputLanguage = (value: string) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, outputLanguage: value })
    } else {
      globalStore.setOutputLanguage(value)
    }
  }
  const setVideoUnderstanding = (value: boolean) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, videoUnderstanding: value })
    } else {
      globalStore.setVideoUnderstanding(value)
    }
  }
  const setVideoInterval = (value: number) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, videoInterval: value })
    } else {
      globalStore.setVideoInterval(value)
    }
  }
  const setGridCols = (value: number) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, gridCols: value })
    } else {
      globalStore.setGridCols(value)
    }
  }
  const setGridRows = (value: number) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, gridRows: value })
    } else {
      globalStore.setGridRows(value)
    }
  }
  const setSelectedFormats = (value: string[]) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, selectedFormats: value })
    } else {
      globalStore.setSelectedFormats(value)
    }
  }
  const setExtras = (value: string) => {
    if (mode === 'local') {
      onLocalChange?.({ ...localValues, extras: value })
    } else {
      globalStore.setExtras(value)
    }
  }

  // 当前值（根据模式）
  const summaryMode = getSummaryMode()
  const style = getStyle()
  const outputLanguage = getOutputLanguage()
  const videoUnderstanding = getVideoUnderstanding()
  const videoInterval = getVideoInterval()
  const gridCols = getGridCols()
  const gridRows = getGridRows()
  const selectedFormats = getSelectedFormats()
  const extras = getExtras()

  // 自定义总结状态（本地状态，不持久化）
  const [promptContent, setPromptContent] = useState('')
  const [promptName, setPromptName] = useState('')

  // 保存默认配置（仅 global 模式）
  const handleSaveDefaultSettings = () => {
    if (mode === 'global') {
      toast.success('保存成功', {
        icon: <Check className="w-4 h-4" />,
        duration: 2000,
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>总结设置</DialogTitle>
          <DialogDescription>配置视频笔记的总结风格和格式选项</DialogDescription>
        </DialogHeader>

        {/* 滚动内容区域 */}
        <div className="-mx-4 no-scrollbar max-h-[50vh] overflow-y-auto px-4">
          {/* 标签切换 */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg h-10 mb-4">
            <button
              onClick={() => setActiveTab('default')}
              className={cn(
                "flex-1 h-full rounded-md text-sm font-medium transition-all",
                activeTab === 'default'
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              默认配置
            </button>
            {!isCollection && (
              <button
                onClick={() => setActiveTab('custom')}
                className={cn(
                  "flex-1 h-full rounded-md text-sm font-medium transition-all",
                  activeTab === 'custom'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                自定义总结
              </button>
            )}
          </div>

          {activeTab === 'default' ? (
            <FieldGroup>
              {/* 总结模式（仅合集总结设置显示，笔记生成无模式概念） */}
              {isCollection && (
                <Field>
                  <Label className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    总结模式
                  </Label>
                  <Select value={summaryMode} onValueChange={setSummaryMode}>
                    <SelectTrigger>
                      <SelectValue>
                        {summaryModes.find(m => m.value === summaryMode)?.label || '综合概述'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {summaryModes.map(({ label, value }) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {/* 视频理解（仅单条笔记设置显示） */}
              {!isCollection && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                      视频理解
                    </Label>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={videoUnderstanding}
                        onCheckedChange={setVideoUnderstanding}
                        className="data-[state=checked]:bg-foreground"
                      />
                      <span className="text-sm text-muted-foreground">启用</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field>
                      <Label>采样间隔（秒）</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={videoInterval}
                        disabled={!videoUnderstanding}
                        onChange={(e) => setVideoInterval(parseInt(e.target.value) || 4)}
                      />
                    </Field>
                    <Field>
                      <Label>拼图尺寸（列 × 行）</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={gridCols}
                          disabled={!videoUnderstanding}
                          onChange={(e) => setGridCols(parseInt(e.target.value) || 3)}
                          className="w-16 text-center"
                        />
                        <span className="text-sm text-muted-foreground">×</span>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={gridRows}
                          disabled={!videoUnderstanding}
                          onChange={(e) => setGridRows(parseInt(e.target.value) || 3)}
                          className="w-16 text-center"
                        />
                      </div>
                    </Field>
                  </div>
                </div>
              )}

              {/* 笔记风格 + 输出语言（仅单条笔记设置显示） */}
              {!isCollection && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field>
                  <Label className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-muted-foreground" />
                    笔记风格
                  </Label>
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger>
                      <SelectValue>
                        {noteStyles.find(s => s.value === style)?.label || '请选择风格'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {noteStyles.map(({ label, value, desc }) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex flex-col gap-1 py-0.5">
                            <span className="font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">{desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <Label className="flex items-center gap-2">
                    <Languages className="w-4 h-4 text-muted-foreground" />
                    输出语言
                  </Label>
                  <Select value={outputLanguage} onValueChange={setOutputLanguage}>
                    <SelectTrigger>
                      <SelectValue>
                        {outputLanguages.find(l => l.value === outputLanguage)?.label || '中文'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {outputLanguages.map(({ label, value }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              )}

              {/* 笔记格式（仅单条笔记设置显示） */}
              {!isCollection && (
                <Field>
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    笔记格式
                  </Label>
                  <div className="flex flex-wrap gap-3">
                    {noteFormats.map(({ label, value }) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedFormats.includes(value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFormats([...selectedFormats, value])
                          } else {
                            setSelectedFormats(selectedFormats.filter(v => v !== value))
                          }
                        }}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                  </div>
                </Field>
              )}

              {/* 备注（合集与笔记均生效） */}
              <Field>
                <Label className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-muted-foreground" />
                  备注
                </Label>
                <textarea
                  value={extras}
                  onChange={(e) => setExtras(e.target.value)}
                  placeholder="笔记需要罗列出 xxx 关键点…"
                  className="w-full h-20 p-3 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
            </FieldGroup>
          ) : (
            /* 自定义总结内容 */
            <div className="space-y-4">
              {/* 模型区 */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 h-9 rounded-lg border bg-background">
                  <Sparkles className="w-4 h-4 text-foreground" />
                  <span className="text-sm">默认模型</span>
                </div>
                <span className="text-sm text-muted-foreground">大语言模型</span>
              </div>

              {/* 提示词区域 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">提示词内容</span>
                  <button className="text-sm text-foreground hover:underline">
                    提示词规范
                  </button>
                </div>
                <textarea
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  placeholder={`请输入您的自定义总结提示词，比如：\n将以下视频字幕概括成一段简短的要点，然后用列表的形式提取要点信息，为每个要点信息选择一个适当的表情符号。\n输出应使用以下模板：\n\n## 摘要\n## 亮点`}
                  className="w-full h-[140px] p-3 rounded-md border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* 取个名字 */}
              <Field>
                <Label>取个名字</Label>
                <Input
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="请输入一个提示词标题，保存起来吧！"
                />
              </Field>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        {activeTab === 'default' ? (
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">取消</Button>
            </DialogClose>
            <Button
              size="sm"
              onClick={handleSaveDefaultSettings}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              保存
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPromptContent('')
                setPromptName('')
              }}
            >
              清除
            </Button>
            <Button variant="outline" size="sm">
              保存
            </Button>
            <Button
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              保存并重新总结
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
