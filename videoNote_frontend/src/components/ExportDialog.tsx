import { useState } from 'react'
import { Package, FileText, Type, Highlighter, List, ChevronDown, Check, Minus, Copy, Download, FileTextIcon, FolderArchive, BookOpen, Paperclip, Image, Sparkles, Mail, Cloud, SquarePen, Box } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task } from '@/store/taskStore'
import MarkdownRenderer from '@/components/MarkdownRenderer'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  selectedContent: string
}

interface ContentSection {
  id: string
  label: string
  icon: React.ReactNode
  iconColor: string
  enabled: boolean
  items: { id: string; label: string; checked: boolean; disabled: boolean; badge?: string }[]
}

export function ExportDialog({ open, onOpenChange, task, selectedContent }: ExportDialogProps) {
  const [activeTab, setActiveTab] = useState('download')

  // 内容选择状态
  const [contentSections, setContentSections] = useState<ContentSection[]>([
    {
      id: 'summary',
      label: '总结摘要',
      icon: <FileText className="size-5" />,
      iconColor: 'text-sky-500',
      enabled: true,
      items: [
        { id: 'fullSummary', label: '全文总结', checked: true, disabled: false },
        { id: 'chapterSummary', label: '包含章节总结', checked: true, disabled: false },
        { id: 'customSummaries', label: '包含自定义总结', checked: false, disabled: true, badge: '暂无内容' },
        { id: 'reasoning', label: '包含思考过程', checked: false, disabled: true, badge: '暂无内容' },
      ],
    },
    {
      id: 'rawArticle',
      label: '文章脚本',
      icon: <Type className="size-5" />,
      iconColor: 'text-muted-foreground',
      enabled: false,
      items: [
        { id: 'rawArticleText', label: '口播逐字稿', checked: false, disabled: false },
        { id: 'articleGroupBySpeaker', label: '按说话人分组', checked: true, disabled: false },
        { id: 'polishedArticle', label: '包含 AI 润色内容', checked: false, disabled: true, badge: '暂无内容' },
        { id: 'aiArticle', label: '包含 AI 改写内容', checked: false, disabled: true, badge: '暂无内容' },
      ],
    },
    {
      id: 'highlightNotes',
      label: '高亮笔记',
      icon: <Highlighter className="size-5" />,
      iconColor: 'text-muted-foreground opacity-50',
      enabled: false,
      items: [],
    },
    {
      id: 'subtitles',
      label: '字幕列表',
      icon: <List className="size-5" />,
      iconColor: 'text-muted-foreground',
      enabled: false,
      items: [
        { id: 'includeSpeakers', label: '包含说话人', checked: false, disabled: false },
      ],
    },
  ])

  // 展开状态
  const [expandedSections, setExpandedSections] = useState<string[]>(['summary', 'rawArticle', 'highlightNotes', 'subtitles'])

  const toggleSection = (id: string) => {
    setExpandedSections(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleItem = (sectionId: string, itemId: string) => {
    setContentSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          items: section.items.map(item =>
            item.id === itemId && !item.disabled ? { ...item, checked: !item.checked } : item
          ),
        }
      }
      return section
    }))
  }

  const toggleSectionCheckbox = (sectionId: string) => {
    setContentSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        const allChecked = section.items.every(i => i.checked || i.disabled)
        return {
          ...section,
          enabled: !allChecked,
          items: section.items.map(item =>
            !item.disabled ? { ...item, checked: !allChecked } : item
          ),
        }
      }
      return section
    }))
  }

  // 操作函数
  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(selectedContent)
    toast.success('已复制 Markdown 到剪贴板')
  }

  const handleCopyPlainText = () => {
    const plainText = selectedContent
      .replace(/#+\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/^[-*]\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      .replace(/---/g, '')
      .replace(/\n{3,}/g, '\n\n')
    navigator.clipboard.writeText(plainText)
    toast.success('已复制纯文本到剪贴板')
  }

  const handleDownloadMarkdown = () => {
    const name = task.audioMeta?.title || 'note'
    const blob = new Blob([selectedContent], { type: 'text/markdown;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('已下载 Markdown 文件')
  }

  const handleDownloadText = () => {
    const name = task.audioMeta?.title || 'note'
    const plainText = selectedContent
      .replace(/#+\s/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${name}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('已下载文本文件')
  }

  const handleDownloadPdf = async () => {
    if (!task.id) return
    try {
      const response = await fetch(`/api/export/pdf/${task.id}`)
      if (!response.ok) throw new Error('PDF 导出失败')
      const blob = await response.blob()
      const filename = task.audioMeta?.title || 'note'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.pdf`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('PDF 导出成功')
    } catch {
      toast.error('PDF 导出失败')
    }
  }

  const handleDownloadPandocFormat = async (format: string, ext: string) => {
    if (!task.id) return
    try {
      const response = await fetch(`/api/export/${format}/${task.id}`)
      if (!response.ok) throw new Error()
      const blob = await response.blob()
      const filename = task.audioMeta?.title || '笔记'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.${ext}`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`${ext.toUpperCase()} 导出成功`)
    } catch {
      toast.error(`${ext.toUpperCase()} 导出失败`)
    }
  }

  // 格式按钮配置
  const formatButtons = [
    { id: 'md', label: 'Markdown', icon: <FileTextIcon className="size-6" />, ext: '.md', enabled: true },
    { id: 'textbundle', label: 'TextBundle', icon: <FolderArchive className="size-6" />, ext: '.textbundle', enabled: false, badge: 'Gem' },
    { id: 'txt', label: 'Text', icon: <Type className="size-6" />, ext: '.txt', enabled: true },
    { id: 'pdf', label: 'PDF', icon: <Paperclip className="size-6" />, ext: '.pdf', enabled: true, badge: 'Gem' },
    { id: 'docx', label: 'Word', icon: <FileTextIcon className="size-6" />, ext: '.docx', enabled: true },
    { id: 'epub', label: 'EPUB', icon: <BookOpen className="size-6" />, ext: '.epub', enabled: true },
    { id: 'html', label: 'HTML', icon: <FileTextIcon className="size-6" />, ext: '.html', enabled: true },
    { id: 'png', label: 'Image', icon: <Image className="size-6" />, ext: '.png', enabled: true, badge: 'Gem' },
    { id: 'srt', label: 'SRT', icon: <List className="size-6" />, ext: '.srt', enabled: false, badge: 'Gem' },
    { id: 'vtt', label: 'VTT', icon: <List className="size-6" />, ext: '.vtt', enabled: false, badge: 'Gem' },
  ]

  const handleFormatClick = (format: typeof formatButtons[0]) => {
    if (!format.enabled) return
    switch (format.id) {
      case 'md': handleDownloadMarkdown(); break
      case 'txt': handleDownloadText(); break
      case 'pdf': handleDownloadPdf(); break
      case 'html': handleDownloadPandocFormat('html', 'html'); break
      case 'docx': handleDownloadPandocFormat('docx', 'docx'); break
      case 'epub': handleDownloadPandocFormat('epub', 'epub'); break
      case 'png': toast.info('请在工具栏点击「导出图文」按钮'); break
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-6 text-pink-400" />
            导出内容
          </DialogTitle>
          <DialogDescription>
            选择您想导出的内容部分和执行的操作。
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 py-4 md:grid-cols-[1fr_2fr]">
          {/* 左侧：选择内容部分 */}
          <div className="space-y-2">
            <div className="mb-0 text-base font-semibold">选择内容部分</div>
            <p className="mb-3 text-sm text-muted-foreground">
              勾选需要导出的各个部分。点击箭头可展开选项。
            </p>

            <div className="space-y-2">
              {contentSections.map(section => (
                <div key={section.id} className="rounded-md border">
                  <div className="flex">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleSection(section.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(section.id) } }}
                      className={cn(
                        "flex-1 justify-between font-medium flex cursor-pointer items-center gap-3 p-3 transition-colors",
                        expandedSections.includes(section.id) && "rounded-b-none",
                        section.id === 'summary' && "bg-sky-50/50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={section.items.length > 0
                            ? (section.items.every(i => i.checked || i.disabled) ? true : section.items.some(i => i.checked) ? 'indeterminate' : false)
                            : false
                          }
                          disabled={section.items.every(i => i.disabled)}
                          onCheckedChange={() => toggleSectionCheckbox(section.id)}
                          className="mr-2"
                        />
                        <div className={cn("flex items-center gap-3", section.items.length === 0 && "opacity-50")}>
                          <span className={cn(section.iconColor)}>{section.icon}</span>
                          <span className="font-medium">{section.label}</span>
                        </div>
                      </div>
                      <ChevronDown className={cn(
                        "size-4 shrink-0 transition-transform duration-200",
                        expandedSections.includes(section.id) && "rotate-180"
                      )} />
                    </div>
                  </div>

                  {expandedSections.includes(section.id) && section.items.length > 0 && (
                    <div className="pt-1 pr-3 pb-3 pl-12">
                      <div className="space-y-3">
                        {section.items.map(item => (
                          <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={item.id}
                              checked={item.checked}
                              disabled={item.disabled}
                              onCheckedChange={() => toggleItem(section.id, item.id)}
                            />
                            <label htmlFor={item.id} className={cn(
                              "text-sm leading-none font-medium cursor-pointer",
                              item.disabled && "cursor-not-allowed opacity-50"
                            )}>
                              <div className="flex items-center gap-1">
                                {item.id === 'aiArticle' && <Sparkles className="size-3 text-gray-400" />}
                                {item.label}
                                {item.badge && <span className="text-xs text-gray-400">({item.badge})</span>}
                              </div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {expandedSections.includes(section.id) && section.items.length === 0 && (
                    <div className="pt-1 pr-3 pb-3 pl-12">
                      <div className="flex items-center gap-1">
                        <Highlighter className="size-3 text-gray-400" />
                        <span className="text-sm text-gray-400">暂无内容</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：选择操作 */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">选择操作</div>
                <p className="text-sm text-muted-foreground">选择如何使用选定的内容。</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
                  <Copy className="size-4" />
                  复制 Markdown
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopyPlainText}>
                  <Copy className="size-4" />
                  复制纯文本
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="preview">快速预览</TabsTrigger>
                <TabsTrigger value="download">下载为文件</TabsTrigger>
                <TabsTrigger value="sendToApp">导出到笔记</TabsTrigger>
                <TabsTrigger value="template">根据模板生成</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="mt-4">
                <div className="rounded-lg border">
                  <div className="border-b bg-muted/30 p-4">
                    <h4 className="font-medium">Markdown 预览</h4>
                    <p className="text-sm text-muted-foreground">预览选中内容的渲染效果</p>
                  </div>
                  <ScrollArea className="h-[500px] p-6">
                    <MarkdownRenderer content={selectedContent} />
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="download" className="mt-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {formatButtons.map(format => (
                    <button
                      key={format.id}
                      onClick={() => handleFormatClick(format)}
                      disabled={!format.enabled}
                      className={cn(
                        "inline-flex items-center whitespace-nowrap text-sm font-medium transition-all border bg-card shadow-xs rounded-md relative h-auto flex-col justify-center gap-2 p-4",
                        format.enabled
                          ? "hover:bg-accent hover:text-accent-foreground"
                          : "opacity-60 cursor-not-allowed"
                      )}
                    >
                      {format.icon}
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{format.label}</span>
                        {format.badge && (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold transition-colors border-transparent bg-primary text-primary-foreground text-xs">
                            <Sparkles className="size-3" />
                          </span>
                        )}
                      </div>
                      <code className="text-xs">{format.ext}</code>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="sendToApp" className="mt-4">
                <div className="flex flex-col gap-y-3 text-sm">
                  {/* 已配置集成 */}
                  <div>
                    <h4 className="mb-1.5 font-semibold text-muted-foreground">已配置集成</h4>
                    <Separator className="mb-2" />
                    <div className="flex flex-col gap-y-1">
                      <button
                        onClick={() => toast.info('Notion 集成即将上线')}
                        className="flex min-w-44 cursor-pointer items-center justify-start rounded-lg border bg-card p-2 text-sm shadow-xs hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
                          </svg>
                          <span>保存到 Notion</span>
                        </span>
                      </button>
                      <button
                        onClick={() => toast.info('Email 集成即将上线')}
                        className="flex min-w-44 cursor-pointer items-center justify-start rounded-lg border bg-card p-2 text-sm shadow-xs hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <Mail className="size-5" />
                          <span>保存到 Email</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* URL Scheme 集成 */}
                  <div>
                    <h4 className="mb-1.5 font-semibold text-muted-foreground">URL Scheme 集成</h4>
                    <Separator className="mb-2" />
                    <div className="flex flex-col gap-y-1">
                      <button
                        onClick={() => toast.info('Roam Capture 集成即将上线')}
                        className="flex min-w-44 cursor-pointer items-center justify-start rounded-lg border bg-card p-2 text-sm shadow-xs hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M11.14.028C7.315.36 4.072 2.263 1.98 5.411.487 7.646-.232 10.589.067 13.211c.32 2.772 1.4 5.124 3.242 7.049 4.643 4.852 12.252 5.001 17.038.343 1.085-1.057 1.738-1.959 2.407-3.303a11.943 11.943 0 0 0-2.429-13.925C18.372 1.495 16.015.388 13.27.078c-.68-.083-1.56-.1-2.13-.05zm4.814 2.567c1.112.437 2.086 1.068 3.032 1.986.62.598 1.323 1.46 1.3 1.599-.016.072-1.626.725-1.792.725-.056 0-.078-.072-.078-.25 0-.138-.011-.248-.028-.248-.01 0-.758.459-1.654 1.023-.897.565-1.666 1.024-1.71 1.024-.05 0-.133-.061-.194-.139-.127-.16-.216-.171-.354-.044-.066.056-.1.166-.1.316v.226l-.824.46c-.46.249-.89.453-.968.453h-.144V8.161c0-.863.016-2.025.038-2.573.034-.99.04-1.007.155-1.007.117 0 .128-.028.155-.514.067-1.107.25-1.284 1.362-1.323l.514-.016.16-.233c.156-.226.167-.226.366-.171.116.028.46.15.764.271zm-7.05.011l.122.183.641-.006c.604 0 .659.011.902.15.355.21.482.497.526 1.145l.033.498.172.016.171.017.017 2.716.011 2.722-.232.138a3.024 3.024 0 0 0-.936.875l-.177.27h-5.24v-.325l-.592-.017-.598-.017-.398-.586c-.332-.493-.454-.626-.758-.825-.415-.265-.404-.193-.139-1.023.659-2.025 2.203-3.945 4.1-5.107.67-.409 1.932-.995 2.159-1.001.055-.005.155.078.216.177zm12.163 4.902c.354.686.725 1.588.725 1.765 0 .071-.1.149-.327.26-.326.154-.393.237-.393.503 0 .155-.166.36-.564.692l-.327.27h-.99v.333h-2.767v-.886l-.332-.42c-.183-.227-.332-.432-.332-.454 0-.022 1.073-.68 2.39-1.46 2.17-1.29 2.402-1.417 2.485-1.34.05.045.244.377.432.737zm-5.556 3.087c.243.354.454.664.46.686.01.027-.394.05-.892.05h-.918l-.2-.332c-.11-.183-.193-.36-.182-.388.028-.083 1.167-.708 1.234-.68.033.011.254.31.498.664zm-7.282 2.567c.254.398.442.741.415.769-.111.1-5.163 3.32-5.213 3.32-.155 0-.813-1.317-1.024-2.048-.249-.863-.265-.769.188-1.045.178-.111.371-.321.637-.703l.387-.548.603-.027.609-.028.017-.21.016-.205H7.77l.459.725zm1.815-.476c.066.122.127.249.127.288 0 .077-.996.686-1.057.647-.05-.028-.714-1.1-.714-1.15 0-.023.343-.028.758-.023l.758.017.128.221zm9.158-.044l.016.21.554.028c.597.027.525 0 1.184.481.011.006.06.194.11.41.095.425.128.459.493.547.288.072.293.133.072.78-.57 1.682-1.787 3.425-3.287 4.686-.642.542-.603.542-.559-.055.045-.614-.027-.935-.254-1.162-.26-.255-.526-.221-1.3.177-.51.26-.698.332-.897.332-.327 0-.631-.094-.825-.255l-.16-.127.393-.36c.42-.381.62-.73.525-.907-.16-.298-.453-.37-1.045-.26-.498.1-.864.105-1.013.028-.188-.105-.288-.376-.26-.741.028-.332.022-.343-.216-.62l-.238-.282v-1.765l.393-.271c.216-.144.559-.448.758-.675l.37-.404h5.17l.017.205zm-7.814 2.157v.758l-.276.282-.277.283.083.238c.1.282.105.52.022.674-.1.194-.293.222-.896.133a8.212 8.212 0 0 0-.764-.083c-.68 0-.703.482-.06 1.256.31.37.31.365-.084.564-.553.277-.902.25-1.389-.116-.41-.304-.647-.393-.968-.36-.21.017-.31.061-.443.2l-.177.177.006.686c0 .382-.011.691-.023.691-.06 0-1.023-.846-1.45-1.272-.442-.448-.995-1.123-.995-1.217 0-.044 1.516-.72 1.615-.72.034 0 .045.084.034.194-.011.105-.006.194.01.194.017 0 1.362-.747 2.989-1.66a204.276 204.276 0 0 1 3.005-1.66c.022 0 .038.343.038.758z" />
                          </svg>
                          <span>保存到 Roam Capture</span>
                        </span>
                      </button>
                      <button
                        onClick={() => toast.info('Obsidian 集成即将上线')}
                        className="flex min-w-44 cursor-pointer flex-col items-start justify-start rounded-lg border bg-card p-2 text-sm shadow-xs hover:bg-accent transition-colors h-auto"
                      >
                        <span className="flex items-center gap-1 w-full">
                          <svg className="size-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.355 18.538a68.967 68.959 0 0 0 1.858-2.954.81.81 0 0 0-.062-.9c-.516-.685-1.504-2.075-2.042-3.362-.553-1.321-.636-3.375-.64-4.377a1.707 1.707 0 0 0-.358-1.05l-3.198-4.064a3.744 3.744 0 0 1-.076.543c-.106.503-.307 1.004-.536 1.5-.134.29-.29.6-.446.914l-.31.626c-.516 1.068-.997 2.227-1.132 3.59-.124 1.26.046 2.73.815 4.481.128.011.257.025.386.044a6.363 6.363 0 0 1 3.326 1.505c.916.79 1.744 1.922 2.415 3.5zM8.199 22.569c.073.012.146.02.22.02.78.024 2.095.092 3.16.29.87.16 2.593.64 4.01 1.055 1.083.316 2.198-.548 2.355-1.664.114-.814.33-1.735.725-2.58l-.01.005c-.67-1.87-1.522-3.078-2.416-3.849a5.295 5.295 0 0 0-2.778-1.257c-1.54-.216-2.952.19-3.84.45.532 2.218.368 4.829-1.425 7.531zM5.533 9.938c-.023.1-.056.197-.098.29L2.82 16.059a1.602 1.602 0 0 0 .313 1.772l4.116 4.24c2.103-3.101 1.796-6.02.836-8.3-.728-1.73-1.832-3.081-2.55-3.831zM9.32 14.01c.615-.183 1.606-.465 2.745-.534-.683-1.725-.848-3.233-.716-4.577.154-1.552.7-2.847 1.235-3.95.113-.235.223-.454.328-.664.149-.297.288-.577.419-.86.217-.47.379-.885.46-1.27.08-.38.08-.72-.014-1.043-.095-.325-.297-.675-.68-1.06a1.6 1.6 0 0 0-1.475.36l-4.95 4.452a1.602 1.602 0 0 0-.513.952l-.427 2.83c.672.59 2.328 2.316 3.335 4.711.09.21.175.43.253.653z" />
                          </svg>
                          <span>保存到 Obsidian</span>
                        </span>
                        <span className="mt-0.5 w-full truncate text-left text-xs text-muted-foreground">videoNote/</span>
                      </button>
                      <button
                        onClick={() => {
                          if (task.id) {
                            toast.promise(
                              fetch(`/api/export/siyuan/${task.id}`, { method: 'POST' }),
                              {
                                loading: '正在保存到思源笔记...',
                                success: '已保存到思源笔记',
                                error: '保存失败，请检查思源笔记配置',
                              }
                            )
                          }
                        }}
                        className="flex min-w-44 cursor-pointer items-center justify-start rounded-lg border bg-card p-2 text-sm shadow-xs hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <svg className="size-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="m0 8.455 6.818-6.819L12 6.818l5.182-5.182L24 8.455v13.909l-6.818-6.819v-2.314l5.182 5.182v-9.28L17.182 3.95v11.594L12 20.727l-5.182-5.182v-2.314L12 18.413v-9.28L6.818 3.95v11.594L0 22.364Z" />
                          </svg>
                          <span>保存到思源笔记</span>
                        </span>
                      </button>
                      <button
                        onClick={() => toast.info('Logseq 集成即将上线')}
                        className="flex min-w-44 cursor-pointer items-center justify-start rounded-lg border bg-card p-2 text-sm shadow-xs hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <Box className="size-4" />
                          <span>保存到 Logseq</span>
                        </span>
                      </button>
                      <button
                        onClick={() => toast.info('Readwise 集成即将上线')}
                        className="flex min-w-44 cursor-pointer items-center justify-start rounded-lg border bg-card p-2 text-sm shadow-xs hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-1">
                          <BookOpen className="size-5" />
                          <span>保存到 Readwise Web</span>
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 可配置的 API 集成 */}
                  <div>
                    <h4 className="mb-1.5 font-semibold text-muted-foreground">可配置的 API 集成</h4>
                    <Separator className="mb-2" />
                    <div className="flex flex-col gap-y-1">
                      <a href="/settings/siyuan" className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors">
                        <BookOpen className="mr-2 size-4" />
                        配置思源笔记
                      </a>
                      <button
                        onClick={() => toast.info('Wolai 集成即将上线')}
                        className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors text-left"
                      >
                        <Box className="mr-2 size-4" />
                        配置 Wolai
                      </button>
                      <button
                        onClick={() => toast.info('Readwise Reader 集成即将上线')}
                        className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors text-left"
                      >
                        <BookOpen className="mr-2 size-4" />
                        配置 Readwise Reader
                      </button>
                      <button
                        onClick={() => toast.info('Cubox 集成即将上线')}
                        className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors text-left"
                      >
                        <Box className="mr-2 size-4" />
                        配置 Cubox
                      </button>
                      <button
                        onClick={() => toast.info('Flomo 集成即将上线')}
                        className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors text-left"
                      >
                        <FileText className="mr-2 size-4" />
                        配置 Flomo
                      </button>
                      <button
                        onClick={() => toast.info('飞书 集成即将上线')}
                        className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors text-left"
                      >
                        <Cloud className="mr-2 size-4" />
                        配置飞书
                      </button>
                    </div>
                  </div>

                  {/* 高级设置 */}
                  <div>
                    <h4 className="mb-1.5 font-semibold text-muted-foreground">高级设置</h4>
                    <Separator className="mb-2" />
                    <div className="flex flex-col gap-y-1">
                      <a href="/settings" className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors">
                        <Cloud className="mr-2 size-4" />
                        管理 API 集成
                      </a>
                      <a href="/settings" className="flex w-full items-center justify-start rounded-lg border bg-card p-1.5 text-sm shadow-xs hover:bg-accent transition-colors">
                        <SquarePen className="mr-2 size-4" />
                        笔记导出设置
                      </a>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="template" className="mt-4">
                <div className="text-sm text-muted-foreground">模板生成功能即将上线...</div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}