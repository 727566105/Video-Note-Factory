# 自定义供应商图标上传 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为供应商设置页面新增自定义图标上传功能，用户可以上传圆形裁剪的图标替代默认占位图。

**Architecture:** 后端新增 `logo_url` 字段和图标上传端点；前端 AILogo 组件优先渲染 `logoUrl`（上传图片），回退到 `@lobehub/icons` 图标名。

**Tech Stack:** FastAPI + SQLAlchemy（后端），React + TypeScript + Zustand（前端）

---

## 文件结构

| 操作 | 文件路径 | 职责 |
|------|---------|------|
| 修改 | `backend/app/db/models/providers.py` | 新增 `logo_url` 列 |
| 修改 | `backend/app/db/provider_dao.py` | insert_provider 支持 `logo_url` |
| 修改 | `backend/app/services/provider.py` | 序列化包含 `logo_url`，add_provider 接受 `logo_url` |
| 修改 | `backend/app/routers/provider.py` | 新增上传端点 + 请求模型含 `logo_url` |
| 修改 | `backend/main.py` | 启动时创建 `uploads/icons/` 目录 |
| 修改 | `BillNote_frontend/src/types/api.ts` | Provider 新增 `logoUrl` |
| 修改 | `BillNote_frontend/src/services/model.ts` | 新增 `uploadIcon` 函数 |
| 修改 | `BillNote_frontend/src/components/Form/modelForm/Icons/index.tsx` | AILogo 支持 `logoUrl` |
| 修改 | `BillNote_frontend/src/store/providerStore/index.ts` | 映射 `logo_url` |
| 修改 | `BillNote_frontend/src/components/Form/modelForm/components/providerCard.tsx` | 传递 `logoUrl` |
| 修改 | `BillNote_frontend/src/components/Form/modelForm/Provider.tsx` | 传递 `logoUrl` |
| 修改 | `BillNote_frontend/src/components/Form/modelForm/Form.tsx` | 上传 UI |

---

### Task 1: 后端数据库模型 — 新增 `logo_url` 字段

**Files:**
- Modify: `backend/app/db/models/providers.py`

- [ ] **Step 1: 给 Provider 模型新增 `logo_url` 列**

在 `backend/app/db/models/providers.py` 第 17 行 `created_at` 之前新增：

```python
from sqlalchemy import Column, String, Integer, DateTime, func
from sqlalchemy.orm import declarative_base

from app.db.engine import Base


class Provider(Base):
    __tablename__ = "providers"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    logo = Column(String, nullable=False)
    logo_url = Column(String, nullable=True, default=None)
    type = Column(String, nullable=False)
    api_key = Column(String, nullable=False)
    base_url = Column(String, nullable=False)
    enabled = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())
```

- [ ] **Step 2: 重启后端验证数据库自动迁移**

SQLAlchemy 的 `Base.metadata.create_all` 会自动创建新列。重启后端 `python3 main.py`，检查无报错。

---

### Task 2: 后端 DAO 层 — insert_provider 支持 `logo_url`

**Files:**
- Modify: `backend/app/db/provider_dao.py`

- [ ] **Step 1: 更新 `insert_provider` 函数签名和实现**

在 `backend/app/db/provider_dao.py` 中，修改 `insert_provider` 函数（第 52 行起）：

```python
def insert_provider(id: str, name: str, api_key: str, base_url: str, logo: str, type_: str, enabled: int = 1, logo_url: str = None):
    db = next(get_db())
    try:
        provider = Provider(id=id, name=name, api_key=api_key, base_url=base_url, logo=logo, type=type_, enabled=enabled, logo_url=logo_url)
        db.add(provider)
        db.commit()
        logger.info(f"Provider inserted successfully. id: {id}, name: {name}, type: {type_}")
        return id
    except Exception as e:
        logger.error(f"Failed to insert provider: {e}")
    finally:
        db.close()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/db/models/providers.py backend/app/db/provider_dao.py
git commit -m "feat: add logo_url column to providers table and DAO"
```

---

