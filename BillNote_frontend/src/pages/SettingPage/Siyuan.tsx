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
import { useSiyuanStore } from '@/store/siyuanStore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, BookOpen, CheckCircle2, XCircle, History, Eye, EyeOff } from 'lucide-react'

// 表单 schema
const SiyuanConfigSchema = z.object({
  api_url: z.string().min(1, 'API 地址不能为空').url('必须是合法 URL'),
  api_token: z.string().min(1, 'API Token 不能为空'),
  default_notebook: z.string().optional(),
})

type SiyuanConfigFormValues = z.infer<typeof SiyuanConfigSchema>

const SiyuanSettings = () => {
  const {
    config,
    notebooks,
    exportHistory,
    isConfigured,
    isTesting,
    isLoadingNotebooks,
    loadConfig,
    saveConfig,
    updateConfig,
    loadNotebooks,
    testConnection,
    loadExportHistory,
  } = useSiyuanStore()

  const [testingResult, setTestingResult] = useState<{
    success: boolean
    message: string
  } | null>(null)
  const [showApiToken, setShowApiToken] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  const form = useForm<SiyuanConfigFormValues>({
    resolver: zodResolver(SiyuanConfigSchema),
    defaultValues: {
      api_url: '',
      api_token: '',
      default_notebook: '',
    },
  })

  // 只在组件挂载时加载一次配置和历史
  useEffect(() => {
    loadConfig()
    loadExportHistory()
  }, [])

  // 当配置加载后，只在初次加载时填充表单
  useEffect(() => {
    if (config && !isInitialized) {
      // 从store中读取配置（store使用localStorage持久化，保存的是完整Token）
      form.reset({
        api_url: config.api_url || '',
        api_token: config.api_token || '',
        default_notebook: config.default_notebook || '',
      })
      setIsInitialized(true)
      
      // 如果有完整的Token，加载笔记本列表
      if (config.api_token && !config.api_token.includes('...')) {
        loadNotebooks().catch(() => {
          // 静默处理加载失败
        })
      }
    }
  }, [config, isInitialized])

  // 测试连接
  const handleTestConnection = async () => {
    const values = form.getValues()
    if (!values.api_url || !values.api_token) {
      toast.error('请先填写 API 地址和 Token')
      return
    }

    setTestingResult(null)
    const result = await testConnection({
      api_url: values.api_url,
      api_token: values.api_token,
    })

    setTestingResult(result)

    if (result.success) {
      toast.success('连接成功！')
      // 测试成功后，先更新store中的配置（使用完整Token），然后加载笔记本列表
      // 这样loadNotebooks就能使用完整的Token了
      try {
        // 临时更新store中的配置，但不保存到后端
        const { config } = useSiyuanStore.getState()
        useSiyuanStore.setState({ 
          config: { 
            ...config, 
            api_url: values.api_url, 
            api_token: values.api_token 
          } 
        })
        await loadNotebooks()
      } catch (error) {
        toast.error('加载笔记本列表失败')
      }
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

  // 保存配置
  const onSubmit = async (values: SiyuanConfigFormValues) => {
    try {
      if (isConfigured && config?.id) {
        await updateConfig({ ...values, id: config.id })
        toast.success('更新配置成功')
      } else {
        await saveConfig(values)
        toast.success('保存配置成功')
      }
      // 保存成功后，保持表单中的值不变（不重新加载配置）
      // 因为后端返回的Token是脱敏的，会导致表单被清空
      form.reset(values, { keepDirty: false })
    } catch (error) {
      toast.error(isConfigured ? '更新配置失败' : '保存配置失败')
    }
  }

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      {/* 配置表单 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-gray-900">思源笔记配置</h2>
          <p className="mt-1 text-sm text-gray-500">
            配置思源笔记 API 连接信息，用于将生成的笔记导出到思源笔记
          </p>
        </div>

        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <strong>配置说明：</strong>
            <ul className="mt-2 ml-4 list-disc space-y-1">
              <li>API 地址格式示例：http://localhost:6806</li>
              <li>Token 在思源笔记 设置 → 关于 → API 中生成</li>
              <li>请确保思源笔记已启动并开放 API 端口</li>
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
              name="api_url"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                    API 地址
                  </FormLabel>
                  <div className="sm:col-span-3">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="http://localhost:6806"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      思源笔记 API 地址，不要包含末尾斜杠
                    </FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="api_token"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                    API Token
                  </FormLabel>
                  <div className="sm:col-span-3">
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showApiToken ? 'text' : 'password'}
                          placeholder="输入思源笔记 API Token"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiToken(!showApiToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showApiToken ? (
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
              name="default_notebook"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                  <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                    默认笔记本
                  </FormLabel>
                  <div className="flex flex-col gap-2 sm:col-span-3">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={notebooks.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                notebooks.length === 0
                                  ? '请先测试连接'
                                  : '选择默认笔记本'
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {notebooks.map(notebook => (
                            <SelectItem
                              key={notebook.id}
                              value={notebook.id}
                            >
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4" />
                                {notebook.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        onClick={handleTestConnection}
                        variant="outline"
                        disabled={isTesting}
                        className="w-full shrink-0 sm:w-auto"
                      >
                        {isTesting ? '测试中...' : '测试连接'}
                      </Button>
                    </div>
                    <FormDescription className="text-xs">
                      选择导出笔记时默认使用的笔记本
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
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold text-gray-900">导出历史</h2>
          {exportHistory.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
              {exportHistory.length} 条记录
            </span>
          )}
        </div>

        {exportHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">任务 ID</th>
                  <th className="px-4 py-3">笔记本</th>
                  <th className="px-4 py-3">导出时间</th>
                </tr>
              </thead>
              <tbody>
                {exportHistory.map(record => (
                  <tr
                    key={record.id}
                    className="border-b hover:bg-gray-50"
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
                    <td className="px-4 py-3 font-mono text-xs">
                      {record.task_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">{record.notebook_name}</td>
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
            <p className="text-base font-medium text-gray-900">暂无导出历史</p>
            <p className="mt-2 text-sm text-gray-500">
              配置完成后，导出笔记时会在此显示历史记录
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default SiyuanSettings
