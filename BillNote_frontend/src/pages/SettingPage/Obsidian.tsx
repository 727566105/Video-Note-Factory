import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import toast from 'react-hot-toast'
import {
  Upload,
  FileArchive,
  Trash2,
  Search,
  FileText,
  Tag,
  Link2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  PackageOpen,
} from 'lucide-react'
import {
  uploadObsidianZip,
  createProgressSSE,
  getImportList,
  deleteImport,
  searchNotes,
  getNoteDetail,
} from '@/services/obsidian'

interface ImportRecord {
  id: number
  import_name: string
  file_count: number
  status: string
  progress: number
  error_message: string | null
  created_at: string | null
}

interface NoteRecord {
  id: number
  import_id: number
  title: string
  file_path: string
  tags: string
  links: string
  broken_links: string
  created_at: string | null
}

interface NoteDetail extends NoteRecord {
  content: string
  raw_content: string
  yaml_meta: string
  linked_notes: { id: number; title: string }[]
}

const ObsidianSettings = () => {
  // 上传状态
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [importStatus, setImportStatus] = useState<string>('')
  const [currentImportId, setCurrentImportId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sseRef = useRef<EventSource | null>(null)

  // 导入历史
  const [imports, setImports] = useState<ImportRecord[]>([])

  // 笔记浏览
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [keyword, setKeyword] = useState('')
  const [selectedNote, setSelectedNote] = useState<NoteDetail | null>(null)
  const [loadingNotes, setLoadingNotes] = useState(false)

  // 加载导入历史
  const loadImports = useCallback(async () => {
    try {
      const list = await getImportList()
      setImports(list || [])
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    loadImports()
  }, [loadImports])

  // SSE 进度监听
  const startProgressListener = (importId: number) => {
    if (sseRef.current) {
      sseRef.current.close()
    }
    const sse = createProgressSSE(importId)
    sseRef.current = sse

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setProgress(data.progress || 0)
        setImportStatus(data.status || '')

        if (data.error_message) {
          setErrorMessage(data.error_message)
        }

        if (data.status === 'completed') {
          toast.success('导入完成！')
          setImporting(false)
          sse.close()
          loadImports()
          loadNotes()
        } else if (data.status === 'failed') {
          toast.error('导入失败：' + (data.error_message || '未知错误'))
          setImporting(false)
          sse.close()
        }
      } catch {
        // 忽略解析错误
      }
    }

    sse.onerror = () => {
      sse.close()
      if (importing) {
        setImporting(false)
      }
    }
  }

  // 上传并导入
  const handleImport = async () => {
    if (!file) return
    setUploading(true)
    setImporting(true)
    setProgress(0)
    setImportStatus('pending')
    setErrorMessage('')

    try {
      const res = await uploadObsidianZip(file)
      const importId = res.import_id
      setCurrentImportId(importId)
      startProgressListener(importId)
      toast.success('上传成功，开始导入...')
    } catch {
      toast.error('上传失败')
      setImporting(false)
    } finally {
      setUploading(false)
    }
  }

  // 删除导入
  const handleDelete = async (importId: number) => {
    if (!window.confirm('确定要删除这个导入批次及其所有笔记吗？')) return
    try {
      await deleteImport(importId)
      toast.success('删除成功')
      loadImports()
      loadNotes()
    } catch {
      toast.error('删除失败')
    }
  }

  // 加载笔记列表
  const loadNotes = useCallback(async () => {
    setLoadingNotes(true)
    try {
      const list = await searchNotes(keyword ? { keyword } : undefined)
      setNotes(list || [])
    } catch {
      // 忽略
    } finally {
      setLoadingNotes(false)
    }
  }, [keyword])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  // 查看笔记详情
  const handleViewNote = async (noteId: number) => {
    try {
      const detail = await getNoteDetail(noteId)
      setSelectedNote(detail)
    } catch {
      toast.error('加载笔记失败')
    }
  }

  const statusLabel: Record<string, string> = {
    pending: '等待中',
    parsing: '解析中',
    importing: '导入中',
    completed: '已完成',
    failed: '失败',
  }

  const statusColor: Record<string, string> = {
    pending: 'text-gray-500',
    parsing: 'text-blue-500',
    importing: 'text-blue-500',
    completed: 'text-green-600',
    failed: 'text-red-500',
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* 上传区域 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Obsidian 笔记库导入</h2>
        <p className="mt-1 text-sm text-gray-500">将 Obsidian 笔记库打包为 ZIP 上传，系统会自动解析并导入</p>

        {/* 拖拽上传 */}
        <div
          className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 transition-colors hover:border-blue-400 hover:bg-blue-50 cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={(e) => {
            e.preventDefault()
            const droppedFile = e.dataTransfer.files[0]
            if (droppedFile?.name.endsWith('.zip')) {
              setFile(droppedFile)
            } else {
              toast.error('请上传 ZIP 文件')
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setFile(f)
            }}
          />
          <FileArchive className="h-10 w-10 text-gray-400" />
          {file ? (
            <div className="mt-2 text-center">
              <p className="text-sm font-medium text-gray-900">{file.name}</p>
              <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-500">拖拽 ZIP 文件到此处，或点击选择</p>
          )}
        </div>

        {/* 导入按钮 */}
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleImport} disabled={!file || importing}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                上传中...
              </>
            ) : importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                导入中...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                开始导入
              </>
            )}
          </Button>
          {file && !importing && (
            <Button variant="outline" onClick={() => setFile(null)}>
              清除
            </Button>
          )}
        </div>

        {/* 进度条 */}
        {importing && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className={statusColor[importStatus] || 'text-gray-500'}>
                {statusLabel[importStatus] || '处理中...'}
              </span>
              <span className="text-gray-500">{progress}%</span>
            </div>
            <Progress value={progress} className="mt-2" />
          </div>
        )}

        {/* 错误信息 */}
        {errorMessage && (
          <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
        )}
      </div>

      {/* 导入历史 */}
      {imports.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">导入历史</h3>
          <div className="mt-3 flex flex-col gap-2">
            {imports.map((imp) => (
              <div key={imp.id} className="flex items-center justify-between rounded-md border border-gray-100 p-3">
                <div className="flex items-center gap-3">
                  <PackageOpen className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{imp.import_name}</p>
                    <p className="text-xs text-gray-500">
                      {imp.file_count} 个文件 · {imp.created_at ? new Date(imp.created_at).toLocaleString() : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${statusColor[imp.status] || ''}`}>
                    {statusLabel[imp.status] || imp.status}
                  </span>
                  {imp.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(imp.id)}>
                    <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 笔记浏览 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">笔记浏览</h3>

        {/* 搜索 */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="搜索笔记标题或内容..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* 笔记列表 */}
        <div className="mt-3 flex flex-col gap-1">
          {loadingNotes ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载中...
            </div>
          ) : notes.length > 0 ? (
            notes.map((note) => (
              <div
                key={note.id}
                className="flex items-center justify-between rounded-md border border-gray-100 p-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleViewNote(note.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="truncate text-sm text-gray-900">{note.title}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {note.tags && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Tag className="h-3 w-3" />
                      {note.tags.split(',').length}
                    </div>
                  )}
                  {note.links && (
                    <div className="flex items-center gap-1 text-xs text-blue-500">
                      <Link2 className="h-3 w-3" />
                      {note.links.split(',').filter(Boolean).length}
                    </div>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-sm text-gray-500">
              {keyword ? '未找到匹配的笔记' : '暂无导入的笔记'}
            </div>
          )}
        </div>
      </div>

      {/* 笔记详情弹窗 */}
      {selectedNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setSelectedNote(null)}>
          <div
            className="max-h-[80vh] w-[700px] overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">{selectedNote.title}</h3>
              <Button variant="ghost" size="sm" onClick={() => setSelectedNote(null)}>
                关闭
              </Button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
              <span>{selectedNote.file_path}</span>
              {selectedNote.tags && selectedNote.tags.split(',').map((tag) => (
                <span key={tag} className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-600">#{tag}</span>
              ))}
            </div>

            {/* 关联笔记 */}
            {selectedNote.linked_notes && selectedNote.linked_notes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                <span className="text-xs text-gray-500">关联：</span>
                {selectedNote.linked_notes.map((link) => (
                  <button
                    key={link.id}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50"
                    onClick={() => handleViewNote(link.id)}
                  >
                    {link.title}
                  </button>
                ))}
              </div>
            )}

            {/* 内容 */}
            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
              <pre className="whitespace-pre-wrap text-sm text-gray-800">{selectedNote.content}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ObsidianSettings