### Task 3: 后端 Service 层 — 序列化包含 `logo_url`

**Files:**
- Modify: `backend/app/services/provider.py`

- [ ] **Step 1: 更新 `provider_to_dict` 包含 `logo_url`**

在 `backend/app/services/provider.py` 中，修改 `provider_to_dict` 方法（第 66 行起）：

```python
    @staticmethod
    def provider_to_dict(p: Provider):
        return {
            "id": p.id,
            "name": p.name,
            "logo": p.logo,
            "logo_url": p.logo_url,
            "type": p.type,
            "api_key": p.api_key,
            "base_url": p.base_url,
            "enabled": p.enabled,
            "created_at": p.created_at,
        }
```

- [ ] **Step 2: 更新 `serialize_provider` 包含 `logo_url`**

修改 `serialize_provider` 方法（第 20 行起），在 `"logo"` 行之后新增 `"logo_url"`：

```python
    @staticmethod
    def serialize_provider(row: Provider) -> dict:
        if not row:
            return None
        row = ProviderService.provider_to_dict(row)
        return {
            "id": row.get("id"),
            "name": row.get("name"),
            "logo": row.get("logo"),
            "logo_url": row.get("logo_url"),
            "type":row.get("type"),
            "enabled": row.get("enabled"),
            "base_url": row.get("base_url"),
            "api_key": row.get("api_key"),
            "created_at": jsonable_encoder(row.get("created_at")),
        }
```

- [ ] **Step 3: 更新 `serialize_provider_safe` 包含 `logo_url`**

修改 `serialize_provider_safe` 方法（第 36 行起）：

```python
    @staticmethod
    def serialize_provider_safe(row: Provider) -> dict:
        if not row:
            return None
        row = ProviderService.provider_to_dict(row)
        return {
            "id": row.get("id"),
            "name": row.get("name"),
            "logo": row.get("logo"),
            "logo_url": row.get("logo_url"),
            "type":row.get("type"),
            "enabled": row.get("enabled"),
            "base_url": row.get("base_url"),
            "api_key":  ProviderService.mask_key(row.get("api_key")),
            "created_at": jsonable_encoder(row.get("created_at")),
        }
```

- [ ] **Step 4: 更新 `add_provider` 方法接受 `logo_url` 参数**

修改 `add_provider` 方法（第 58 行起）：

```python
    @staticmethod
    def add_provider(name: str, api_key: str, base_url: str, logo: str, type_: str, enabled: int = 1, logo_url: str = None):
        try:
            id = uuid().lower()
            return insert_provider(id, name, api_key, base_url, logo, type_, enabled, logo_url=logo_url)
        except Exception as e:
            print('创建模式失败', e)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/provider.py
git commit -m "feat: include logo_url in provider serialization and creation"
```

---

### Task 4: 后端路由 — 新增图标上传端点 + 请求模型更新

**Files:**
- Modify: `backend/app/routers/provider.py`
- Modify: `backend/main.py`

- [ ] **Step 1: 更新请求模型包含 `logo_url`**

在 `backend/app/routers/provider.py` 中，修改 `ProviderRequest`（第 16 行）和 `ProviderUpdateRequest`（第 25 行）：

```python
class ProviderRequest(BaseModel):
    name: str
    api_key: str
    base_url: str
    logo: Optional[str] = None
    logo_url: Optional[str] = None
    type: str

class TestRequest(BaseModel):
    id: str

class ProviderUpdateRequest(BaseModel):
    id: str
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    logo: Optional[str] = None
    logo_url: Optional[str] = None
    type: Optional[str] = None
    enabled: Optional[int] = None
```

- [ ] **Step 2: 更新 `add_provider` 路由传递 `logo_url`**

修改 `add_provider` 路由（第 34 行起）：

```python
@router.post("/add_provider")
def add_provider(data: ProviderRequest):
    try:
        res = ProviderService.add_provider(
            name=data.name,
            api_key=data.api_key,
            base_url=data.base_url,
            logo=data.logo,
            type_=data.type,
            logo_url=data.logo_url
        )
        return R.success(msg='添加模型供应商成功', data=res)
    except Exception as e:
        return R.error(msg=e)
```

