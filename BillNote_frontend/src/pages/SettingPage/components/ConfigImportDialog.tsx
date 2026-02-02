import { useState } from 'react'
import toast from 'react-hot-toast'
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
import { Upload, CheckCircle2, XCircle, Key, Lock, Info } from 'lucide-react'
import {
  previewImport,
  executeImport,
  type ConfigPreviewResponse,
  type ConfigPreviewItem,
} from '@/services/configBackup'

// 步骤类型
type ImportStep = 'upload' | 'preview' | 'credentials' | 'result'

// 凭证输入状态
interface CredentialsState {
  providers: Record<string, string>  // { provider_id: api_key }
  siyuan_config: { api_token: string }
  webdav_config: { password: string }
}

interface ConfigImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ConfigImportDialog = ({ open, onOpenChange }: ConfigImportDialogProps) => {
  const [step, setStep] = useState<ImportStep>('upload')
  const [configData, setConfigData] = useState<any>(null)
  const [preview, setPreview] = useState<ConfigPreviewResponse | null>(null)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [credentials, setCredentials] = useState<CredentialsState>({
    providers: {},
    siyuan_config: { api_token: '' },
    webdav_config: { password: '' },
  })
  const [importResult, setImportResult] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileError, setFileError] = useState<string>('')

  // 处理文件上传
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    setFileError('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await previewImport(file)
      if (response.code === 200) {
        setConfigData(response.data.config_data)
        setPreview(response.data)
        setStep('preview')
      } else {
        setFileError(response.msg || '文件解析失败')
      }
    } catch (error: any) {
      setFileError(error?.message || '文件解析失败')
    } finally {
      setIsProcessing(false)
    }
  }

  // 处理配置项选择
  const handleToggleItem = (itemType: string) => {
    setSelectedItems(prev =>
      prev.includes(itemType)
        ? prev.filter(t => t !== itemType)
        : [...prev, itemType]
    )
  }

  // 处理凭证输入
  const handleCredentialChange = (section: keyof CredentialsState, field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }))
  }

  // 处理 Provider API Key 输入
  const handleProviderKeyChange = (providerId: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [providerId]: value
      }
    }))
  }

  // 执行导入
  const handleExecuteImport = async () => {
    setIsProcessing(true)

    try {
      const response = await executeImport(configData, selectedItems, credentials)

      if (response.code === 200) {
        setImportResult(response.data)
        setStep('result')

        // 显示成功/失败消息
        const { success, failed, skipped } = response.data
        if (failed.length === 0 && skipped.length === 0) {
          toast.success(`成功导入 ${success.length} 项配置`)
        } else {
          toast.success(`导入完成：成功 ${success.length} 项，失败 ${failed.length} 项，跳过 ${skipped.length} 项`)
        }
      } else {
        toast.error(response.msg || '导入失败')
      }
    } catch (error: any) {
      toast.error(`导入失败：${error?.message || '未知错误'}`)
    } finally {
      setIsProcessing(false)
    }
  }

  // 关闭对话框并重置状态
  const handleClose = () => {
    setStep('upload')
    setConfigData(null)
    setPreview(null)
    setSelectedItems([])
    setCredentials({
      providers: {},
      siyuan_config: { api_token: '' },
      webdav_config: { password: '' },
    })
    setImportResult(null)
    setFileError('')
    onOpenChange(false)
  }

  // 获取需要凭证的配置项
  const getSelectedItemsNeedingCredentials = () => {
    if (!preview) return []
    return preview.available_items.filter(
      item => selectedItems.includes(item.type) && item.needs_credentials
    )
  }

  // 渲染上传步骤
  const renderUploadStep = () => (
    <>
      <div className="flex flex-col items-center justify-center py-8">
        <div className="relative mb-6">
          <input
            type="file"
            accept=".json"
            onChange={handleFileUpload}
            disabled={isProcessing}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center w-64 h-40 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
            <Upload className={`w-12 h-12 ${isProcessing ? 'text-gray-400 animate-pulse' : 'text-gray-400'} mb-3`} />
            <p className="text-sm font-medium text-gray-700">
              {isProcessing ? '正在解析...' : '点击或拖拽上传配置文件'}
            </p>
            <p className="text-xs text-gray-500 mt-1">支持 JSON 格式</p>
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

        <Alert className="w-full max-w-md mt-4 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            请选择从本系统或其他 Video Note Factory 实例导出的配置文件（bilinote_configs.json）
          </AlertDescription>
        </Alert>
      </div>
    </>
  )

  // 渲染预览步骤
  const renderPreviewStep = () => {
    if (!preview) return null

    return (
      <>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">
            配置版本：<span className="font-medium">{preview.version}</span>
          </p>
          <p className="text-sm text-gray-600">
            导出时间：<span className="font-medium">
              {new Date(preview.exported_at).toLocaleString('zh-CN')}
            </span>
          </p>
        </div>

        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">选择要导入的配置项：</h4>
          <div className="space-y-2">
            {preview.available_items.map((item) => (
              <label
                key={item.type}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedItems.includes(item.type)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.type)}
                    onChange={() => handleToggleItem(item.type)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{item.name}</span>
                      {item.needs_credentials && (
                        <span className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          <Key className="w-3 h-3 mr-1" />
                          需要凭证
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{item.count} 项配置</p>
                  </div>
                </div>
                {selectedItems.includes(item.type) && (
                  <CheckCircle2 className="w-5 h-5 text-blue-600" />
                )}
              </label>
            ))}
          </div>
        </div>

        {preview.has_sensitive_data && selectedItems.some(itemType => {
          const item = preview.available_items.find(i => i.type === itemType)
          return item?.needs_credentials
        }) && (
          <Alert className="border-amber-200 bg-amber-50">
            <Key className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-sm text-amber-800">
              部分配置项需要补充敏感信息（API Key、密码等），下一步将要求输入
            </AlertDescription>
          </Alert>
        )}
      </>
    )
  }

  // 渲染凭证步骤
  const renderCredentialsStep = () => {
    const itemsNeedingCredentials = getSelectedItemsNeedingCredentials()

    return (
      <>
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            以下配置项需要补充敏感信息才能导入：
          </p>
        </div>

        <div className="space-y-4 max-h-96 overflow-y-auto">
          {itemsNeedingCredentials.map((item) => {
            if (item.type === 'providers') {
              // Provider 配置
              const providers = configData?.configs?.providers || []
              return (
                <div key={item.type} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-500" />
                    {item.name}
                  </h5>
                  <div className="space-y-3">
                    {providers.map((provider: any) => (
                      <div key={provider.id}>
                        <label className="text-xs text-gray-600 block mb-1">
                          {provider.name} ({provider.id}) 的 API Key
                        </label>
                        <input
                          type="password"
                          value={credentials.providers[provider.id] || ''}
                          onChange={(e) => handleProviderKeyChange(provider.id, e.target.value)}
                          placeholder="输入 API Key"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            } else if (item.type === 'siyuan_config') {
              // 思源笔记配置
              return (
                <div key={item.type} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-500" />
                    {item.name}
                  </h5>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">
                      API Token
                    </label>
                    <input
                      type="password"
                      value={credentials.siyuan_config.api_token}
                      onChange={(e) => handleCredentialChange('siyuan_config', 'api_token', e.target.value)}
                      placeholder="输入思源笔记 API Token"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      API 地址：{configData?.configs?.siyuan_config?.api_url}
                    </p>
                  </div>
                </div>
              )
            } else if (item.type === 'webdav_config') {
              // WebDAV 配置
              return (
                <div key={item.type} className="border border-gray-200 rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-gray-500" />
                    {item.name}
                  </h5>
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">
                      WebDAV 密码
                    </label>
                    <input
                      type="password"
                      value={credentials.webdav_config.password}
                      onChange={(e) => handleCredentialChange('webdav_config', 'password', e.target.value)}
                      placeholder="输入 WebDAV 密码"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      服务器：{configData?.configs?.webdav_config?.url}
                    </p>
                  </div>
                </div>
              )
            }
            return null
          })}
        </div>

        <Alert className="mt-4 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            敏感信息仅用于本次导入，不会被保存
          </AlertDescription>
        </Alert>
      </>
    )
  }

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
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                导入完成：成功 {success.length} 项，失败 {failed.length} 项，跳过 {skipped.length} 项
              </AlertDescription>
            </Alert>
          )}
        </div>

        {success.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-green-700 mb-2">成功导入</h5>
            <ul className="text-sm space-y-1">
              {success.map((item: any, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-gray-700">
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
              {skipped.map((item: any, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-gray-700">
                  <XCircle className="w-4 h-4 text-amber-600" />
                  {item.type === 'providers' && `${item.id}: ${item.reason}`}
                  {item.type === 'siyuan_config' && `思源笔记: ${item.reason}`}
                  {item.type === 'webdav_config' && `WebDAV: ${item.reason}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {failed.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium text-red-700 mb-2">导入失败</h5>
            <ul className="text-sm space-y-1">
              {failed.map((item: any, idx: number) => (
                <li key={idx} className="flex items-center gap-2 text-gray-700">
                  <XCircle className="w-4 h-4 text-red-600" />
                  {item.type === 'providers' && `AI 模型设置: ${item.error}`}
                  {item.type === 'siyuan_config' && `思源笔记: ${item.error}`}
                  {item.type === 'webdav_config' && `WebDAV: ${item.error}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p>建议刷新页面以查看导入后的配置变更。</p>
        </div>
      </>
    )
  }

  // 获取当前步骤标题
  const getStepTitle = () => {
    switch (step) {
      case 'upload':
        return '导入配置 - 上传文件'
      case 'preview':
        return '导入配置 - 选择配置项'
      case 'credentials':
        return '导入配置 - 补充敏感信息'
      case 'result':
        return '导入配置 - 完成'
    }
  }

  // 获取下一步按钮文本
  const getNextButtonText = () => {
    switch (step) {
      case 'preview':
        return selectedItems.length > 0 ? '下一步' : '选择配置项'
      case 'credentials':
        return '执行导入'
      default:
        return ''
    }
  }

  // 处理下一步
  const handleNext = () => {
    if (step === 'preview') {
      const needsCredentials = selectedItems.some(itemType => {
        const item = preview?.available_items.find(i => i.type === itemType)
        return item?.needs_credentials
      })

      if (needsCredentials) {
        setStep('credentials')
      } else {
        handleExecuteImport()
      }
    } else if (step === 'credentials') {
      handleExecuteImport()
    }
  }

  // 验证是否可以下一步
  const canProceed = () => {
    if (step === 'preview') {
      return selectedItems.length > 0
    }
    if (step === 'credentials') {
      // 检查所有需要的凭证是否已填写
      const itemsNeedingCredentials = getSelectedItemsNeedingCredentials()
      for (const item of itemsNeedingCredentials) {
        if (item.type === 'providers') {
          const providers = configData?.configs?.providers || []
          for (const provider of providers) {
            if (!credentials.providers[provider.id]) {
              return false
            }
          }
        } else if (item.type === 'siyuan_config') {
          if (!credentials.siyuan_config.api_token) {
            return false
          }
        } else if (item.type === 'webdav_config') {
          if (!credentials.webdav_config.password) {
            return false
          }
        }
      }
      return true
    }
    return false
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>
            {step === 'upload' && '选择从本系统导出的配置文件'}
            {step === 'preview' && '查看配置文件内容并选择要导入的配置项'}
            {step === 'credentials' && '补充配置所需的敏感信息'}
            {step === 'result' && '查看导入结果'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'upload' && renderUploadStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'credentials' && renderCredentialsStep()}
          {step === 'result' && renderResultStep()}
        </div>

        <DialogFooter>
          {step !== 'upload' && step !== 'result' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (step === 'credentials') {
                  setStep('preview')
                } else if (step === 'preview') {
                  setStep('upload')
                }
              }}
            >
              上一步
            </Button>
          )}
          {step === 'preview' && (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || isProcessing}
            >
              {getNextButtonText()}
            </Button>
          )}
          {step === 'credentials' && (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed() || isProcessing}
            >
              {isProcessing ? '导入中...' : '执行导入'}
            </Button>
          )}
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
