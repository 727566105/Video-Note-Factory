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
import { useObsidianStore } from '@/store/obsidianStore'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, CheckCircle2, XCircle, History, Eye, EyeOff, AlertTriangle, Box } from 'lucide-react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { useIsMobile } from '@/hooks/use-mobile'

// 表单 schema — 根据导出模式动态校验
const ObsidianConfigSchema = z.discriminatedUnion('export_mode', [
  z.object({
    export_mode: z.literal('local'),
    vault_path: z.string().min(1, 'Vault 路径不能为空'),
    folder_path: z.string().optional(),
    attachments_folder: z.string().optional(),
    api_url: z.string().optional(),
    api_key: z.string().optional(),
    enabled: z.number().optional(),
  }),
  z.object({
    export_mode: z.literal('api'),
    vault_path: z.string().optional(),
    folder_path: z.string().optional(),
    attachments_folder: z.string().optional(),
    api_url: z.string().min(1, 'API 地址不能为空').url('必须是合法 URL'),
    api_key: z.string().min(1, 'API 密钥不能为空'),
    enabled: z.number().optional(),
  }),
])

type ObsidianConfigFormValues = z.infer<typeof ObsidianConfigSchema>

const ObsidianSettings = () => {
  const isMobile = useIsMobile()
  const {
    config,
    exportHistory,
    isConfigured,
    isTesting,
    loadConfig,
    saveConfig,
    updateConfig,
    testConnection,
    loadExportHistory,
  } = useObsidianStore()

  const [testingResult, setTestingResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [serviceUnavailable, setServiceUnavailable] = useState(false)

  const form = useForm<ObsidianConfigFormValues>({
    resolver: zodResolver(ObsidianConfigSchema),
    defaultValues: {
      export_mode: 'local',
      vault_path: '',
      folder_path: 'videoNote/',
      attachments_folder: 'attachments/',
      api_url: '',
      api_key: '',
    },
  })

  const exportMode = form.watch('export_mode')

  // 只在组件挂载时加载一次配置和历史
  useEffect(() => {
    loadConfig()
    loadExportHistory()
  }, [])

  // 当配置加载后，只在初次加载时填充表单
  useEffect(() => {
    if (config && !isInitialized) {
      // 检测脱敏 Key 格式，不回填脱敏 Key
      const isMaskedKey = config.api_key && (
        config.api_key.includes('...') ||
        config.api_key === '********'
      )

      form.reset({
        export_mode: config.export_mode || 'local',
        vault_path: config.vault_path || '',
        folder_path: config.folder_path || 'videoNote/',
        attachments_folder: config.attachments_folder || 'attachments/',
        api_url: config.api_url || '',
        api_key: isMaskedKey ? '' : (config.api_key || ''),
      })
      setIsInitialized(true)
    }
  }, [config, isInitialized])

  // 测试连接
  const handleTestConnection = async () => {
    const values = form.getValues()
    setTestingResult(null)

    if (values.export_mode === 'local') {
      if (!values.vault_path) {
        toast.error('请先填写 Vault 路径')
        return
      }
    } else {
      if (!values.api_url || !values.api_key) {
        toast.error('请先填写 API 地址和密钥')
        return
      }
    }

    const result = await testConnection({
      export_mode: values.export_mode,
      vault_path: values.vault_path || '',
      api_url: values.api_url || '',
      api_key: values.api_key || '',
    })

    setTestingResult(result)

    if (result.success) {
      toast.success('连接成功！')
      setServiceUnavailable(false)
    } else {
      toast.error(`连接失败：${result.message}`)
      if (result.message.includes('Connection refused') || result.message.includes('连接被拒绝')) {
        setServiceUnavailable(true)
      }
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

  // 保存配置
  const onSubmit = async (values: ObsidianConfigFormValues) => {
    try {
      if (isConfigured && config?.id) {
        await updateConfig({ ...values, id: config.id })
        toast.success('更新配置成功')
      } else {
        await saveConfig(values)
        toast.success('保存配置成功')
      }
      form.reset(values, { keepDirty: false })
    } catch (error) {
      toast.error(isConfigured ? '更新配置失败' : '保存配置失败')
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4 md:p-6">
      {/* 配置表单 */}
      <div className="rounded-lg border border-border bg-background p-4 md:p-6 shadow-sm">
        {/* 标题 - 仅桌面端显示 */}
        {!isMobile && (
          <div className="mb-6 border-b pb-4">
            <h2 className="text-xl font-bold text-foreground">Obsidian 配置</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              配置 Obsidian 导出，支持本地 Vault 文件写入和 Local REST API 推送两种模式
            </p>
          </div>
        )}

        <Alert className="mb-6 border-primary/30 bg-primary/10">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-primary">
            <strong>配置说明：</strong>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li><strong>本地模式</strong>：直接写入 Vault 文件夹，需要后端能访问 Vault 路径（Docker 部署需映射 Volume）</li>
              <li><strong>API 模式</strong>：通过 Local REST API 插件推送，需在 Obsidian 中安装并启用该插件</li>
              <li>图片会自动复制到 Vault 附件目录，并使用 Wikilink 格式引用</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* 服务未启动提示 */}
        {serviceUnavailable && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-800">
              <strong>Obsidian Local REST API 服务未启动</strong>
              <p className="mt-1">
                无法连接到 Obsidian Local REST API。请检查：
              </p>
              <ul className="mt-2 ml-4 list-disc space-y-1">
                <li>Obsidian 是否已启动并打开 Vault</li>
                <li>Local REST API 插件是否已安装并启用</li>
                <li>API 地址和端口是否正确</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex max-w-2xl flex-col gap-5"
          >
            {/* 导出模式选择 */}
            <FormField
              control={form.control}
              name="export_mode"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                    导出模式
                  </FormLabel>
                  <div className="sm:col-span-3">
	                    <FormControl>
	                      <Select
	                        onValueChange={(val) => {
	                          field.onChange(val)
	                          setTestingResult(null)
	                        }}
	                        value={field.value}
	                      >
	                        <SelectTrigger className="w-full">
	                          <SelectValue placeholder="选择导出模式" />
	                        </SelectTrigger>
	                        <SelectContent>
	                          <SelectItem value="local">本地 Vault 写入</SelectItem>
	                          <SelectItem value="api">Local REST API</SelectItem>
	                        </SelectContent>
	                      </Select>
	                    </FormControl>
                    <FormDescription className="text-xs">
                      选择与 Obsidian 的集成方式
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* 本地模式字段 */}
            {exportMode === 'local' && (
              <>
                <FormField
                  control={form.control}
                  name="vault_path"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                        Vault 路径
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="/path/to/your/vault"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Obsidian Vault 的绝对路径，需包含 .obsidian 目录
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="folder_path"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                        目标文件夹
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="videoNote/"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          笔记在 Vault 中的存放路径，留空则存放在根目录
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attachments_folder"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                        附件目录
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="attachments/"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          图片等附件的存放目录（相对于目标文件夹）
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* API 模式字段 */}
            {exportMode === 'api' && (
              <>
                <FormField
                  control={form.control}
                  name="api_url"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                        API 地址
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="http://localhost:27124"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Local REST API 插件地址，不要包含末尾斜杠
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="api_key"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                        API 密钥
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <div className="relative">
                            <Input
                              {...field}
                              type={showApiKey ? 'text' : 'password'}
                              placeholder="输入 Local REST API 密钥"
                              className="pr-10"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showApiKey ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs">
                          在 Obsidian Local REST API 插件设置中生成的 API 密钥
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="folder_path"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                        目标文件夹
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="videoNote/"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          笔记在 Vault 中的存放路径，留空则存放在根目录
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="attachments_folder"
                  render={({ field }) => (
                    <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                      <FormLabel className="text-sm font-medium text-foreground sm:text-right">
                        附件目录
                      </FormLabel>
                      <div className="sm:col-span-3">
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="attachments/"
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          图片等附件的存放目录（相对于目标文件夹）
                        </FormDescription>
                        <FormMessage />
                      </div>
                    </FormItem>
                  )}
                />
              </>
            )}

            {/* 测试连接按钮 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
              <div className="hidden sm:block" />
              <div className="sm:col-span-3">
                <Button
                  type="button"
                  onClick={handleTestConnection}
                  variant="outline"
                  disabled={isTesting}
                  className="w-full sm:w-auto"
                >
                  {isTesting ? '测试中...' : '测试连接'}
                </Button>
              </div>
            </div>

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
                type="submit"
                disabled={!form.formState.isDirty}
                className="w-full min-w-[120px] sm:w-auto"
              >
                {isConfigured ? '保存修改' : '保存配置'}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* 导出历史 */}
      <div className="rounded-lg border border-border bg-background p-4 md:p-6 shadow-sm">
        {/* 标题 - 仅桌面端显示 */}
        {!isMobile && (
          <div className="mb-4 flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-bold text-foreground">导出历史</h2>
            {exportHistory.length > 0 && (
              <span className="rounded-full bg-primary/20 px-2.5 py-0.5 text-xs font-medium text-primary">
                {exportHistory.length} 条记录
              </span>
            )}
          </div>
        )}

        {exportHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted text-xs uppercase text-foreground">
                <tr>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">模式</th>
                  <th className="px-4 py-3">文件路径</th>
                  <th className="px-4 py-3">导出时间</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map(record => (
                  <tr
                    key={record.id}
                    className="border-b hover:bg-muted"
                  >
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
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        {record.export_mode === 'local' ? '本地' : 'API'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate" title={record.file_path}>
                      {record.file_path}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(record.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon"><History /></EmptyMedia>
              <EmptyTitle>暂无导出历史</EmptyTitle>
              <EmptyDescription>配置完成后，导出笔记时会在此显示历史记录</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  )
}

export default ObsidianSettings
