# 自定义供应商图标上传

## Context

当前 videoNote 的供应商图标仅支持 `@lobehub/icons` 预设图标（OpenAI、DeepSeek 等 7 种），自定义供应商统一显示 `customAI.png` 占位图。用户希望能上传自定义图标，让非预设供应商也有辨识度。

## 方案：新增 `logo_url` 字段

保留 `logo` 字段存储 `@lobehub/icons` 图标名，新增 `logo_url` 存储上传图片的 URL 路径。AILogo 组件优先使用 `logoUrl`，无值时回退到 `logo` 图标名。

## 后端变更

### 1. 数据库

`providers` 表新增字段：
```sql
ALTER TABLE providers ADD COLUMN logo_url VARCHAR DEFAULT NULL;
```

文件：`backend/app/db/models/providers.py` — `Provider` 模型新增 `logo_url = Column(String, nullable=True)`

### 2. 图标上传端点

新增 `POST /api/upload/icon`（在 `backend/app/routers/provider.py` 中）：
- 接收 `UploadFile`（multipart/form-data）
- 仅允许图片格式：jpg、jpeg、png、webp、svg
- 大小限制 2MB
- 保存到 `uploads/icons/{uuid}.{ext}`（启动时自动创建目录）
- 返回 `{"code": 0, "data": {"url": "/uploads/icons/xxx.png"}}`

### 3. Provider CRUD 更新

- `GET /get_all_providers`、`GET /get_provider_by_id/{id}` 响应包含 `logo_url`
- `POST /update_provider` 支持更新 `logo_url` 字段
- `POST /add_provider` 支持传入 `logo_url`

文件：
- `backend/app/services/provider.py` — 序列化时包含 `logo_url`
- `backend/app/routers/provider.py` — 更新路由处理 `logo_url`
- `backend/app/db/provider_dao.py` — DAO 层支持 `logo_url`

## 前端变更

### 1. 类型定义

`src/types/api.ts` — `Provider` 接口新增 `logoUrl?: string`

### 2. AILogo 组件

文件：`src/components/Form/modelForm/Icons/index.tsx`

新增 `logoUrl` 可选 prop：
```
interface AILogoProps {
  name: string
  logoUrl?: string  // 新增
  style?: 'Color' | 'Text' | 'Outlined' | 'Glyph'
  size?: number
}
```

渲染逻辑：
1. 有 `logoUrl` → `<img>` 圆形裁剪（`rounded-full object-cover`）
2. 无 `logoUrl` → 走原有 `@lobehub/icons` 查找逻辑

### 3. providerStore

文件：`src/store/providerStore/index.ts`

- `fetchProviderList`：映射 `item.logo_url → provider.logoUrl`
- `loadProviderById`：映射 `item.logo_url → logoUrl`
- `updateProvider`：传 `logo_url` 到后端

### 4. ProviderForm 上传 UI

文件：`src/components/Form/modelForm/Form.tsx`

**新建模式（选择"自定义"后）**：
- 显示图标上传区域（拖拽或点击上传）
- 上传后立即预览圆形裁剪效果
- 保存时将 `logoUrl` 传给后端

**编辑模式**：
- 在供应商名称旁显示当前图标 + "更换图标"按钮
- 点击按钮弹出上传对话框
- 上传成功后自动保存 `logo_url`

### 5. 上传工具函数

复用 `src/services/model.ts` 中新增的 `uploadIcon(file: File)` 函数，调用 `POST /api/upload/icon`。

### 6. ProviderCard 更新

文件：`src/components/Form/modelForm/components/providerCard.tsx` 和 `src/components/Form/modelForm/Provider.tsx`

传递 `logoUrl` prop 到 AILogo 组件。

## 文件变更清单

| 文件 | 变更 |
|------|------|
| `backend/app/db/models/providers.py` | 新增 `logo_url` 字段 |
| `backend/app/routers/provider.py` | 新增图标上传端点 + CRUD 支持 `logo_url` |
| `backend/app/services/provider.py` | 序列化包含 `logo_url` |
| `backend/app/db/provider_dao.py` | DAO 支持 `logo_url` |
| `videoNote_frontend/src/types/api.ts` | Provider 新增 `logoUrl` |
| `videoNote_frontend/src/components/Form/modelForm/Icons/index.tsx` | AILogo 支持 `logoUrl` |
| `videoNote_frontend/src/store/providerStore/index.ts` | 映射 `logo_url` |
| `videoNote_frontend/src/components/Form/modelForm/Form.tsx` | 上传 UI |
| `videoNote_frontend/src/components/Form/modelForm/components/providerCard.tsx` | 传递 `logoUrl` |
| `videoNote_frontend/src/components/Form/modelForm/Provider.tsx` | 传递 `logoUrl` |
| `videoNote_frontend/src/services/model.ts` | 新增 `uploadIcon` 函数 |

## 验证方式

1. 启动前后端服务
2. 新建自定义供应商 → 上传图标 → 确认圆形裁剪预览 → 保存后列表和编辑页都显示自定义图标
3. 编辑已有供应商 → 更换图标 → 确认更新成功
4. 预设供应商不受影响，仍显示 `@lobehub/icons` 图标
5. 上传超 2MB 文件 → 提示错误
6. 上传非图片文件 → 提示错误
