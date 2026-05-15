import { useState } from 'react'
import { X, ChevronDown, Sparkles, Globe, Languages, Smile, Clock, ListOrdered, AlignLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

interface SummarySettingsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SummarySettings({ open, onOpenChange }: SummarySettingsProps) {
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
  const [showEmoji, setShowEmoji] = useState(true)
  const [showTimestamp, setShowTimestamp] = useState(false)
  const [pointsCount, setPointsCount] = useState([3])
  const [sentenceLength, setSentenceLength] = useState([20])

  // 自定义总结状态
  const [promptContent, setPromptContent] = useState('')
  const [promptName, setPromptName] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden">
        {/* 标题栏 */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold">总结设置</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-6">
          {/* 标签切换 */}
          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg h-10">
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
          </div>

          {activeTab === 'default' ? (
            <>
              {/* 第一行：模型 + 音频语言 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Select defaultValue="gpt4">
                    <SelectTrigger className="w-[140px] h-10 border rounded-lg bg-background">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-muted-foreground" />
                        <SelectValue placeholder="选择模型" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt4">GPT-4</SelectItem>
                      <SelectItem value="gpt3">GPT-3.5</SelectItem>
                      <SelectItem value="claude">Claude</SelectItem>
                      <SelectItem value="deepseek">DeepSeek</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">大语言模型</span>
                </div>

                <div className="flex items-center gap-3">
                  <Select defaultValue="auto">
                    <SelectTrigger className="w-[140px] h-10 border rounded-lg bg-background">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        <SelectValue placeholder="音频语言" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">自动检测</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="en">英文</SelectItem>
                      <SelectItem value="ja">日语</SelectItem>
                      <SelectItem value="ko">韩语</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">音频语言</span>
                </div>
              </div>

              {/* 第二行：输出语言 + Emoji开关 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Select defaultValue="zh">
                    <SelectTrigger className="w-[140px] h-10 border rounded-lg bg-background">
                      <div className="flex items-center gap-2">
                        <Languages className="w-4 h-4 text-muted-foreground" />
                        <SelectValue placeholder="输出语言" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="en">英文</SelectItem>
                      <SelectItem value="ja">日语</SelectItem>
                      <SelectItem value="ko">韩语</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">输出语言</span>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={showEmoji}
                    onCheckedChange={setShowEmoji}
                    className="data-[state=checked]:bg-foreground"
                  />
                  <span className="text-sm text-muted-foreground">是否显示Emoji</span>
                </div>
              </div>

              {/* 第三行：时间戳开关 + 要点个数 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={showTimestamp}
                    onCheckedChange={setShowTimestamp}
                    className="data-[state=checked]:bg-foreground"
                  />
                  <span className="text-sm text-muted-foreground">是否显示时间戳</span>
                </div>

                <div className="flex items-center gap-3 w-[280px]">
                  <ListOrdered className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">要点个数(≤5)</span>
                      <span className="text-sm font-medium">{pointsCount[0]}</span>
                    </div>
                    <Slider
                      value={pointsCount}
                      onValueChange={setPointsCount}
                      max={5}
                      min={1}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* 第四行：句子长短滑块 */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">句子长短(≤30)</span>
                </div>
                <div className="flex items-center gap-4">
                  <Slider
                    value={sentenceLength}
                    onValueChange={setSentenceLength}
                    max={30}
                    min={5}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-8 text-right">{sentenceLength[0]}</span>
                </div>
              </div>
            </>
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
                  <span className="text-sm font-semibold text-foreground">提示词内容</span>
                  <button className="text-sm text-foreground hover:underline">
                    提示词规范
                  </button>
                </div>
                <div className="relative">
                  <textarea
                    value={promptContent}
                    onChange={(e) => setPromptContent(e.target.value)}
                    placeholder={`请输入您的自定义总结提示词，比如：\n将以下视频字幕概括成一段简短的要点，然后用列表的形式提取要点信息，为每个要点信息选择一个适当的表情符号。\n输出应使用以下模板：\n\n## 摘要\n## 亮点`}
                    className="w-full h-[140px] p-3 rounded-lg border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              {/* 取个名字 */}
              <div className="space-y-2">
                <span className="text-sm font-semibold text-foreground">取个名字</span>
                <input
                  type="text"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="请输入一个提示词标题，保存起来吧！"
                  className="w-full h-10 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* 分割线 */}
              <div className="h-px bg-border" />

              {/* 按钮行 */}
              <div className="flex items-center justify-end gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPromptContent('')
                    setPromptName('')
                  }}
                  className="h-8 px-4 text-sm"
                >
                  清除
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-4 text-sm"
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-4 text-sm bg-foreground text-background hover:bg-foreground/90"
                >
                  保存并重新总结
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