- [ ] **Step 3: 更新 `update_provider` 路由的空值检查**

修改 `update_provider` 路由（第 73 行起），在 `all()` 检查中加入 `data.logo_url`：

```python
@router.post("/update_provider")
def update_provider(data: ProviderUpdateRequest):
    try:
        if all(
            field is None
            for field in [data.name, data.api_key, data.base_url, data.logo, data.logo_url, data.type, data.enabled]
        ):
            return R.error(msg='请至少填写一个参数')

        provider_id = ProviderService.update_provider(
            id=data.id,
            data=dict(data)
        )
        return R.success(msg='更新模型供应商成功', data={'id': provider_id})
    except Exception as e:
        logger.error(f"更新供应商失败: {e}")
        return R.error(msg=str(e))
```

- [ ] **Step 4: 新增图标上传端点**

在 `backend/app/routers/provider.py` 顶部新增 import，然后在文件末尾添加上传端点：

新增 import（文件顶部）：
```python
import os
import uuid
from fastapi import UploadFile, File
```

在文件末尾 `delete_provider` 路由之后添加：

```python
# 图标上传配置
ICON_UPLOAD_DIR = "uploads/icons"
ICON_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "svg"}
ICON_MAX_SIZE = 2 * 1024 * 1024  # 2MB

@router.post("/upload_icon")
async def upload_icon(file: UploadFile = File(...)):
    """上传供应商图标"""
    # 校验文件扩展名
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ICON_ALLOWED_EXTENSIONS:
        return R.error(msg=f"不支持的文件格式，仅允许: {', '.join(ICON_ALLOWED_EXTENSIONS)}")

    # 读取文件内容并校验大小
    content = await file.read()
    if len(content) > ICON_MAX_SIZE:
        return R.error(msg="文件大小不能超过 2MB")

    # 确保目录存在
    os.makedirs(ICON_UPLOAD_DIR, exist_ok=True)

    # 生成唯一文件名
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(ICON_UPLOAD_DIR, filename)

    # 写入文件
    with open(filepath, "wb") as f:
        f.write(content)

    url = f"/uploads/icons/{filename}"
    return R.success(data={"url": url})
```

- [ ] **Step 5: 确保 `uploads/icons/` 目录在启动时创建**

在 `backend/main.py` 中，找到 `uploads_dir = "uploads"` 行（约第 79 行），在其 `os.makedirs` 之后添加：

```python
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
    # 确保图标上传目录存在
    os.makedirs(os.path.join(uploads_dir, "icons"), exist_ok=True)
```

- [ ] **Step 6: 重启后端并验证上传端点**

重启后端，用 curl 测试：
```bash
# 创建测试图片
echo "test" > /tmp/test.png
# 测试上传
curl -X POST http://localhost:8483/api/upload_icon -F "file=@/tmp/test.png"
```

