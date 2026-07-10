import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Share2, Download, Upload, FileText, AlertTriangle, Trash2 } from 'lucide-react'
import {
  exportNotes,
  exportAllNotes,
  listExports,
  buildDownloadShareUrl,
  deleteExport,
  previewImport,
  executeImport,
  type ImportPreviewResult,
  type ImportResult,
} from '@/services/noteShare'
import { useAuthStore } from '@/store/authStore'
import { useIsMobile } from '@/hooks/use-mobile'

const NoteSharePage = () => {
  const isMobile = useIsMobile()
  const isAdmin = useAuthStore(state => state.isAdmin())

  // 导出相关
  const [exporting, setExporting] = useState(false)
  const [packageList, setPackageList] = useState<{ name: string; size: number }[]>([])
  const [taskIdsInput, setTaskIdsInput] = useState('')

  // 导入相关
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null)
  const [decisions, setDecisions] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const refreshPackages = useCallback(async () => {
    try {
      const res = await listExports()
      if (res.data?.code === 0) {
        setPackageList(res.data.data?.packages || [])
      }
    } catch {
      // 静默失败
    }
  }, [])

  // 导出指定笔记
  const handleExportSelected = async () => {
    const taskIds = taskIdsInput
      .split(/[\n,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean)
    if (!taskIds.length) {
      toast.error('请输入至少一个笔记 task_id')
      return
    }
    setExporting(true)
    try {
      const res = await exportNotes(taskIds)
      if (res.data?.code === 0) {
        toast.success(`导出成功：${res.data.data?.filename}`)
        refreshPackages()
      } else {
        toast.error(res.data?.msg || '导出失败')
      }
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 一键导出全部
  const handleExportAll = async () => {
    setExporting(true)
    try {
      const res = await exportAllNotes()
      if (res.data?.code === 0) {
        toast.success(`已导出全部笔记：${res.data.data?.filename}`)
        refreshPackages()
      } else {
        toast.error(res.data?.msg || '导出失败')
      }
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // 下载分享包
  const handleDownload = (filename: string) => {
    const a = document.createElement('a')
    a.href = buildDownloadShareUrl(filename)
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // 删除分享包
  const handleDelete = async (filename: string) => {
    try {
      const res = await deleteExport(filename)
      if (res.data?.code === 0) {
        toast.success('已删除')
        refreshPackages()
      }
    } catch {
      toast.error('删除失败')
    }
  }

  // 上传并预览
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.vnpkg') && !file.name.endsWith('.zip')) {
      toast.error('只支持 .vnpkg 或 .zip 格式')
      return
    }
    setUploadProgress(0)
    setPreviewResult(null)
    setImportResult(null)
    setDecisions({})
    setImportDialogOpen(true)
    try {
      const res = await previewImport(file, percent => setUploadProgress(percent))
      if (res.data?.code === 0) {
        const result = res.data.data as ImportPreviewResult
        setPreviewResult(result)
        // 默认决策：冲突的为 new_copy
        const defaultDecisions: Record<string, string> = {}
        result.conflicts.forEach(c => { defaultDecisions[c.task_id] = 'new_copy' })
        result.notes.forEach(n => { defaultDecisions[n.task_id] = defaultDecisions[n.task_id] || 'new_copy' })
        setDecisions(defaultDecisions)
      } else {
        toast.error(res.data?.msg || '预览失败')
        setImportDialogOpen(false)
      }
    } catch {
      toast.error('预览失败，请检查文件格式')
      setImportDialogOpen(false)
    } finally {
      setUploadProgress(null)
    }
  }

  // 执行导入
  const handleImport = async () => {
    if (!previewResult) return
    setImporting(true)
    try {
      const res = await executeImport(previewResult.filename, decisions)
      if (res.data?.code === 0) {
        setImportResult(res.data.data as ImportResult)
        toast.success(`导入完成：成功 ${res.data.data?.success} 条`)
      } else {
        toast.error(res.data?.msg || '导入失败')
      }
    } catch {
      toast.error('导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 md:p-6">
      {/* 笔记分享 */}
      <div className="rounded-lg border border-border bg-background p-4 md:p-6 shadow-sm">
        <div className="mb-4 border-b pb-4">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-primary" />
            {!isMobile && <h2 className="text-lg font-semibold">笔记分享</h2>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            导出自己的笔记分享给他人，或导入他人分享的笔记包。不含密码和配置，纯笔记内容。
          </p>
        </div>

        {/* 导出区 */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">导出笔记</h3>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleExportAll} disabled={exporting} variant="default">
              <Download className="mr-2 size-4" />
              {exporting ? '导出中...' : '一键导出全部'}
            </Button>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">导出指定笔记（输入 task_id，逗号或换行分隔）</label>
            <textarea
              className="w-full rounded-md border border-border bg-background p-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="uuid1, uuid2, uuid3..."
              value={taskIdsInput}
              onChange={e => setTaskIdsInput(e.target.value)}
            />
            <Button onClick={handleExportSelected} disabled={exporting || !taskIdsInput.trim()} variant="outline" size="sm">
              <Download className="mr-2 size-4" />
              导出选中笔记
            </Button>
          </div>

          {/* 已导出的分享包列表 */}
          {packageList.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium">已导出的分享包</label>
              <div className="space-y-1">
                {packageList.map(pkg => (
                  <div key={pkg.name} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span className="font-mono text-xs">{pkg.name}</span>
                      <span className="text-muted-foreground">({(pkg.size / 1024 / 1024).toFixed(1)} MB)</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(pkg.name)}>
                        <Download className="size-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(pkg.name)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={refreshPackages}>刷新列表</Button>
            </div>
          )}
        </div>

        {/* 导入区 */}
        {isAdmin && (
          <div className="mt-6 space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium">导入笔记</h3>
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertDescription>
                导入操作仅管理员可用。导入时会检测冲突，你可以选择跳过、覆盖或导入为新副本。
              </AlertDescription>
            </Alert>
            <div>
              <input
                type="file"
                accept=".vnpkg,.zip"
                onChange={handleFileSelect}
                className="hidden"
                id="vnpkg-upload"
              />
              <Button asChild variant="default">
                <label htmlFor="vnpkg-upload" className="cursor-pointer">
                  <Upload className="mr-2 size-4" />
                  上传分享包
                </label>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* 导入预览/冲突解决对话框 */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>导入笔记分享包</DialogTitle>
            <DialogDescription>
              {uploadProgress !== null
                ? `正在上传... ${uploadProgress}%`
                : previewResult
                ? `共 ${previewResult.notes.length} 条笔记，${previewResult.new_count} 条新笔记，${previewResult.conflict_count} 条冲突`
                : '正在解析...'}
            </DialogDescription>
          </DialogHeader>

          {previewResult && !importResult && (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-2 p-1">
                {previewResult.notes.map(note => {
                  const conflict = previewResult.conflicts.find(c => c.task_id === note.task_id)
                  return (
                    <div key={note.task_id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{note.title || '(无标题)'}</div>
                        <div className="text-xs text-muted-foreground">
                          {note.platform} · {note.author || '未知'}
                          {conflict && <span className="ml-2 text-destructive">⚠ 已有同视频笔记</span>}
                        </div>
                      </div>
                      <Select
                        value={decisions[note.task_id] || 'new_copy'}
                        onValueChange={v => setDecisions(prev => ({ ...prev, [note.task_id]: v }))}
                      >
                        <SelectTrigger className="w-32 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new_copy">导入为新副本</SelectItem>
                          <SelectItem value="overwrite">覆盖已有</SelectItem>
                          <SelectItem value="skip">跳过</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}

          {importResult && (
            <div className="space-y-3 p-1">
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">成功: {importResult.success}</span>
                <span className="text-muted-foreground">跳过: {importResult.skipped}</span>
                <span className="text-blue-600">覆盖: {importResult.overwritten}</span>
                <span className="text-blue-600">新副本: {importResult.new_copy}</span>
                {importResult.failed > 0 && <span className="text-destructive">失败: {importResult.failed}</span>}
              </div>
              <Alert>
                <AlertDescription>
                  导入完成。如需查看新笔记，请刷新页面。
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            {importResult ? (
              <Button onClick={() => { setImportDialogOpen(false); setImportResult(null); setPreviewResult(null) }}>
                完成
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)} disabled={importing}>
                  取消
                </Button>
                <Button onClick={handleImport} disabled={importing || !previewResult}>
                  {importing ? '导入中...' : '确认导入'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NoteSharePage
