# NewAPI 快捷接入功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/settings/model/new` 页面新增 NewAPI 卡片，用户填写 base_url + API Key 后一键完成供应商和模型配置。

**Architecture:** 在现有供应商选择流程中新增 NewAPI 专用分支，简化表单字段，自动执行创建供应商 → 测试连通 → 获取模型 → 批量添加的流程。

**Tech Stack:** React 19 + TypeScript + Zustand + react-hook-form + Lucide Icons

---

## 文件结构

**修改文件：**
- `videoNote_frontend/src/components/Form/modelForm/Form.tsx` — 新增 NewAPI 卡片 + 简化表单 + 一键接入逻辑

**无需修改：**
- 后端 API 已完全支持现有流程
- 数据模型无需改动（type 字段新增 'newapi' 值在代码中处理）

---

### Task 1: 新增 NewAPI 卡片到供应商选择页

**Files:**
- Modify: `videoNote_frontend/src/components/Form/modelForm/Form.tsx:26-34` (PRESET_PROVIDERS 数组)

- [ ] **Step 1: 在 PRESET_PROVIDERS 数组中添加 NewAPI 预设**

在 Form.tsx 第 26-34 行的 PRESET_PROVIDERS 数组中，在 `ollama` 条目之后添加 NewAPI：

```typescript
const PRESET_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', logo: 'OpenAI', baseUrl: 'https://api.openai.com/v1', type: 'built-in' },
  { id: 'deepseek', name: 'DeepSeek', logo: 'DeepSeek', baseUrl: 'https://api.deepseek.com', type: 'built-in' },
  { id: 'qwen', name: 'Qwen', logo: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', type: 'built-in' },
  { id: 'claude', name: 'Claude', logo: 'Claude', baseUrl: 'https://api.anthropic.com/v1', type: 'built-in' },
  { id: 'gemini', name: 'Gemini', logo: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', type: 'built-in' },
  { id: 'groq', name: 'Groq', logo: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', type: 'built-in' },
  { id: 'ollama', name: 'Ollama', logo: 'Ollama', baseUrl: 'http://127.0.0.1:11434/v1', type: 'built-in' },
  { id: 'newapi', name: 'NewAPI', logo: 'NewAPI', baseUrl: '', type: 'newapi' },
]
```

- [ ] **Step 2: 在供应商选择网格中新增 NewAPI 卡片渲染**

在 Form.tsx 第 349-376 行的供应商选择网格中，在 PRESET_PROVIDERS.map 渲染之后、自定义按钮之前添加：

```tsx
{/* NewAPI 卡片 - 快捷接入 */}
<button
  onClick={() => handleSelectPreset(PRESET_PROVIDERS.find(p => p.id === 'newapi')!)}
  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer"
>
  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
    <Server className="h-6 w-6 text-gray-500" />
  </div>
  <span className="font-medium text-gray-900">NewAPI</span>
  <span className="text-xs text-gray-400">一键接入</span>
</button>
```

需要导入 `Server` 图标（在第 20 行的 lucide-react 导入中添加）：

```typescript
import { Eye, EyeOff, Check, AlertCircle, Plus, Loader2, Upload, X, Server } from 'lucide-react'
```

---

### Task 2: 新增 NewAPI 专用简化表单

**Files:**
- Modify: `videoNote_frontend/src/components/Form/modelForm/Form.tsx` (新增 NewAPI 表单分支)

- [ ] **Step 1: 新增 isNewApi 状态判断**

在 Form.tsx 的状态声明区域（约第 79 行），添加 isNewApi 判断：

```typescript
const isNewApi = selectedPreset?.id === 'newapi'
```

- [ ] **Step 2: 新增 NewAPI 简化表单渲染分支**

在 `isCreate && !selectedPreset && !isCustom` 条件判断之后（约第 376 行），新增 NewAPI 专用表单：

