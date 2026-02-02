import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWebDAVStore } from '@/store/webdavStore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, CheckCircle2, XCircle, History, Eye, EyeOff, Upload, Download, Clock, Trash2, Settings } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { exportConfigsFile } from '@/services/configBackup'
import ConfigImportDialog from './components/ConfigImportDialog'

// 表单 schema
const WebDAVConfigSchema = z.object({
  url: z.string().min(1, 'WebDAV 地址不能为空').url('必须是合法 URL'),
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
  path: z.string().default('/'),
  auto_backup_enabled: z.boolean().default(false),
  auto_backup_schedule: z.string().default('0 2 * * *'),
})

type WebDAVConfigFormValues = z.infer<typeof WebDAVConfigSchema>

// Cron 预设选项
const CRON_PRESETS = [
  { label: '每天凌晨 2 点', value: '0 2 * * *' },
  { label: '每天凌晨 3 点', value: '0 3 * * *' },
  { label: '每天凌晨 4 点', value: '0 4 * * *' },
  { label: '每周一凌晨 2 点', value: '0 2 * * 1' },
  { label: '每周日凌晨 2 点', value: '0 2 * * 0' },
]

const WebDAVSettings = () => {
  const {
    config,
    backups,
    backupHistory,
    backupStats,
    schedule,
    isConfigured,
    isTesting,
    isBackingUp,
    isRestoring,
    loadConfig,
    saveConfig,
    updateConfig,
    deleteConfig,
    testConnection,
    createBackup,
    loadBackups,
    deleteBackup,
    restoreBackup,
    loadSchedule,
    enableSchedule,
    disableSchedule,
    loadHistory,
    loadStats,
  } = useWebDAVStore()

  const [testingResult, setTestingResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null)
  const [configImportDialogOpen, setConfigImportDialogOpen] = useState(false)

  const form = useForm<WebDAVConfigFormValues>({
    resolver: zodResolver(WebDAVConfigSchema),
    defaultValues: {
      url: '',
      username: '',
      password: '',
      path: '/',
      auto_backup_enabled: false,
      auto_backup_schedule: '0 2 * * *',
    },
  })

  // 只在组件挂载时加载一次配置和历史
  useEffect(() => {
    loadConfig()
    loadHistory()
    loadStats()
    loadSchedule()
    // 只有在已配置时才加载备份列表
    loadConfig().then(() => {
      const { isConfigured } = useWebDAVStore.getState()
      if (isConfigured) {
        loadBackups()
      }
    })
  }, [])

  // 当配置加载后，只在初次加载时填充表单
  useEffect(() => {
    if (config && !isInitialized) {
      form.reset({
        url: config.url || '',
        username: config.username || '',
        password: config.password || '',
        path: config.path || '/',
        auto_backup_enabled: config.auto_backup_enabled === 1,
        auto_backup_schedule: config.auto_backup_schedule || '0 2 * * *',
      })
      setIsInitialized(true)
    }
  }, [config, isInitialized])

  // 测试连接
  const handleTestConnection = async () => {
    const values = form.getValues()
    if (!values.url || !values.username || !values.password) {
      toast.error('请先填写完整的 WebDAV 配置信息')
      return
    }

    setTestingResult(null)
    const result = await testConnection({
      url: values.url,
      username: values.username,
      password: values.password,
    })

    setTestingResult(result)

    if (result.success) {
      toast.success('连接成功！')
    } else {
      toast.error(`连接失败：${result.message}`)
    }
  }

  // 格式化日期
  const formatDate = (date: string | Date | undefined) => {
    if (!date) return ''
    const d = typeof date === 'string' ? new Date(date) : date
    if (isNaN(d.getTime())) return ''
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return '-'
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`
  }

  // 保存配置
  const onSubmit = async (values: WebDAVConfigFormValues) => {
    try {
      const configData = {
        ...values,
        auto_backup_enabled: values.auto_backup_enabled ? 1 : 0,
      }

      if (isConfigured && config?.id) {
        await updateConfig(configData)
        toast.success('更新配置成功')
      } else {
        await saveConfig(configData)
        toast.success('保存配置成功')
      }

      // 处理自动备份设置
      if (values.auto_backup_enabled) {
        await enableSchedule(values.auto_backup_schedule)
      } else {
        await disableSchedule()
      }

      form.reset(values, { keepDirty: false })
      loadSchedule()
    } catch (error) {
      toast.error(isConfigured ? '更新配置失败' : '保存配置失败')
    }
  }

  // 删除配置
  const handleDeleteConfig = async () => {
    if (!confirm('确定要删除 WebDAV 配置吗？这将停止所有自动备份任务。')) {
      return
    }

    try {
      await deleteConfig()
      toast.success('配置已删除')
      setIsInitialized(false)
      form.reset({
        url: '',
        username: '',
        password: '',
        path: '/',
        auto_backup_enabled: false,
        auto_backup_schedule: '0 2 * * *',
      })
    } catch (error) {
      toast.error('删除配置失败')
    }
  }

  // 手动备份
  const handleBackup = async () => {
    try {
      await createBackup()
      toast.success('备份成功')
    } catch (error: any) {
      toast.error(`备份失败：${error?.message || '未知错误'}`)
    }
  }

  // 删除备份文件
  const handleDeleteBackup = async (backupName: string) => {
    if (!confirm(`确定要删除备份文件 "${backupName}" 吗？`)) {
      return
    }

    try {
      await deleteBackup(backupName)
      toast.success('备份已删除')
    } catch (error: any) {
      toast.error(`删除失败：${error?.message || '未知错误'}`)
    }
  }

  // 恢复备份
  const handleRestore = async () => {
    if (!selectedBackup) return

    try {
      await restoreBackup(selectedBackup)
      toast.success('恢复成功，请刷新页面查看恢复的数据')
      setRestoreDialogOpen(false)
      setSelectedBackup(null)
    } catch (error: any) {
      toast.error(`恢复失败：${error?.message || '未知错误'}`)
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* 配置表单 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-900">WebDAV 备份配置</h2>
          <p className="mt-1 text-sm text-gray-500">
            配置 WebDAV 服务器连接信息，用于自动备份笔记数据和数据库
          </p>
        </div>

        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <strong>支持的 WebDAV 服务：</strong>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>坚果云：https://dav.jianguoyun.com/dav/</li>
              <li>Nextcloud：https://your-domain.com/remote.php/webdav/</li>
              <li>ownCloud：https://your-domain.com/remote.php/webdav/</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex max-w-2xl flex-col gap-5"
          >
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                    WebDAV 地址
                  </FormLabel>
                  <div className="sm:col-span-3">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://dav.jianguoyun.com/dav/"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      WebDAV 服务器地址，包含完整路径
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                    用户名
                  </FormLabel>
                  <div className="sm:col-span-3">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="输入 WebDAV 用户名"
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                    密码
                  </FormLabel>
                  <div className="sm:col-span-3">
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="输入 WebDAV 密码"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                    备份路径
                  </FormLabel>
                  <div className="sm:col-span-3">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="/BiliNote/backups"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      WebDAV 服务器上的备份目录路径，默认为根目录
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* 测试结果 */}
            {testingResult && (
              <Alert
                className={
                  testingResult.success
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }
              >
                {testingResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <AlertDescription
                  className={
                    testingResult.success
                      ? 'text-sm text-green-800'
                      : 'text-sm text-red-800'
                  }
                >
                  {testingResult.message}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:gap-3">
              <Button
                type="button"
                onClick={handleTestConnection}
                variant="outline"
                disabled={isTesting}
                className="w-full min-w-[120px] sm:w-auto"
              >
                {isTesting ? '测试中...' : '测试连接'}
              </Button>
              <Button
                type="submit"
                disabled={!form.formState.isDirty}
                className="w-full min-w-[120px] sm:w-auto"
              >
                {isConfigured ? '保存修改' : '保存配置'}
              </Button>
              {isConfigured && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeleteConfig}
                  className="w-full min-w-[120px] sm:w-auto"
                >
                  删除配置
                </Button>
              )}
            </div>

            {/* 自动备份设置 - 仅在已配置时显示 */}
            {isConfigured && (
              <>
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">自动备份设置</h3>
                </div>

                <FormField
                  control={form.control}
                  name="auto_backup_enabled"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                        启用自动备份
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <Select
                            onValueChange={(value) => field.onChange(value === 'true')}
                            value={field.value ? 'true' : 'false'}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="选择是否启用" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">否</SelectItem>
                              <SelectItem value="true">是</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormDescription className="text-xs">
                          启用后系统将按照设定的时间自动执行备份
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch('auto_backup_enabled') && (
                  <FormField
                    control={form.control}
                    name="auto_backup_schedule"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                        <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                          备份计划
                        </FormLabel>
                        <div className="sm:col-span-3">
                          <FormControl>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder="选择备份时间" />
                              </SelectTrigger>
                              <SelectContent>
                                {CRON_PRESETS.map((preset) => (
                                  <SelectItem
                                    key={preset.value}
                                    value={preset.value}
                                  >
                                    {preset.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormDescription className="text-xs">
                            选择自动备份的执行时间
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                )}

                {schedule?.last_backup_at && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-800">
                    <Clock className="h-4 w-4" />
                    <span>
                      上次备份时间：{formatDate(schedule.last_backup_at)}
                    </span>
                  </div>
                )}
              </>
            )}
          </form>
        </Form>
      </div>

      {/* 手动备份 */}
      {isConfigured && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900">手动备份</h2>
            {backupStats && (
              <div className="flex gap-2">
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  成功: {backupStats.successful}
                </span>
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  失败: {backupStats.failed}
                </span>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={handleBackup}
            disabled={isBackingUp}
            className="w-full sm:w-auto"
          >
            <Upload className="mr-2 h-4 w-4" />
            {isBackingUp ? '备份中...' : '立即备份'}
          </Button>
        </div>
      )}

      {/* 备份文件列表 */}
      {isConfigured && backups.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900">备份文件</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="px-4 py-3">文件名</th>
                  <th className="px-4 py-3">大小</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr
                    key={backup.name}
                    className="border-b hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {backup.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatFileSize(backup.size)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBackup(backup.name)
                            setRestoreDialogOpen(true)
                          }}
                          disabled={isRestoring}
                        >
                          <Download className="mr-1 h-3 w-3" />
                          恢复
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteBackup(backup.name)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 备份历史 */}
      {isConfigured && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900">备份历史</h2>
            {backupHistory.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {backupHistory.length} 条记录
              </span>
            )}
          </div>

          {backupHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                  <tr>
                    <th className="px-4 py-3">类型</th>
                    <th className="px-4 py-3">状态</th>
                    <th className="px-4 py-3">文件大小</th>
                    <th className="px-4 py-3">文件数量</th>
                    <th className="px-4 py-3">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {backupHistory.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        {record.type === 'auto' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                            <Clock className="h-3 w-3" />
                            自动
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                            手动
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {record.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                            <CheckCircle2 className="h-3 w-3" />
                            成功
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                            <XCircle className="h-3 w-3" />
                            失败
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatFileSize(record.file_size)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {record.file_count || '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(record.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <History className="mb-4 h-16 w-16 text-gray-300" />
              <p className="text-base font-medium text-gray-900">暂无备份历史</p>
              <p className="mt-2 text-sm text-gray-500">
                执行备份后，历史记录将在此显示
              </p>
            </div>
          )}
        </div>
      )}

      {/* 配置管理 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 border-b pb-4">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-gray-700" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">配置管理</h2>
              <p className="mt-1 text-sm text-gray-500">
                导出或导入系统配置（AI 模型、下载器、思源笔记、WebDAV 备份）
              </p>
            </div>
          </div>
        </div>

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
              } catch (error: any) {
                toast.error(`导出失败：${error?.message || '未知错误'}`)
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

      {/* 恢复确认对话框 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认恢复备份</DialogTitle>
            <DialogDescription>
              恢复操作将覆盖当前数据，包括数据库和笔记文件。建议在恢复前先手动备份当前数据。
              <br /><br />
              要恢复的备份文件：<strong>{selectedBackup}</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRestoreDialogOpen(false)
                setSelectedBackup(null)
              }}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRestore}
              disabled={isRestoring}
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

export default WebDAVSettings