预期返回：`{"code":0,"data":{"url":"/uploads/icons/<uuid>.png"}}`

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/provider.py backend/main.py
git commit -m "feat: add icon upload endpoint and logo_url support in routes"
```

---

### Task 5: 前端类型定义 + API 服务

**Files:**
- Modify: `BillNote_frontend/src/types/api.ts`
- Modify: `BillNote_frontend/src/services/model.ts`

- [ ] **Step 1: 更新 Provider 类型**

在 `BillNote_frontend/src/types/api.ts` 中，给 `Provider` 接口新增 `logoUrl` 字段：

```typescript
// Provider 相关
export interface Provider {
  id: string
  name: string
  api_key: string
  base_url: string
  logo: string
  logoUrl?: string
  type: string
  enabled: number
}
```

- [ ] **Step 2: 新增 `uploadIcon` 函数和更新 `ProviderUpdateData`**

在 `BillNote_frontend/src/services/model.ts` 中，更新 `ProviderUpdateData` 并新增 `uploadIcon`：

```typescript
export interface ProviderUpdateData {
  id: string
  name?: string
  api_key?: string
  base_url?: string
  logo?: string
  logo_url?: string
  type?: string
  enabled?: number
}
```

在文件末尾新增：

```typescript
// 上传供应商图标
export const uploadIcon = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return await request.post('/upload_icon', formData)
}
```

- [ ] **Step 3: Commit**

```bash
git add BillNote_frontend/src/types/api.ts BillNote_frontend/src/services/model.ts
git commit -m "feat: add logoUrl type and uploadIcon API function"
```

---

### Task 6: 前端 AILogo 组件 — 支持 `logoUrl`

**Files:**
- Modify: `BillNote_frontend/src/components/Form/modelForm/Icons/index.tsx`

- [ ] **Step 1: 更新 AILogo 组件**

替换 `BillNote_frontend/src/components/Form/modelForm/Icons/index.tsx` 全部内容：

```tsx
import * as Icons from '@lobehub/icons'
import CustomLogo from '@/assets/customAI.png'

interface AILogoProps {
  name: string
  logoUrl?: string
  style?: 'Color' | 'Text' | 'Outlined' | 'Glyph'
  size?: number
}

