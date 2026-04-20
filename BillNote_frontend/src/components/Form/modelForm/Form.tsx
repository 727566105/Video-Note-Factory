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
import { useParams, useNavigate } from 'react-router-dom'
import { useProviderStore } from '@/store/providerStore'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { testConnection, fetchModels, deleteModelById } from '@/services/model.ts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx' // ⚡新增 fetchModels
import { ModelSelector } from '@/components/Form/modelForm/ModelSelector.tsx'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.tsx'
import { Tags, Eye, EyeOff } from 'lucide-react'
import { Tag } from 'antd'
import { useModelStore } from '@/store/modelStore'

// ✅ Provider表单schema
const ProviderSchema = z.object({
  name: z.string().min(2, '名称不能少于 2 个字符'),
  apiKey: z.string().optional(),
  baseUrl: z.string().url('必须是合法 URL'),
  type: z.string(),
})

type ProviderFormValues = z.infer<typeof ProviderSchema>

// ✅ Model表单schema
const ModelSchema = z.object({
  modelName: z.string().min(1, '请选择或填写模型名称'),
})

type ModelFormValues = z.infer<typeof ModelSchema>
interface IModel {
  id: string
  created: number
  object: string
  owned_by: string
  permission: string
  root: string
}
const ProviderForm = ({ isCreate = false }: { isCreate?: boolean }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditMode = !isCreate

  const getProviderById = useProviderStore(state => state.getProviderById)
  const loadProviderById = useProviderStore(state => state.loadProviderById)
  const updateProvider = useProviderStore(state => state.updateProvider)
  const addNewProvider = useProviderStore(state => state.addNewProvider)
  const deleteProvider = useProviderStore(state => state.deleteProvider)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isBuiltIn, setIsBuiltIn] = useState(false)
  const loadModelsById= useModelStore(state => state.loadModelsById)
  const [modelOptions, setModelOptions] = useState<IModel[]>([]) // ⚡新增，保存模型列表
  const [models, setModels]= useState([])
  const [modelLoading, setModelLoading] = useState(false)
  const randomColor = ()=>{
    return '#' + Math.floor(Math.random() * 16777215).toString(16)
  }

  const [search, setSearch] = useState('')
  const providerForm = useForm<ProviderFormValues>({
    resolver: zodResolver(ProviderSchema),
    defaultValues: {
      name: '',
      apiKey: '',
      baseUrl: '',
      type: 'custom',
    },
  })
  const filteredModelOptions = modelOptions.filter(model => {
    const keywords = search.trim().toLowerCase().split(/\s+/) // 支持多个关键词
    const target = model.id.toLowerCase()
    return keywords.every(kw => target.includes(kw))
  })

  const modelForm = useForm<ModelFormValues>({
    resolver: zodResolver(ModelSchema),
    defaultValues: {
      modelName: '',
    },
  })

  useEffect(() => {

    const load = async () => {
      if (isEditMode) {

        const data = await loadProviderById(id!)
        providerForm.reset(data)
        setIsBuiltIn(data.type === 'built-in')
      } else {
        providerForm.reset({
          name: '',
          apiKey: '',
          baseUrl: '',
          type: 'custom',
        })
        setIsBuiltIn(false)
      }
      const models = await loadModelsById(id!)
      if(models){
        setModels(models)
      }
      setLoading(false)
    }
    load()
  }, [id])
  const handelDelete = async (modelId) => {
    if (!window.confirm('确定要删除这个模型吗？此操作不可恢复。')) return

    try {
      const res = await deleteModelById(modelId)
      toast.success('删除成功')
      
      // 刷新模型列表
      const updatedModels = await loadModelsById(id!)
      if (updatedModels) {
        setModels(updatedModels)
      }
    } catch (e) {
      toast.error('删除失败，请重试')
    }
  }

  // 删除供应商
  const handleDeleteProvider = async () => {
    if (!id) return
    if (!window.confirm('确定要删除这个模型供应商吗？此操作不可恢复！')) return

    try {
      await deleteProvider(id!)
      toast.success('删除供应商成功')
      navigate('/settings/model')
    } catch (e) {
      toast.error('删除供应商失败')
    }
  }
  // 测试连通性
  const handleTest = async () => {
    const values = providerForm.getValues()
    if (!values.apiKey || !values.baseUrl) {
      toast.error('请填写 API Key 和 Base URL')
      return
    }
    try {
      if (!id){
        toast.error('请先保存供应商信息')
        return
      }
      setTesting(true)
     await testConnection({
             id
          })

        toast.success('测试连通性成功 🎉')

    } catch (error) {

      toast.error(`连接失败: ${data.data.msg || '未知错误'}`)
      // toast.error('测试连通性异常')
    } finally {
      setTesting(false)
    }
  }

  // 加载模型列表
  const handleModelLoad = async () => {
    const values = providerForm.getValues()
    if (!values.apiKey || !values.baseUrl) {
      toast.error('请先填写 API Key 和 Base URL')
      return
    }
    try {
      setModelLoading(true) // ✅ 开始 loading
      const res = await fetchModels(id!, { noCache: true }) // 这里稍后解释
      if (res.data.code === 0 && res.data.data.models.data.length > 0) {
        setModelOptions(res.data.data.models.data)
        toast.success('模型列表加载成功 🎉')
      } else {
        toast.error('未获取到模型列表')
      }
    } catch (error) {
      toast.error('加载模型列表失败')
    } finally {
      setModelLoading(false) // ✅ 结束 loading
    }
  }

  // 保存Provider信息
  const onProviderSubmit = async (values: ProviderFormValues) => {
    setSaving(true)
    try {
      if (isEditMode) {
        await updateProvider({ ...values, id: id! })
        toast.success('更新供应商成功')
      } else {
        const newId = await addNewProvider({ ...values })
        toast.success('新增供应商成功')
        // 导航到新创建的供应商编辑页面
        navigate(`/settings/model/${newId}`)
      }
    } catch (error) {
      toast.error(isEditMode ? '更新供应商失败' : '新增供应商失败')
    } finally {
      setSaving(false)
    }
  }

  // 保存Model信息
  const onModelSubmit = async (values: ModelFormValues) => {
    toast.success(`保存模型: ${values.modelName}`)
    await loadModelsById(id!)
  }

  if (loading) return (
    <div className="flex h-full items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-2 text-lg font-medium text-gray-600">加载中...</div>
        <div className="text-sm text-gray-400">正在获取供应商信息</div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full flex-col gap-8 overflow-y-auto p-6">
      {/* Provider信息表单 */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Form {...providerForm}>
          <form
            onSubmit={providerForm.handleSubmit(onProviderSubmit)}
            className="flex max-w-2xl flex-col gap-5"
          >
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {isEditMode ? '编辑模型供应商' : '新增模型供应商'}
                </h2>
                {!isBuiltIn && (
                  <p className="mt-1 text-sm text-gray-500">
                    自定义模型供应商需要确保兼容 OpenAI SDK
                  </p>
                )}
              </div>
            </div>
          <FormField
            control={providerForm.control}
            name="name"
            render={({ field }) => (
              <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                  名称
                </FormLabel>
                <div className="sm:col-span-3">
                  <FormControl>
                    <Input {...field} disabled={isBuiltIn} placeholder="输入供应商名称" />
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={providerForm.control}
            name="apiKey"
            render={({ field }) => (
              <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                  API Key
                </FormLabel>
                <div className="sm:col-span-3">
                  <FormControl>
                    <div className="relative">
                      <Input 
                        {...field} 
                        type={showApiKey ? 'text' : 'password'} 
                        placeholder="输入 API Key"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                      >
                        {showApiKey ? (
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
            control={providerForm.control}
            name="baseUrl"
            render={({ field }) => (
              <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-start sm:gap-4">
                <FormLabel className="text-sm font-medium text-gray-700 sm:pt-2 sm:text-right">
                  API地址
                </FormLabel>
                <div className="flex flex-col gap-2 sm:col-span-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <FormControl>
                      <Input {...field} placeholder="https://api.example.com/v1" />
                    </FormControl>
                    <Button 
                      type="button" 
                      onClick={handleTest} 
                      variant="outline" 
                      disabled={testing}
                      className="w-full shrink-0 sm:w-auto"
                    >
                      {testing ? '测试中...' : '测试连通性'}
                    </Button>
                  </div>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={providerForm.control}
            name="type"
            render={({ field }) => (
              <FormItem className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
                <FormLabel className="text-sm font-medium text-gray-700 sm:text-right">
                  类型
                </FormLabel>
                <div className="sm:col-span-3">
                  <FormControl>
                    <Input {...field} disabled className="bg-gray-50" />
                  </FormControl>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
          <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:gap-3">
            <Button 
              type="submit" 
              disabled={!providerForm.formState.isDirty || saving}
              className="w-full min-w-[120px] sm:w-auto"
            >
              {saving ? '保存中...' : (isEditMode ? '保存修改' : '保存创建')}
            </Button>
            {isEditMode && !isBuiltIn && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteProvider}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                删除供应商
              </Button>
            )}
          </div>
        </form>
      </Form>
      </div>

      {/* 模型信息表单 */}
      <div className="flex flex-col gap-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900">模型管理</h2>
          </div>
          
          <Alert className="border-amber-200 bg-amber-50">
            <AlertDescription className="text-sm text-amber-800">
              💡 请确保已经保存供应商信息并通过测试连通性后再添加模型
            </AlertDescription>
          </Alert>

          <ModelSelector providerId={id!} onModelAdded={async () => {
            const updatedModels = await loadModelsById(id!)
            if (updatedModels) {
              setModels(updatedModels)
            }
          }} />
        </div>

        <div className="flex flex-col gap-4 border-t pt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">已启用模型</h3>
            {models && models.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {models.length} 个
              </span>
            )}
          </div>
          
          {models && models.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {models.map(model => (
                <Tag
                  key={model.id}
                  closable
                  onClose={() => handelDelete(model.id)}
                  color="blue"
                  className="flex items-center gap-1 px-3 py-1.5 text-sm"
                >
                  {model.model_name}
                </Tag>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
              <svg
                className="mb-4 h-16 w-16 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              <p className="text-base font-medium text-gray-900">暂无已启用的模型</p>
              <p className="mt-2 text-sm text-gray-500">请从上方选择并添加模型</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProviderForm
