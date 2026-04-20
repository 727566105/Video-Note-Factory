'use client'

import { useEffect, useState, useRef } from 'react'
import { Copy, Download, BrainCircuit, FileText, MoreHorizontal, FileDown, Image, BookOpen, Trash, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { ExportPDFButton } from '@/components/ExportPDFButton'
import { ExportSiyuanButton } from '@/components/ExportSiyuanButton'
import { ExportImageButton } from '@/components/ExportImageButton'
import { ToolbarConfigDialog } from '@/components/ToolbarConfigDialog'
import { useSystemStore } from '@/store/configStore'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface VersionNote {
  ver_id: string
  model_name?: string
  style?: string
  created_at?: string
}

interface NoteHeaderProps {
  currentTask?: {
    markdown: VersionNote[] | string
    id?: string
  }
  isMultiVersion: boolean
  currentVerId: string
  setCurrentVerId: (id: string) => void
  modelName: string
  style: string
  noteStyles: { value: string; label: string }[]
  onCopy: () => void
  onDownload: () => void
  onDelete?: () => void
  createAt?: string | Date
  setShowTranscribe: (show: boolean) => void
  showTranscribe?: boolean
  viewMode?: 'map' | 'preview'
  setViewMode?: (mode: 'map' | 'preview') => void
}

export function MarkdownHeader({
  currentTask,
  isMultiVersion,
  currentVerId,
  setCurrentVerId,
  modelName,
  style,
  noteStyles,
  onCopy,
  onDownload,
  onDelete,
  createAt,
  showTranscribe,
  setShowTranscribe,
  viewMode,
  setViewMode,
}: NoteHeaderProps) {
  const [copied, setCopied] = useState(false)
  const [configDialogOpen, setConfigDialogOpen] = useState(false)
  const pdfBtnRef = useRef<HTMLButtonElement>(null)
  const imageBtnRef = useRef<HTMLButtonElement>(null)
  const siyuanBtnRef = useRef<HTMLButtonElement>(null)

  const toolbarConfig = useSystemStore(state => state.toolbarConfig)

  useEffect(() => {
    let timer: NodeJS.Timeout
    if (copied) {
      timer = setTimeout(() => setCopied(false), 2000)
    }
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = () => {
    onCopy()
    setCopied(true)
  }

  const styleName = noteStyles.find(v => v.value === style)?.label || style

  const reversedMarkdown: VersionNote[] = Array.isArray(currentTask?.markdown)
    ? [...currentTask!.markdown].reverse()
    : []

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return d
      .toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      .replace(/\//g, '-')
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b bg-white/95 px-4 py-2 backdrop-blur-sm">
      {/* 左侧区域：版本 + 标签 + 创建时间 */}
      <div className="flex flex-wrap items-center gap-3">
        {isMultiVersion && (
          <Select value={currentVerId} onValueChange={setCurrentVerId}>
            <SelectTrigger className="h-8 w-[160px] text-sm">
              <SelectValue>
                {(() => {
                  const idx = currentTask?.markdown.findIndex(v => v.ver_id === currentVerId)
                  return idx !== -1 ? `版本（${currentVerId.slice(-6)}）` : ''
                })()}
              </SelectValue>
            </SelectTrigger>

            <SelectContent>
              {(currentTask?.markdown || []).map((v, idx) => {
                const shortId = v.ver_id.slice(-6)
                return (
                  <SelectItem key={v.ver_id} value={v.ver_id}>
                    {`版本（${shortId}）`}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}

        <Badge variant="secondary" className="bg-pink-100 text-pink-700 hover:bg-pink-200">
          {modelName}
        </Badge>
        <Badge variant="secondary" className="bg-cyan-100 text-cyan-700 hover:bg-cyan-200">
          {styleName}
        </Badge>

        {createAt && (
          <div className="text-muted-foreground text-sm">创建时间: {formatDate(createAt)}</div>
        )}
      </div>

      {/* 右侧操作按钮 */}
      <div className="flex items-center gap-1">
        {/* 外部显示的按钮 */}
        {toolbarConfig.externalButtons.includes('mindMap') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setViewMode?.(viewMode == 'preview' ? 'map' : 'preview')
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                >
                  <BrainCircuit className="mr-1.5 h-4 w-4" />
                  <span className="text-sm">{viewMode == 'preview' ? '思维导图' : 'markdown'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>思维导图</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {toolbarConfig.externalButtons.includes('exportPdf') && currentTask?.id && (
          <ExportPDFButton
            taskId={currentTask.id}
            variant="ghost"
            size="sm"
            className="h-8 px-2"
          />
        )}

        {toolbarConfig.externalButtons.includes('exportImage') && currentTask?.id && (
          <ExportImageButton
            taskId={currentTask.id}
            variant="ghost"
            size="sm"
            className="h-8 px-2"
          />
        )}

        {toolbarConfig.externalButtons.includes('exportSiyuan') && currentTask?.id && (
          <ExportSiyuanButton
            taskId={currentTask.id}
            variant="ghost"
            size="sm"
            className="h-8 px-2"
          />
        )}

        {toolbarConfig.externalButtons.includes('exportMd') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={onDownload} variant="ghost" size="sm" className="h-8 px-2">
                  <Download className="mr-1.5 h-4 w-4" />
                  <span className="text-sm">导出 Markdown</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>下载为 Markdown 文件</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {toolbarConfig.externalButtons.includes('copy') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleCopy} variant="ghost" size="sm" className="h-8 px-2">
                  <Copy className="mr-1.5 h-4 w-4" />
                  <span className="text-sm">{copied ? '已复制' : '复制'}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制内容</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {toolbarConfig.externalButtons.includes('source') && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => {
                    setShowTranscribe?.(!showTranscribe)
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                >
                  <span className="text-sm">原文参照</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>原文参照</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {toolbarConfig.externalButtons.includes('delete') && onDelete && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={onDelete} variant="ghost" size="sm" className="h-8 px-2 text-red-600 hover:bg-red-50 hover:text-red-700">
                  <Trash className="mr-1.5 h-4 w-4" />
                  <span className="text-sm">删除</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除笔记</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {/* 下拉菜单按钮 */}
        {toolbarConfig.menuButtons.length > 0 && (
          <>
            {/* 隐藏的导出按钮，用于触发点击 */}
            <div className="hidden">
              {currentTask?.id && (
                <>
                  <ExportPDFButton ref={pdfBtnRef} taskId={currentTask.id} variant="ghost" size="sm" />
                  <ExportImageButton ref={imageBtnRef} taskId={currentTask.id} variant="ghost" size="sm" />
                  <ExportSiyuanButton ref={siyuanBtnRef} taskId={currentTask.id} variant="ghost" size="sm" />
                </>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {toolbarConfig.menuButtons.includes('mindMap') && (
                  <DropdownMenuItem onClick={() => setViewMode?.(viewMode == 'preview' ? 'map' : 'preview')}>
                    <BrainCircuit className="mr-2 h-4 w-4" />
                    {viewMode == 'preview' ? '思维导图' : 'Markdown'}
                  </DropdownMenuItem>
                )}
                {toolbarConfig.menuButtons.includes('exportPdf') && currentTask?.id && (
                  <DropdownMenuItem onClick={() => pdfBtnRef.current?.click()}>
                    <FileDown className="mr-2 h-4 w-4" />
                    导出 PDF
                  </DropdownMenuItem>
                )}
                {toolbarConfig.menuButtons.includes('exportImage') && currentTask?.id && (
                  <DropdownMenuItem onClick={() => imageBtnRef.current?.click()}>
                    <Image className="mr-2 h-4 w-4" />
                    导出图文
                  </DropdownMenuItem>
                )}
                {toolbarConfig.menuButtons.includes('exportSiyuan') && currentTask?.id && (
                  <DropdownMenuItem onClick={() => siyuanBtnRef.current?.click()}>
                    <BookOpen className="mr-2 h-4 w-4" />
                    导出到思源
                  </DropdownMenuItem>
                )}
                {toolbarConfig.menuButtons.includes('exportMd') && (
                  <DropdownMenuItem onClick={onDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    导出 Markdown
                  </DropdownMenuItem>
                )}
                {toolbarConfig.menuButtons.includes('copy') && (
                  <DropdownMenuItem onClick={handleCopy}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? '已复制' : '复制'}
                  </DropdownMenuItem>
                )}
                {toolbarConfig.menuButtons.includes('source') && (
                  <DropdownMenuItem onClick={() => setShowTranscribe?.(!showTranscribe)}>
                    <FileText className="mr-2 h-4 w-4" />
                    原文参照
                  </DropdownMenuItem>
                )}
                {toolbarConfig.menuButtons.includes('delete') && onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                      <Trash className="mr-2 h-4 w-4" />
                      删除笔记
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* 设置按钮 */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={() => setConfigDialogOpen(true)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>工具栏设置</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <ToolbarConfigDialog open={configDialogOpen} onOpenChange={setConfigDialogOpen} />
      </div>
    </div>
  )
}