```tsx
// NewAPI 快捷接入模式
if (isCreate && isNewApi && selectedPreset) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <div className="text-center">
        <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-gray-100 mb-2">
          <Server className="h-6 w-6 text-gray-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">接入 NewAPI</h2>
        <p className="mt-1 text-sm text-gray-500">输入 API 地址和 Key，一键完成配置</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <Form {...providerForm}>
          <form className="flex flex-col gap-5">
            {/* 名称（可选） */}
            <FormField
              control={providerForm.control}
              name="name"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-center gap-4">
                  <FormLabel className="text-right">名称</FormLabel>
                  <div className="col-span-3">
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

            {/* API 地址（必填） */}
            <FormField
              control={providerForm.control}
              name="baseUrl"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-start gap-4">
                  <FormLabel className="pt-2 text-right">API 地址 <span className="text-red-500">*</span></FormLabel>
                  <div className="col-span-3 flex flex-col gap-2">
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

            {/* API Key（必填） */}
            <FormField
              control={providerForm.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem className="grid grid-cols-4 items-start gap-4">
                  <FormLabel className="pt-2 text-right">API Key <span className="text-red-500">*</span></FormLabel>
                  <div className="col-span-3 flex flex-col gap-2">
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
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
```

---

### Task 3: 实现一键接入逻辑

**Files:**
- Modify: `videoNote_frontend/src/components/Form/modelForm/Form.tsx` (新增 handleNewApiConnect 方法)

- [ ] **Step 1: 新增 handleNewApiConnect 方法**

在 Form.tsx 的 handleSelectCustom 方法之后（约第 162 行），新增 handleNewApiConnect：

```typescript
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
```

需要导入 `batchAddModels` 和 `BatchAddModelItem`（从 services/model.ts）：

在文件顶部的 import 中添加：
```typescript
import { testConnection, fetchModels, deleteModelById, uploadIcon, batchAddModels, BatchAddModelItem } from '@/services/model.ts'
```

---

### Task 4: 更新 AILogo 组件支持 NewAPI

**Files:**
- Modify: `videoNote_frontend/src/components/Form/modelForm/Icons/index.tsx`

- [ ] **Step 1: 在 AILogo 组件中添加 NewAPI 图标处理**

在 Icons/index.tsx 的 AILogo 函数中，当 name 为 'NewAPI' 时使用 Lucide Server 图标：

```typescript
import * as Icons from '@lobehub/icons'
import CustomLogo from '@/assets/customAI.png'
import { Server } from 'lucide-react'

interface AILogoProps {
  name: string
  logoUrl?: string
  style?: 'Color' | 'Text' | 'Outlined' | 'Glyph'
  size?: number
}

const AILogo = ({ name, logoUrl, style = 'Color', size = 24 }: AILogoProps) => {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="logo"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
        }}
      />
    )
  }

  // NewAPI 使用 Server 图标
  if (name === 'NewAPI') {
    return (
      <span style={{ fontSize: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Server size={size} className="text-gray-500" />
      </span>
    )
  }

  const Icon = Icons[name as keyof typeof Icons]
  if (!Icon) {
    return (
      <span style={{ fontSize: size }}>
        <img src={CustomLogo} alt="CustomLogo" style={{ width: size, height: size }} />
      </span>
    )
  }

  const Variant = Icon[style as keyof typeof Icon]
  if (!Variant) {
    return <Icon size={size} />
  }

  return <Variant size={size} />
}

export default AILogo
```

---

### Task 5: 手动测试验证

- [ ] **Step 1: 启动前端开发服务器**

```bash
cd videoNote_frontend && pnpm dev
```

- [ ] **Step 2: 打开浏览器访问 `/settings/model/new`**

确认 NewAPI 卡片显示在供应商选择网格中（位于"自定义"之前）

- [ ] **Step 3: 点击 NewAPI 卡片**

确认进入简化表单页，只显示名称、API 地址、API Key 三个字段

- [ ] **Step 4: 填写测试数据并点击一键接入**

使用有效的 NewAPI base_url 和 API Key，确认：
- 自动创建供应商
- 自动测试连通性
- 自动获取并添加模型
- 自动跳转到编辑页

---

### Task 6: 提交代码

- [ ] **Step 1: 提交前端改动**

```bash
git add videoNote_frontend/src/components/Form/modelForm/Form.tsx
git add videoNote_frontend/src/components/Form/modelForm/Icons/index.tsx
git commit -m "feat: 新增 NewAPI 快捷接入功能"
```