const AILogo = ({ name, logoUrl, style = 'Color', size = 24 }: AILogoProps) => {
  // 优先使用上传的自定义图标
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

- [ ] **Step 2: Commit**

```bash
git add BillNote_frontend/src/components/Form/modelForm/Icons/index.tsx
git commit -m "feat: AILogo supports logoUrl for custom uploaded icons"
```

---

### Task 7: 前端 ProviderStore — 映射 `logo_url`

**Files:**
- Modify: `BillNote_frontend/src/store/providerStore/index.ts`

- [ ] **Step 1: 更新 `fetchProviderList` 映射**

在 `BillNote_frontend/src/store/providerStore/index.ts` 中，修改 `fetchProviderList` 内的 map 函数（约第 140 行），新增 `logo_url` 映射：

```typescript
      fetchProviderList: async () => {
        try {
          const res = await getProviderList()

            set({
              provider: res.map(
                (item: {
                  id: string
                  name: string
                  logo: string
                  logo_url: string
                  api_key: string
                  base_url: string
                  type: string
                  enabled: number
                }) => {
                  return {
                    id: item.id,
                    name: item.name,
                    logo: item.logo,
                    logoUrl: item.logo_url,
                    apiKey: item.api_key,
                    baseUrl: item.base_url,
                    type: item.type,
                    enabled: item.enabled,
                  }
                }
              ),
            })
        } catch (error) {
          console.error('Error fetching provider list:', error)
        }
      },
```

- [ ] **Step 2: 更新 `loadProviderById` 映射**

修改 `loadProviderById` 方法（约第 45 行），新增 `logo_url` 映射：

```typescript
  loadProviderById: async (id: string) => {
    const res:IResponse<IProvider> = await getProviderById(id)

      const item = res
      return {
        id: item.id,
        name: item.name,
        logo: item.logo,
        logoUrl: item.logo_url,
        apiKey: item.api_key,
        baseUrl: item.base_url,
        type: item.type,
        enabled: item.enabled,
      }

  },
```

- [ ] **Step 3: 更新 `updateProvider` 传 `logo_url`**

在 `updateProvider` 方法中（约第 103 行），新增 `logo_url` 传递：

```typescript
  updateProvider: async (provider: IProvider) => {
    try {
      const data: any = {
        id: provider.id,
      }
      if (provider.name !== undefined) data.name = provider.name
      if (provider.apiKey !== undefined) data.api_key = provider.apiKey
      if (provider.baseUrl !== undefined) data.base_url = provider.baseUrl
      if (provider.type !== undefined) data.type = provider.type
      if (provider.enabled !== undefined) data.enabled = provider.enabled
      if (provider.logo !== undefined) data.logo = provider.logo
      if (provider.logoUrl !== undefined) data.logo_url = provider.logoUrl

      const res = await updateProviderById(data)
      await get().fetchProviderList()
      return res
    } catch (error) {
      console.error('Error updating provider:', error)
      throw error
    }
  },
```

- [ ] **Step 4: Commit**

```bash
git add BillNote_frontend/src/store/providerStore/index.ts
git commit -m "feat: map logo_url in providerStore"
```

---

### Task 8: 前端 ProviderCard + Provider 列表 — 传递 `logoUrl`

**Files:**
- Modify: `BillNote_frontend/src/components/Form/modelForm/components/providerCard.tsx`
- Modify: `BillNote_frontend/src/components/Form/modelForm/Provider.tsx`

- [ ] **Step 1: 更新 ProviderCard 接收并传递 `logoUrl`**

在 `BillNote_frontend/src/components/Form/modelForm/components/providerCard.tsx` 中：

更新接口（第 8 行起）：
```typescript
export interface IProviderCardProps {
  id: string
  providerName: string
  Icon: string
  logoUrl?: string
  enable: number
}
```

更新组件参数解构（第 14 行）：
```typescript
const ProviderCard: FC<IProviderCardProps> = ({
  providerName,
  Icon,
  logoUrl,
  id,
  enable,
}: IProviderCardProps) => {
```

更新 AILogo 调用（第 50 行）：
```tsx
          <AILogo name={Icon} logoUrl={logoUrl} />
```

- [ ] **Step 2: 更新 Provider 列表传递 `logoUrl`**

在 `BillNote_frontend/src/components/Form/modelForm/Provider.tsx` 中，更新 ProviderCard 调用（第 41 行起）：

```tsx
              <ProviderCard
                key={index}
                providerName={provider.name}
                Icon={provider.logo}
                logoUrl={provider.logoUrl}
                id={provider.id}
                enable={provider.enabled}
              />
```

- [ ] **Step 3: Commit**

```bash
git add BillNote_frontend/src/components/Form/modelForm/components/providerCard.tsx BillNote_frontend/src/components/Form/modelForm/Provider.tsx
git commit -m "feat: pass logoUrl through ProviderCard and Provider list"
```

---

### Task 9: 前端 ProviderForm — 图标上传 UI

**Files:**
- Modify: `BillNote_frontend/src/components/Form/modelForm/Form.tsx`

这是最大的一个改动。在 Form.tsx 中：

1. 新增 import
2. 新增上传相关 state
3. 新建模式"自定义"卡片后显示上传区域
4. 编辑模式显示当前图标 + 更换按钮
5. 保存时传递 `logo_url`

- [ ] **Step 1: 新增 import**

在 `BillNote_frontend/src/components/Form/modelForm/Form.tsx` 顶部 import 区域（第 19 行之后）新增：

```typescript
import { uploadIcon } from '@/services/model.ts'
import { Upload, X } from 'lucide-react'
```

- [ ] **Step 2: 新增上传相关 state**

在组件内部的 state 声明区域（约第 82 行 `modelSelectorVisible` 之后）新增：

```typescript
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('')
  const [uploading, setUploading] = useState(false)
```

- [ ] **Step 3: 新增图标上传处理函数**

在 `handleSelectCustom` 函数之后（约第 155 行）新增：

```typescript
  // 上传自定义图标
  const handleUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 前端预校验
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
      // 自动保存到后端
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
```

- [ ] **Step 4: 编辑模式加载已有 `logoUrl`**

在 `useEffect` 的编辑模式分支中（约第 99 行 `const data = await loadProviderById(id)` 之后），新增：

```typescript
          if (data.logoUrl) {
            setCustomLogoUrl(data.logoUrl)
          }
```

完整的 `useEffect` load 函数变为：

```typescript
  useEffect(() => {
    const load = async () => {
      if (isEditMode && id) {
        try {
          const data = await loadProviderById(id)
          providerForm.reset(data)
          setIsBuiltIn(data.type === 'built-in')
          setTestSuccess(true)
          setModelSelectorVisible(true)
          if (data.logoUrl) {
            setCustomLogoUrl(data.logoUrl)
          }

          const existingModels = await loadModelsById(id)
          if (existingModels) {
            setModels(existingModels)
          }
        } catch (e) {
          toast.error('加载供应商信息失败')
        }
      } else {
        providerForm.reset({
          name: '',
          apiKey: '',
          baseUrl: '',
          type: 'custom',
        })
        setIsBuiltIn(false)
        setTestSuccess(false)
      }
      setLoading(false)
    }
    load()
  }, [id])
```

- [ ] **Step 5: 新建模式 — "自定义"卡片下方添加上传区域**

在 `handleTest` 函数中（约第 174 行），修改保存 payload 包含 `logo_url`：

```typescript
        const payload = {
          name: values.name,
          api_key: values.apiKey,
          base_url: values.baseUrl,
          logo: selectedPreset?.logo || 'custom',
          logo_url: customLogoUrl || undefined,
          type: values.type,
        }
```

然后找到新建模式"自定义"选择后的配置界面（`isCreate && !selectedPreset && !isCustom` 的 return 之后），在 `<div className="flex items-center gap-3">` 供应商信息头部的 div 中（约第 321 行 `selectedPreset` 条件渲染区域），修改为同时支持自定义图标的显示：

将配置模式中（第 319 行起）的供应商头部区域改为：

```tsx
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <Plus className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {isEditMode ? '编辑供应商' : `配置 ${selectedPreset?.name || '自定义供应商'}`}
                  </h2>
                  {isBuiltIn && !isCreate && (
                    <p className="text-sm text-gray-500">预设供应商</p>
                  )}
                </div>
              </div>
            </div>
```

在名称字段之后、API Key 字段之前（约第 337 行），插入图标上传区域：

```tsx
            {/* 图标上传 - 仅自定义供应商 */}
            {(isCustom || (isEditMode && !isBuiltIn)) && (
              <FormItem className="grid grid-cols-4 items-center gap-4">
                <FormLabel className="text-right">图标</FormLabel>
                <div className="col-span-3">
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
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50">
                        <Upload className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <label className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${uploading ? 'text-gray-400 pointer-events-none' : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'}`}>
                      {uploading ? '上传中...' : customLogoUrl ? '更换图标' : '上传图标'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        className="hidden"
                        onChange={isEditMode ? handleEditUploadIcon : handleUploadIcon}
                        disabled={uploading}
                      />
                    </label>
                    <span className="text-xs text-gray-400">JPG/PNG/WebP/SVG, 最大 2MB</span>
                  </div>
                </div>
              </FormItem>
            )}
