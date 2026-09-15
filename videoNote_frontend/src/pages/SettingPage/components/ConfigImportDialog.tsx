import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, CheckCircle2, XCircle, Info } from 'lucide-react'
import { executeImport } from '@/services/configBackup'

// 步骤类型：上传 → 结果
type ImportStep = 'upload' | 'result'

interface ImportResultData {
  success: { type: string; count?: number; id?: string; reason?: string; error?: string }[]
  failed: { type: string; count?: number; id?: string; reason?: string; error?: string }[]
  skipped: { type: string; count?: number; id?: string; reason?: string; error?: string }[]
}

interface ConfigImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ConfigImportDialog = ({ open, onOpenChange }: ConfigImportDialogProps) => {
  const [step, setStep] = useState<ImportStep>('upload')
  const [importResult, setImportResult] = useState<ImportResultData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileError, setFileError] = useState<string>('')

  // 选文件即导入：上传后直接执行导入，无需勾选和填凭证
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setFileError('')

    try {
      const parsed = JSON.parse(await file.text())
      // selected_items/credentials 不传：后端自动全导入，用文件自带敏感信息
      const result = await executeImport(parsed)
      setImportResult(result)
      setStep('result')

      const { success, failed, skipped } = result
      if (failed.length === 0 && skipped.length === 0) {
        toast.success(`成功导入 ${success.length} 项配置`)
      } else if (success.length === 0) {
        toast.error('导入未完成，请检查配置文件')
      } else {
        toast.success(`导入完成：成功 ${success.length} 项，跳过 ${skipped.length} 项`)
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '导入失败'
      setFileError(message)
    } finally {
      setIsProcessing(false)
    }
  }

  // 关闭对话框并重置状态
  const handleClose = () => {
    setStep('upload')
    setImportResult(null)
    setFileError('')
    onOpenChange(false)
  }

  // 渲染上传步骤
  const renderUploadStep = () => (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative mb-6">
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center justify-center w-64 h-40 border-2 border-dashed border-input rounded-lg bg-muted hover:bg-accent transition-colors">
          <Upload className={`w-12 h-12 text-muted-foreground mb-3 ${isProcessing ? 'animate-pulse' : ''}`} />
          <p className="text-sm font-medium text-foreground">
            {isProcessing ? '正在导入...' : '点击上传配置文件'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">选择后自动导入全部配置</p>
        </div>
      </div>

      {fileError && (
        <Alert className="w-full max-w-md mt-4 border-red-200 bg-red-50">
          <XCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-sm text-red-800">
            {fileError}
          </AlertDescription>
        </Alert>
      )}

      <Alert className="w-full max-w-md mt-4 border-primary/30 bg-primary/10">
        <Info className="h-4 w-4 text-primary" />
        <AlertDescription className="text-sm text-primary">
          请选择从其他 videoNote 实例导出的配置文件（含真实密钥），导入将覆盖当前同名配置
        </AlertDescription>
      </Alert>
    </div>
  )

  // 渲染结果步骤
  const renderResultStep = () => {
    if (!importResult) return null

    const { success, failed, skipped } = importResult

    return (
      <>
        <div className="mb-4">
          {failed.length === 0 && skipped.length === 0 ? (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm text-green-800">
                配置导入成功完成！
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-primary/30 bg-primary/10">
              <Info className="h-4 w-4 text-primary" />
              <AlertDescription className="text-sm text-primary">
                导入完成：成功 {success.length} 项，失败 {failed.length} 项，跳过 {skipped.length} 项
              </AlertDescription>
            </Alert>
          )}
        </div>

        {success.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-green-700 mb-2">成功导入</h5>
            <ul className="text-sm space-y-1">
              {success.map((item, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {item.type === 'providers' && `AI 模型设置 (${item.count} 项)`}
                  {item.type === 'siyuan_config' && '思源笔记配置'}
                  {item.type === 'webdav_config' && 'WebDAV 备份配置'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {skipped.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-amber-700 mb-2">已跳过</h5>
            <ul className="text-sm space-y-1">
              {skipped.map((item, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-foreground">
                  <XCircle className="w-4 h-4 text-amber-600" />
                  {item.type === 'providers' && `${item.id}: ${item.reason}`}
                  {item.type === 'siyuan_config' && `思源笔记: ${item.reason}`}
                  {item.type === 'webdav_config' && `WebDAV: ${item.reason}`}
                  {item.type === 'downloader_config' && `下载器: ${item.reason}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {failed.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-red-700 mb-2">导入失败</h5>
            <ul className="text-sm space-y-1">
              {failed.map((item, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-foreground">
                  <XCircle className="w-4 h-4 text-red-600" />
                  {item.type === 'providers' && `AI 模型设置: ${item.error}`}
                  {item.type === 'siyuan_config' && `思源笔记: ${item.error}`}
                  {item.type === 'webdav_config' && `WebDAV: ${item.error}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-sm text-primary">
          <p>建议刷新页面以查看导入后的配置变更。</p>
        </div>
      </>
    )
  }

  // 获取当前步骤标题
  const getStepTitle = () => {
    return step === 'upload' ? '导入配置' : '导入配置 - 完成'
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>
            {step === 'upload' && '选择配置文件后自动导入全部配置'}
            {step === 'result' && '查看导入结果'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'upload' && renderUploadStep()}
          {step === 'result' && renderResultStep()}
        </div>

        <DialogFooter>
          {step === 'result' && (
            <Button type="button" onClick={handleClose}>
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConfigImportDialog
