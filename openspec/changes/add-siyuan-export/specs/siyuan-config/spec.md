# 思源笔记配置管理规范

## ADDED Requirements

### REQ-SIYUAN-001: 思源笔记配置存储

系统应提供思源笔记配置的持久化存储能力。

#### Scenario: 保存思源笔记配置

**Given** 用户在设置页面填写思源笔记配置信息
**When** 用户点击保存按钮
**Then** 系统应验证配置格式并保存到数据库
**And** 返回保存成功的响应

**验证**:
- 配置包含 API URL、API Token、默认笔记本 ID
- API URL 必须是有效的 HTTP/HTTPS 地址
- API Token 不能为空

#### Scenario: 获取思源笔记配置

**Given** 系统中已存在思源笔记配置
**When** 用户访问设置页面或准备导出笔记
**Then** 系统应返回当前配置信息

**验证**:
- 返回配置包含 API URL（Token 部分脱敏）
- 如果配置不存在，返回 null 或空对象

### REQ-SIYUAN-002: 配置验证

系统应提供验证思源笔记配置有效性的能力。

#### Scenario: 测试思源笔记连接

**Given** 用户已填写思源笔记配置
**When** 用户点击"测试连接"按钮
**Then** 系统应调用思源笔记 API 验证连接
**And** 根据官方 API 返回格式判断连接状态

**验证**:
- API 返回 `code: 0` → 连接成功，显示"连接成功"
- API 返回 `code: 非0` → 连接失败，显示 `msg` 中的错误信息

**错误场景**:
- API URL 无法访问 → "无法连接到思源笔记，请检查地址"
- API Token 无效 → 显示 API 返回的 `msg`
- 网络超时 → "连接超时，请检查网络或稍后重试"

### REQ-SIYUAN-003: 配置更新

系统应支持更新现有的思源笔记配置。

#### Scenario: 更新思源笔记配置

**Given** 系统中已存在思源笔记配置
**When** 用户修改配置并点击保存
**Then** 系统应更新数据库中的配置记录
**And** 更新 `updated_at` 时间戳

**验证**:
- 更新后的配置立即生效
- 下次导出时使用新配置

### REQ-SIYUAN-004: 获取笔记本列表

系统应支持从思源笔记 API 获取笔记本列表供用户选择。

#### Scenario: 获取笔记本列表

**Given** 用户已完成思源笔记连接配置
**When** 系统需要加载笔记本选项
**Then** 系统应调用官方 API `GET /api/notebook/lsNotebooks`
**And** 解析返回的笔记本列表

**验证**:
- API 返回 `code: 0` 时，从 `data` 中提取笔记本列表
- 每个笔记本包含 ID 和名称信息
- 前端以下拉列表形式展示供用户选择

### REQ-SIYUAN-005: 配置删除

系统应支持删除思源笔记配置（禁用导出功能）。

#### Scenario: 删除思源笔记配置

**Given** 系统中已存在思源笔记配置
**When** 用户点击删除配置按钮
**Then** 系统应删除配置记录
**And** 导出功能变为不可用状态

**验证**:
- 删除后尝试导出提示"请先配置思源笔记"

---

# 思源笔记 API 调用规范

## ADDED Requirements

### REQ-API-001: API 认证格式

所有思源笔记 API 调用必须使用官方认证格式。

#### Scenario: 请求头格式

**Given** 系统需要调用思源笔记 API
**When** 构造 HTTP 请求
**Then** 请求头必须包含 `Authorization: Token <api_token>`

**验证**:
- Token 格式：从思源笔记设置→关于中获取
- 请求示例：
  ```python
  headers = {
      "Authorization": f"Token {config['api_token']}"
  }
  ```

### REQ-API-002: 响应格式处理

系统必须正确处理思源笔记 API 的统一响应格式。

#### Scenario: 解析 API 响应

**Given** 思源笔记 API 返回响应
**When** 系统解析响应
**Then** 应检查 `code` 字段判断是否成功

**验证**:
- `code === 0` 表示成功，从 `data` 中提取结果
- `code !== 0` 表示失败，使用 `msg` 作为错误信息

**处理逻辑**:
```python
result = response.json()
if result.get("code") != 0:
    raise Exception(result.get("msg", "未知错误"))
data = result.get("data", {})
```

---

# 笔记导出规范

## ADDED Requirements

### REQ-EXPORT-001: 单笔记导出到思源笔记

系统应支持将单个笔记导出到思源笔记。

#### Scenario: 成功导出笔记

**Given** 用户已配置思源笔记连接
**And** 用户正在查看已生成的笔记
**When** 用户点击"导出到思源笔记"按钮
**Then** 系统应读取笔记的 Markdown 内容
**And** 调用思源笔记官方 API `POST /api/filetree/createDocWithMd`
**And** 显示"导出成功"提示

**验证**:
- 笔记内容完整传输到思源笔记
- 使用官方 API `createDocWithMd` 接口
- 创建到用户配置的默认笔记本

#### Scenario: 导出前检查配置

**Given** 用户未配置思源笔记连接
**When** 用户点击"导出到思源笔记"按钮
**Then** 系统应显示"请先在设置中配置思源笔记"提示
**And** 提供跳转到设置页面的按钮

#### Scenario: 处理思源笔记 API 错误

**Given** 用户已配置思源笔记连接
**And** 思源笔记 API 返回 `code: 非0`
**When** 用户点击"导出到思源笔记"按钮
**Then** 系统应显示 API 返回的 `msg` 错误信息
**And** 不删除或修改原始笔记

**错误场景**:
- 认证失败 → 显示 API 返回的 `msg`
- 笔记本不存在 → 显示 API 返回的 `msg`
- 服务器错误 → 显示 API 返回的 `msg`

### REQ-EXPORT-002: Markdown 内容适配

系统应将 BiliNote 生成的 Markdown 适配为思源笔记兼容格式。

#### Scenario: 移除内部锚点链接

**Given** 笔记包含内部锚点链接（如 `[text](#id)`）
**When** 系统准备导出内容
**Then** 系统应移除或替换这些锚点链接
**And** 保留链接文本内容

**验证**:
- `[标题](#section1)` → `标题`
- 或 `[标题](#section1)` → `[标题]`

#### Scenario: 保留基本 Markdown 格式

**Given** 笔记包含标题、列表、代码块、图片等基本格式
**When** 系统导出到思源笔记
**Then** 这些格式应在思源笔记中正确显示

**验证**:
- 标题（`# H1` - `###### H6`）正确显示
- 代码块带语言标记正确高亮
- 图片链接正确加载

### REQ-EXPORT-003: 导出历史记录

系统应记录思源笔记导出历史。

#### Scenario: 记录导出历史

**Given** 用户成功导出笔记到思源笔记
**When** 导出完成（API 返回 `code: 0`）
**Then** 系统应记录导出信息到 `siyuan_export_history` 表
**And** 包含任务 ID、思源笔记文档 ID、笔记本 ID、导出时间

**验证**:
- 可在导出历史中查看之前的导出记录
- 支持按任务 ID 查询导出状态
- 失败的导出也记录错误信息
