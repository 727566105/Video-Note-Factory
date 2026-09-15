import { useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Info, Upload, Download, Settings } from 'lucide-react'
import { useWebDAVStore } from '@/store/webdavStore'
import { exportConfigsFile } from '@/services/configBackup'
import { buildDownloadBackupUrl } from '@/services/webdav'
import ConfigImportDialog from './components/ConfigImportDialog'
import { useIsMobile } from '@/hooks/use-mobile'

const DataSettings = () => {
  const isMobile = useIsMobile()
  const {
    isBackingUp,
    isRestoring,
    backupStatus,
    exportLocal,
    restoreFromUpload,
  } = useWebDAVStore()

  // 整机包导入相关状态
  const [uploadRestoreDialogOpen, setUploadRestoreDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  // 整机包导入：上传百分比（恢复阶段改读 backupStatus）
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  // 配置管理弹窗
  const [configImportDialogOpen, setConfigImportDialogOpen] = useState(false)

  // 导出整机包到本地
  const handleExportLocal = async () => {
    try {
      toast.info('正在导出整机包，数据较大请耐心等待...')
      const filename = await exportLocal()
      if (filename) {
        const a = document.createElement('a')
        a.href = buildDownloadBackupUrl(filename)
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        toast.success(`导出成功：${filename}`)
      } else {
        toast.error('导出失败或已有任务在执行')
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`导出失败：${message}`)
    }
  }

  // 文件上传恢复
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.zip')) {
        toast.error('只支持 .zip 格式的备份文件')
        return
      }
      setSelectedFile(file)
    }
  }

  const confirmUploadRestore = async () => {
    if (!selectedFile) {
      toast.error('请选择备份文件')
      return
    }

    try {
      setUploadProgress(0)
      // store 内部：上传+触发后台恢复 → 轮询恢复进度 → 成功后 window.location.reload()
      await restoreFromUpload(selectedFile, (percent) => setUploadProgress(percent))
      // 成功路径由 store 触发页面刷新，以下不会执行到
      setUploadRestoreDialogOpen(false)
      setSelectedFile(null)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误'
      toast.error(`恢复失败：${message}`)
    } finally {
      setUploadProgress(null)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 md:p-6">
      {/* 整机迁移 - 始终可见，不依赖 WebDAV 配置 */}
      <div className="rounded-lg border border-border bg-background p-4 md:p-6 shadow-sm">
        <div className="mb-4 border-b pb-4">
          {!isMobile && (
            <div>
              <h2 className="text-xl font-bold text-foreground">整机迁移</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                导出全部数据（账号、笔记、合集、媒体、配置）为整机包，或从整机包导入到新项目，不依赖 WebDAV
              </p>
            </div>
          )}
        </div>

        <Alert className="mb-4 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <strong>适用场景：</strong>整机迁移到新项目。导出包含完整数据库与全部媒体文件（含音视频），导入将<strong>整体替换</strong>当前数据，恢复前自动备份。
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {isBackingUp && backupStatus?.is_busy && (
            <span className="text-xs text-muted-foreground mr-2">
              进度：{backupStatus.progress || 0}% - {backupStatus.message || '处理中...'}
            </span>
          )}
          <Button
            type="button"
            onClick={handleExportLocal}
            disabled={isBackingUp}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {isBackingUp ? '导出中...' : '导出整机包'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setUploadRestoreDialogOpen(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            导入整机包
          </Button>
        </div>
      </div>

      {/* 配置管理 */}
      <div className="rounded-lg border border-border bg-background p-4 md:p-6 shadow-sm">
        {/* 标题 - 仅桌面端显示 */}
        {!isMobile && (
          <div className="mb-6 border-b pb-4">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-foreground" />
              <div>
                <h2 className="text-xl font-bold text-foreground">配置管理</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  导出或导入系统配置（AI 模型、下载器、思源笔记、WebDAV 备份）
                </p>
              </div>
            </div>
          </div>
        )}

        <Alert className="mb-6 border-yellow-200 bg-yellow-50">
          <Info className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm text-yellow-800">
            <strong>注意：</strong>导出的配置不包含敏感信息（API Key、密码、Token），导入时需要手动补充。
          </AlertDescription>
        </Alert>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await exportConfigsFile()
                toast.success('配置导出成功')
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : '未知错误'
                toast.error(`导出失败：${message}`)
              }
            }}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            导出配置
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setConfigImportDialogOpen(true)}
            className="w-full sm:w-auto"
          >
            <Upload className="mr-2 h-4 w-4" />
            导入配置
          </Button>
        </div>
      </div>

      {/* 文件上传恢复对话框 */}
      <Dialog open={uploadRestoreDialogOpen} onOpenChange={setUploadRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>导入备份文件</DialogTitle>
            <DialogDescription>
              选择本地的整机包 ZIP 文件恢复。将<strong>整体替换</strong>当前的账号、笔记、合集与全部媒体文件（含音视频），恢复前会自动备份当前数据。适合迁移到新项目。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">选择备份文件</label>
              <Input
                type="file"
                accept=".zip"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  已选择: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            {isRestoring && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground">
                  <span>
                    {uploadProgress !== null && uploadProgress < 100
                      ? '上传中…'
                      : backupStatus?.message || '恢复中…'}
                  </span>
                  <span>
                    {uploadProgress !== null && uploadProgress < 100
                      ? uploadProgress
                      : backupStatus?.progress || 0}
                    %
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${
                        uploadProgress !== null && uploadProgress < 100
                          ? uploadProgress
                          : backupStatus?.progress || 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <Alert className="border-yellow-200 bg-yellow-50">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-sm text-yellow-800">
                <strong>注意：</strong>
                <ul className="mt-2 ml-4 list-disc space-y-1">
                  <li>恢复操作将覆盖当前数据库和笔记文件</li>
                  <li>系统会自动创建恢复前的备份</li>
                  <li>恢复失败时会自动回滚到恢复前状态</li>
                  <li>备份包含完整配置（API Key、密码、Token），恢复后无需重新输入</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setUploadRestoreDialogOpen(false)
                setSelectedFile(null)
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmUploadRestore}
              disabled={!selectedFile || isRestoring}
            >
              {isRestoring ? '恢复中...' : '确认恢复'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 配置导入对话框 */}
      <ConfigImportDialog
        open={configImportDialogOpen}
        onOpenChange={setConfigImportDialogOpen}
      />
    </div>
  )
}

export default DataSettings
