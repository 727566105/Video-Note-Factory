# NewAPI 快捷接入功能设计

## 背景

用户希望在 `/settings/model/new` 页面新增 NewAPI 供应商接入方式，让用户通过填写 base_url + API Key 即可一键完成自建 API 中转服务的配置，无需手动填写名称、上传图标、逐一添加模型。

## UI 交互流程

### 第一步：供应商选择页

在现有预设卡片网格中，"自定义"按钮之前新增 **NewAPI** 卡片：
- 图标：使用 Lucide 的 `Server` 图标（圆形灰色背景）
- 标签：`NewAPI`
- 点击后进入 NewAPI 专用配置页

### 第二步：NewAPI 配置页

简化表单，只显示 3 个字段：
- **名称**（可选，默认值 `NewAPI`）
- **API 地址**（必填，placeholder: `https://your-api.com/v1`）
- **API Key**（必填，带密码显隐切换）

底部按钮：**"一键接入"**

页头显示：NewAPI 图标 + 标题 "接入 NewAPI"
提示文案："输入 API 地址和 Key，一键完成配置"

### 第三步：一键接入流程

1. 调用 `/add_provider` 创建供应商（name + base_url + api_key + logo='NewAPI' + type='newapi'）
2. 自动调用 `/connect_test` 测试连通性
3. 连通成功后，调用 `/model_list/{provider_id}` 获取可用模型列表
4. 将所有可用模型批量添加到该供应商下
5. 显示结果：成功接入 X 个模型
6. 自动跳转到供应商编辑页

## 技术实现

### 前端改动

**文件：`videoNote_frontend/src/components/Form/modelForm/Form.tsx`**

1. 新增状态变量 `isNewApi` 区分 NewAPI 流程
2. 在供应商选择网格中新增 NewAPI 卡片
3. 新增 NewAPI 简化表单分支（名称 + API 地址 + API Key + 一键接入按钮）
4. 新增 `handleNewApiConnect()` 方法：
   - 调用 `addNewProviderWithModels(payload, [])` 创建供应商
   - 调用 `testConnection()` 测试连通性
   - 连通成功后调用 `fetchModels()` 获取模型列表
   - 批量添加模型
   - 导航到编辑页

### 后端改动

无需改动。现有 API 已完全支持：
- `POST /add_provider` — 创建供应商
- `POST /connect_test` — 测试连通性
- `GET /model_list/{provider_id}` — 获取模型列表
- `POST /models` — 添加模型

### 数据模型

- 供应商 `type` 字段新增值 `newapi`
- `logo` 字段使用 `NewAPI`（复用 `@lobehub/icons` 中的图标，无匹配时使用 Lucide `Server` 图标）

## 视觉设计

- NewAPI 卡片：圆形灰色背景 + Lucide `Server` 图标
- 配置页头部：图标 + "接入 NewAPI" 标题 + 提示文案
- 一键接入按钮：主按钮样式，带 loading 状态
- 接入结果：成功提示 + 模型数量统计

## 验证方式

1. 打开 `/settings/model/new`，确认 NewAPI 卡片显示正确
2. 点击 NewAPI 卡片，确认简化表单显示正确
3. 填写 base_url 和 API Key，点击一键接入
4. 确认自动完成：创建供应商 → 测试连通 → 获取模型 → 批量添加
5. 确认自动跳转到编辑页，模型列表显示正确
