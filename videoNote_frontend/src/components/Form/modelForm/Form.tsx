import { useState, useEffect, useRef } from 'react'
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
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useProviderStore } from '@/store/providerStore'
import { useModelStore } from '@/store/modelStore'
import { toast } from 'sonner'
import { testConnection, fetchModels, deleteModelById, uploadIcon, batchAddModels, BatchAddModelItem } from '@/services/model.ts'
import { Eye, EyeOff, Check, AlertCircle, Plus, Loader2, Upload, X } from 'lucide-react'
import { CardSkeleton } from '@/components/Skeletons'
import AILogo from '@/components/Form/modelForm/Icons'
import NewApiLogo from '@/assets/newapi.svg'
import { ModelSelector } from '@/components/Form/modelForm/ModelSelector.tsx'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useIsMobile } from '@/hooks/use-mobile'

// 预设供应商列表
const PRESET_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', logo: 'OpenAI', baseUrl: 'https://api.openai.com/v1', type: 'built-in' },
  { id: 'deepseek', name: 'DeepSeek', logo: 'DeepSeek', baseUrl: 'https://api.deepseek.com', type: 'built-in' },
  { id: 'qwen', name: 'Qwen', logo: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', type: 'built-in' },
  { id: 'claude', name: 'Claude', logo: 'Claude', baseUrl: 'https://api.anthropic.com/v1', type: 'built-in' },
  { id: 'gemini', name: 'Gemini', logo: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', type: 'built-in' },
  { id: 'groq', name: 'Groq', logo: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', type: 'built-in' },
  { id: 'ollama', name: 'Ollama', logo: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1', type: 'built-in' },
]

// Provider 表单 schema
const ProviderSchema = z.object({
  name: z.string().min(2, '名称不能少于 2 个字符'),
  apiKey: z.string().optional(),
  baseUrl: z.string().url('必须是合法 URL'),
  type: z.string(),
})

type ProviderFormValues = z.infer<typeof ProviderSchema>

interface PresetProvider {
  id: string
  name: string
  logo: string
  baseUrl: string
  type: string
}

interface IModelItem {
  id: string
  provider_id: string
  model_name: string
  created_at?: string
}

const ProviderForm = ({ isCreate = false }: { isCreate?: boolean }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isMobile = useIsMobile()
  const isEditMode = !isCreate

  const loadProviderById = useProviderStore(state => state.loadProviderById)
  const updateProvider = useProviderStore(state => state.updateProvider)
  const addNewProviderWithModels = useProviderStore(state => state.addNewProviderWithModels)
  const deleteProvider = useProviderStore(state => state.deleteProvider)
  const loadModelsById = useModelStore(state => state.loadModelsById)

  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [isBuiltIn, setIsBuiltIn] = useState(false)
  const [models, setModels] = useState<IModelItem[]>([])
  const [selectedPreset, setSelectedPreset] = useState<PresetProvider | null>(null)
  const [isCustom, setIsCustom] = useState(false)
  const [modelsToSave, setModelsToSave] = useState<string[]>([])
  const [modelSelectorVisible, setModelSelectorVisible] = useState(false)
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isNewApi = selectedPreset?.id === 'newapi'

  // 删除确认弹窗
  const [deleteModelDialogOpen, setDeleteModelDialogOpen] = useState(false)
  const [pendingDeleteModelId, setPendingDeleteModelId] = useState<string | null>(null)
  const [deleteProviderDialogOpen, setDeleteProviderDialogOpen] = useState(false)

  const providerForm = useForm<ProviderFormValues>({
    resolver: zodResolver(ProviderSchema),
    defaultValues: {
      name: '',
      apiKey: '',
      baseUrl: '',
      type: 'custom',
    },
  })

  // 监听 location.state 变化，重置选择状态（用于"添加供应商"按钮强制重置）
  useEffect(() => {
    if (isCreate && location.state?.reset) {
      setSelectedPreset(null)
      setIsCustom(false)
      setCustomLogoUrl('')
      setTestSuccess(false)
      setModelSelectorVisible(false)
      providerForm.reset({
        name: '',
        apiKey: '',
        baseUrl: '',
        type: 'custom',
      })
    }
  }, [location.state, isCreate])

  // 加载已有供应商和模型
  useEffect(() => {
    const load = async () => {
      if (isEditMode && id) {
        try {
          const data = await loadProviderById(id)
          providerForm.reset(data)
          setIsBuiltIn(data.type === 'built-in')
          setTestSuccess(true) // 编辑模式下默认认为已测试通过
          setModelSelectorVisible(true) // 编辑模式下默认显示模型管理

          if (data.logoUrl) {
            setCustomLogoUrl(data.logoUrl)
          }

          // 加载已有模型
          const existingModels = await loadModelsById(id)
          if (existingModels) {
            setModels(existingModels)
          }
        } catch (e) {
          toast.error('加载供应商信息失败')
        }
      } else {
        // 新建模式
        providerForm.reset({
          name: '',
          apiKey: '',
          baseUrl: '',
          type: 'custom',
        })
        setSelectedPreset(null)
        setIsCustom(false)
        setIsBuiltIn(false)
        setTestSuccess(false)
      }
      setLoading(false)
    }
    load()
  }, [id])

  // 选择预设供应商
  const handleSelectPreset = (preset: PresetProvider) => {
    setSelectedPreset(preset)
    setIsCustom(false)
    providerForm.reset({
      name: preset.name,
      apiKey: '',
      baseUrl: preset.baseUrl,
      type: preset.type,
    })
    setTestSuccess(false)
    setModelSelectorVisible(false)
  }

  // 选择自定义
  const handleSelectCustom = () => {
    setSelectedPreset(null)
    setIsCustom(true)
    providerForm.reset({
      name: '',
      apiKey: '',
      baseUrl: '',
      type: 'custom',
    })
    setTestSuccess(false)
    setModelSelectorVisible(false)
  }

  // NewAPI 一键接入
  const handleNewApiConnect = async () => {
    const values = providerForm.getValues()
    if (!values.baseUrl || !values.apiKey) {
      toast.error('请填写 API 地址和 API Key')
      return
    }

    try {
      setSaving(true)

      // 1. 创建供应商
      const payload = {
        name: values.name || 'NewAPI',
        api_key: values.apiKey,
        base_url: values.baseUrl,
        logo: 'NewAPI',
        type: 'newapi',
      }
      const newId = await addNewProviderWithModels(payload as any, [])

      // 2. 测试连通性
      setTesting(true)
      await testConnection({ id: newId })
      toast.success('连通性测试成功')

      // 3. 获取模型列表
      const models = await fetchModels(newId)

      // 4. 批量添加模型
      if (models && models.length > 0) {
        const modelItems: BatchAddModelItem[] = models.map((m: any) => ({
          provider_id: newId,
          model_name: m.id || m.name || m,
        }))
        await batchAddModels(modelItems)
        toast.success(`成功接入 ${modelItems.length} 个模型`)
      } else {
        toast.success('供应商已创建，暂无可用模型')
      }

      // 5. 跳转到编辑页
      navigate(`/settings/model/${newId}`)
    } catch (error) {
      toast.error('接入失败，请检查 API 地址和 API Key')
    } finally {
      setTesting(false)
      setSaving(false)
    }
  }

  // 上传自定义图标（新建模式）
  const handleUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast.error('仅支持 JPG、PNG、WebP、SVG 格式')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过 2MB')
      return
    }

    try {
      setUploading(true)
      const res = await uploadIcon(file)
      setCustomLogoUrl(res.url)
      toast.success('图标上传成功')
    } catch {
      toast.error('图标上传失败')
    } finally {
      setUploading(false)
    }
  }

  // 编辑模式下上传并自动保存
  const handleEditUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast.error('仅支持 JPG、PNG、WebP、SVG 格式')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('图片大小不能超过 2MB')
      return
    }

    try {
      setUploading(true)
      const res = await uploadIcon(file)
      setCustomLogoUrl(res.url)
      await updateProvider({
        id: id!,
        logoUrl: res.url,
      })
      toast.success('图标已更新')
    } catch {
      toast.error('图标上传失败')
    } finally {
      setUploading(false)
    }
  }

  // 测试连通性
  const handleTest = async () => {
    const values = providerForm.getValues()
    if (!values.apiKey) {
      toast.error('请填写 API Key')
      return
    }

    // 新建模式下先保存供应商再测试
    let testId = id
    if (isCreate) {
      try {
        setSaving(true)
        const payload = {
          name: values.name,
          api_key: values.apiKey,
          base_url: values.baseUrl,
          logo: selectedPreset?.logo || 'custom',
          logo_url: customLogoUrl || undefined,
          type: values.type,
        }
        const newItem = await addNewProviderWithModels(payload as any, [])
        testId = newItem
        navigate(`/settings/model/${testId}`)
        toast.success('供应商已保存，正在测试连通性...')
      } catch (e) {
        toast.error('保存供应商失败')
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    }

    try {
      setTesting(true)
      await testConnection({ id: testId! })
      setTestSuccess(true)
      setModelSelectorVisible(true)
      toast.success('连通性测试成功 🎉')
    } catch (error) {
      setTestSuccess(false)
      toast.error('连通性测试失败，请检查 API Key 和 API 地址')
    } finally {
      setTesting(false)
    }
  }

  // 删除模型
  const handleDeleteModel = async (modelId: string) => {
    try {
      await deleteModelById(modelId)
      toast.success('删除成功')
      const updatedModels = await loadModelsById(id!)
      if (updatedModels) {
        setModels(updatedModels)
      }
    } catch (e) {
      toast.error('删除失败')
    }
  }

  // 删除供应商
  const handleDeleteProvider = async () => {
    if (!id) return
    try {
      await deleteProvider(id!)
      toast.success('删除供应商成功')
      navigate('/settings/model')
    } catch (e) {
      toast.error('删除供应商失败')
    }
  }

  // 自动保存供应商字段（失焦触发）
  const handleFieldBlur = async (field: 'apiKey' | 'baseUrl' | 'name') => {
    if (!isEditMode || !id) return
    const values = providerForm.getValues()
    // 检查字段是否有变化
    const dirtyFields = providerForm.formState.dirtyFields
    if (!dirtyFields[field]) return

    try {
      await updateProvider({
        id,
        apiKey: values.apiKey,
        baseUrl: values.baseUrl,
        name: values.name,
      })
      toast.success('已自动保存')
    } catch (e) {
      toast.error('保存失败')
    }
  }

  // 模型添加回调
  const handleModelsAdded = async () => {
    if (id) {
      const updatedModels = await loadModelsById(id)
      if (updatedModels) {
        setModels(updatedModels)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col gap-4 p-4 md:p-6 overflow-y-auto">
        <CardSkeleton count={5} />
      </div>
    )
  }

  // 新建模式：显示供应商选择器
  if (isCreate && !selectedPreset && !isCustom) {
    return (
      <div className="flex h-full flex-col gap-4 md:gap-6 overflow-y-auto p-4 md:p-6">
        {/* 标题 - 仅桌面端显示 */}
        {!isMobile && (
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground">选择供应商类型</h2>
            <p className="mt-1 text-sm text-muted-foreground">选择一个预设供应商或创建自定义供应商</p>
          </div>
        )}

        {/* 预设供应商卡片网格 */}
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {PRESET_PROVIDERS.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className="flex flex-col items-center gap-2 p-3 md:p-4 rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
            >
              <div className="flex h-10 md:h-12 w-10 md:w-12 items-center justify-center">
                <AILogo name={preset.logo} size={isMobile ? 36 : 48} />
              </div>
              <span className="font-medium text-sm md:text-base text-foreground">{preset.name}</span>
            </button>
          ))}

          {/* NewAPI 快捷接入 */}
          <button
            onClick={() => {
              setSelectedPreset({ id: 'newapi', name: 'NewAPI', logo: 'NewAPI', baseUrl: '', type: 'newapi' })
              setIsCustom(false)
              providerForm.reset({
                name: 'NewAPI',
                apiKey: '',
                baseUrl: '',
                type: 'newapi',
              })
              setTestSuccess(false)
              setModelSelectorVisible(false)
            }}
            className="flex flex-col items-center gap-2 p-3 md:p-4 rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <div className="flex h-10 md:h-12 w-10 md:w-12 items-center justify-center rounded-full bg-muted">
              <img src={NewApiLogo} alt="NewAPI" className="h-6 md:h-8 w-6 md:w-8 object-contain" />
            </div>
            <span className="font-medium text-sm md:text-base text-foreground">NewAPI</span>
            <span className="text-xs text-muted-foreground">一键接入</span>
          </button>

          {/* 自定义卡片 */}
          <button
            onClick={handleSelectCustom}
            className="flex flex-col items-center gap-2 p-3 md:p-4 rounded-lg border border-border bg-background hover:border-primary hover:bg-primary/10 transition-all cursor-pointer"
          >
            <div className="flex h-10 md:h-12 w-10 md:w-12 items-center justify-center rounded-full bg-muted">
              <Plus className="h-5 md:h-6 w-5 md:w-6 text-muted-foreground" />
            </div>
            <span className="font-medium text-sm md:text-base text-foreground">自定义</span>
          </button>
        </div>
      </div>
    )
  }

  // NewAPI 快捷接入模式
  if (isCreate && isNewApi && selectedPreset) {
    return (
      <div className="flex h-full flex-col gap-4 md:gap-6 overflow-y-auto p-4 md:p-6">
        {/* 标题 - 仅桌面端显示 */}
        {!isMobile && (
          <div className="text-center">
            <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-muted mb-2">
              <img src={NewApiLogo} alt="NewAPI" className="h-8 w-8 object-contain" />
            </div>
            <h2 className="text-xl font-bold text-foreground">接入 NewAPI</h2>
            <p className="mt-1 text-sm text-muted-foreground">输入 API 地址和 Key，一键完成配置</p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-background p-4 md:p-6 shadow-sm">
          <Form {...providerForm}>
            <form className="flex flex-col gap-4 md:gap-5">
              {/* 名称 */}
              <FormField
                control={providerForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 md:gap-4">
                    <FormLabel className={isMobile ? "" : "text-right"}>名称</FormLabel>
                    <div className="sm:col-span-3">
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="NewAPI"
                        />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {/* API 地址 */}
              <FormField
                control={providerForm.control}
                name="baseUrl"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 md:gap-4">
                    <FormLabel className={cn(isMobile ? "" : "pt-2 text-right")}>API 地址 <span className="text-red-500">*</span></FormLabel>
                    <div className="sm:col-span-3 flex flex-col gap-2">
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="https://your-api.com/v1"
                        />
                      </FormControl>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {/* API Key */}
              <FormField
                control={providerForm.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 md:gap-4">
                    <FormLabel className={cn(isMobile ? "" : "pt-2 text-right")}>API Key <span className="text-red-500">*</span></FormLabel>
                    <div className="sm:col-span-3 flex flex-col gap-2">
                      <div className="relative">
                        <FormControl>
                          <Input
                            {...field}
                            type={showApiKey ? 'text' : 'password'}
                            placeholder="输入 API Key"
                            className="pr-10"
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />

              {/* 一键接入按钮 */}
              <div className="flex items-center justify-center border-t pt-4">
                <Button
                  type="button"
                  size={isMobile ? 'sm' : 'default'}
                  onClick={handleNewApiConnect}
                  disabled={testing || saving || !providerForm.getValues().baseUrl || !providerForm.getValues().apiKey}
                  className="gap-1.5"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {saving ? '接入中...' : '一键接入'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    )
  }

  // 配置模式（新建或编辑）
  return (
    <div className="flex h-full flex-col gap-4 md:gap-6 overflow-y-auto p-4 md:p-6">
      {/* 供应商信息 */}
      <div className="rounded-lg border border-border bg-background p-4 md:p-6 shadow-sm">
        <Form {...providerForm}>
          <form className="flex flex-col gap-4 md:gap-5">
            {/* 标题区 - 仅桌面端显示 */}
            {!isMobile && (
              <div className="border-b pb-4">
                <div className="flex items-center gap-3">
                  {selectedPreset && (
                    <div className="flex h-10 w-10 items-center justify-center">
                      <AILogo name={selectedPreset.logo} size={40} />
                    </div>
                  )}
                  {isCustom && customLogoUrl && (
                    <div className="flex h-10 w-10 items-center justify-center">
                      <AILogo name="custom" logoUrl={customLogoUrl} size={40} />
                    </div>
                  )}
                  {isCustom && !customLogoUrl && (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <Plus className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-foreground">
                      {isEditMode ? '编辑供应商' : `配置 ${selectedPreset?.name || '自定义供应商'}`}
                    </h2>
                    {isBuiltIn && !isCreate && (
                      <p className="text-sm text-muted-foreground">预设供应商</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 名称 */}
            <FormField
              control={providerForm.control}
              name="name"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 md:gap-4">
                  <FormLabel className={isMobile ? "" : "text-right"}>名称</FormLabel>
                  <div className="sm:col-span-3">
                    <FormControl>
                      <Input
                        {...field}
                        disabled={selectedPreset && !isCustom}
                        placeholder="供应商名称"
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* API Key */}
            <FormField
              control={providerForm.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 md:gap-4">
                  <FormLabel className={cn(isMobile ? "" : "pt-2 text-right")}>API Key</FormLabel>
                  <div className="sm:col-span-3 flex flex-col gap-2">
                    <div className="relative">
                      <FormControl>
                        <Input
                          {...field}
                          type={showApiKey ? 'text' : 'password'}
                          placeholder="输入 API Key"
                          className="pr-10"
                          onBlur={() => handleFieldBlur('apiKey')}
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* API地址 */}
            <FormField
              control={providerForm.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 md:gap-4">
                  <FormLabel className={cn(isMobile ? "" : "pt-2 text-right")}>API地址</FormLabel>
                  <div className="sm:col-span-3 flex flex-col gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://api.example.com/v1"
                        onBlur={() => handleFieldBlur('baseUrl')}
                      />
                    </FormControl>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            {/* 图标上传 - 仅自定义供应商 */}
            {(isCustom || (isEditMode && !isBuiltIn)) && (
              <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-2 md:gap-4">
                <label className={cn("text-sm font-medium text-foreground", isMobile ? "" : "text-right")}>图标</label>
                <div className="sm:col-span-3">
                  <div className="flex items-center gap-3">
                    {customLogoUrl ? (
                      <div className="relative group">
                        <AILogo name="custom" logoUrl={customLogoUrl} size={40} />
                        <button
                          type="button"
                          onClick={() => setCustomLogoUrl('')}
                          className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-input bg-muted">
                        <Upload className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="icon-upload"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      style={{ display: 'none' }}
                      onChange={isEditMode ? handleEditUploadIcon : handleUploadIcon}
                      disabled={uploading}
                    />
                    <label
                      htmlFor="icon-upload"
                      className={`inline-flex cursor-pointer items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${uploading ? 'text-muted-foreground pointer-events-none' : 'text-primary hover:text-primary hover:bg-primary/10'}`}
                    >
                      {uploading ? '上传中...' : customLogoUrl ? '更换图标' : '上传图标'}
                    </label>
                    <span className="text-xs text-muted-foreground">JPG/PNG/WebP/SVG, 最大 2MB</span>
                  </div>
                </div>
              </div>
            )}

            {/* 测试连通性 */}
            <div className="flex items-center gap-3 border-t pt-4">
              <Button
                type="button"
                onClick={handleTest}
                variant="outline"
                size={isMobile ? 'sm' : 'default'}
                disabled={testing || saving}
                className="gap-1.5"
              >
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {testing ? '测试中...' : '测试连通性'}
              </Button>
              {testSuccess && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  连接成功
                </div>
              )}
            </div>
          </form>
        </Form>
      </div>

      {/* 模型管理 - 仅在测试成功后显示 */}
      {testSuccess && modelSelectorVisible && (
        <ModelSelector
          providerId={id!}
          existingModels={models.map(m => ({ id: m.id, model_name: m.model_name }))}
          onDeleteModel={(modelId: string) => {
            setPendingDeleteModelId(modelId)
            setDeleteModelDialogOpen(true)
          }}
          onModelsAdded={handleModelsAdded}
        />
      )}

      {/* 底部操作 */}
      {isEditMode && !isBuiltIn && (
        <div className="flex items-center gap-3 border-t pt-4">
          <Button
            type="button"
            variant="destructive"
            size={isMobile ? 'sm' : 'default'}
            onClick={() => setDeleteProviderDialogOpen(true)}
            disabled={saving}
          >
            删除供应商
          </Button>
        </div>
      )}
      {isCreate && !testSuccess && (
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          请先测试连通性后再添加模型
        </p>
      )}

      <ConfirmDialog
        open={deleteModelDialogOpen}
        onOpenChange={setDeleteModelDialogOpen}
        title="删除模型"
        description="确定要删除这个模型吗？"
        confirmText="删除"
        variant="destructive"
        onConfirm={() => pendingDeleteModelId && handleDeleteModel(pendingDeleteModelId)}
      />

      <ConfirmDialog
        open={deleteProviderDialogOpen}
        onOpenChange={setDeleteProviderDialogOpen}
        title="删除供应商"
        description="确定要删除这个供应商吗？此操作不可恢复！"
        confirmText="删除"
        variant="destructive"
        onConfirm={handleDeleteProvider}
      />
    </div>
  )
}

function cn(...args: (string | boolean | undefined)[]) {
  return args.filter(Boolean).join(' ')
}

export default ProviderForm