```

- [ ] **Step 6: Commit**

```bash
git add BillNote_frontend/src/components/Form/modelForm/Form.tsx
git commit -m "feat: add icon upload UI to provider create/edit form"
```

---

### Task 10: 端到端验证

- [ ] **Step 1: 重启前后端服务**

```bash
# 后端
cd backend && python3 main.py
# 前端
cd BillNote_frontend && pnpm dev
```

- [ ] **Step 2: 验证新建自定义供应商 + 上传图标**

1. 打开 `http://localhost:3015/settings/model`
2. 点击"添加供应商"
3. 选择"自定义"
4. 上传一张 PNG 图片 → 确认圆形预览
5. 填写 API Key 和 API 地址 → 测试连通性 → 添加模型 → 保存
6. 返回列表页确认自定义图标显示正常

- [ ] **Step 3: 验证编辑模式更换图标**

1. 点击刚创建的自定义供应商
2. 看到"上传图标"区域显示当前图标
3. 点击"更换图标"上传新图片
4. 确认自动保存成功，返回列表看到更新

- [ ] **Step 4: 验证预设供应商不受影响**

1. 查看列表中的 DeepSeek、OpenAI 等预设供应商
2. 确认仍显示 `@lobehub/icons` 图标，无异常

- [ ] **Step 5: 验证错误场景**

1. 尝试上传超过 2MB 的图片 → 确认提示错误
2. 尝试上传非图片文件 → 确认提示错误
