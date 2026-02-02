# 思源笔记导出功能设计

## 架构概览

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │     │    Backend      │     │  思源笔记 API    │
│                 │     │                 │     │                 │
│ MarkdownHeader  │────▶│ /api/export/    │────▶│ /api/filetree/  │
│ ExportButton    │     │   siyuan        │     │   createDocWithMd│
│ SiyuanSettings  │     │                 │────▶│ /api/notebook/  │
│                 │     │                 │     │   lsNotebooks   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   SQLite DB     │
                        │ siyuan_configs  │
                        │ export_history  │
                        └─────────────────┘
```

## 数据模型

### siyuan_configs 表

```sql
CREATE TABLE siyuan_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    api_url TEXT NOT NULL,          -- 思源笔记 API 地址
    api_token TEXT NOT NULL,        -- 思源笔记 API Token（明文存储，与现有 provider 一致）
    default_notebook TEXT,          -- 默认笔记本 ID（通过 API 获取笔记本列表后选择）
    enabled INTEGER DEFAULT 1,      -- 是否启用
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### siyuan_export_history 表

```sql
CREATE TABLE siyuan_export_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,          -- BiliNote 任务 ID
    siyuan_doc_id TEXT,             -- 思源笔记文档 ID
    notebook_id TEXT,               -- 导出的笔记本 ID
    notebook_name TEXT,             -- 导出的笔记本名称
    doc_path TEXT,                  -- 导出的文档路径
    status TEXT NOT NULL,           -- 导出状态：success/failed
    error_message TEXT,             -- 错误信息（失败时）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API 设计

### 后端 API

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/siyuan/config` | GET | 获取思源笔记配置 |
| `/api/siyuan/config` | POST | 保存思源笔记配置 |
| `/api/siyuan/config` | PUT | 更新思源笔记配置 |
| `/api/siyuan/notebooks` | GET | 获取思源笔记本列表 |
| `/api/siyuan/test` | POST | 测试思源笔记连接 |
| `/api/export/siyuan/{task_id}` | POST | 导出笔记到思源笔记 |
| `/api/export/siyuan/history` | GET | 获取导出历史 |
| `/api/export/siyuan/history/{task_id}` | GET | 获取指定任务的导出历史 |

### 思源笔记官方 API（基于官方文档）

```python
# 获取笔记本列表
GET /api/notebook/lsNotebooks
Headers: { "Authorization": "Token <api_token>" }

# 创建文档（带 Markdown）
POST /api/filetree/createDocWithMd
Headers: {
    "Authorization": "Token <api_token>",
    "Content-Type": "application/json"
}
Body: {
    "notebook": "<notebook_id>",     # 笔记本 ID
    "path": "/BiliNote/视频标题",    # 文档路径（含 .md 扩展名）
    "markdown": "# 笔记内容"         # Markdown 内容
}

# 统一返回格式
{
    "code": 0,                        # 0 表示成功
    "msg": "",
    "data": {
        # 响应数据
    }
}
```

## 导出流程

```
用户点击导出
    │
    ▼
前端检查配置状态
    │
    ├── 未配置 → 提示用户先配置
    │
    ▼
调用后端导出 API
    │
    ▼
后端读取笔记内容
    │
    ├── 文件不存在 → 返回 404
    │
    ▼
获取思源笔记配置
    │
    ├── 配置不存在 → 返回 400
    │
    ▼
测试思源笔记连接
    │
    ├── 连接失败 → 返回错误
    │
    ▼
构造思源笔记 API 请求
    │
    ▼
调用思源笔记 API 创建文档
    │
    ├── 成功 → 返回文档 ID
    │
    └── 失败 → 返回错误详情
```

## Markdown 格式转换

BiliNote 生成的 Markdown 可能需要适配思源笔记格式：

| 特性 | BiliNote | 思源笔记 | 处理方式 |
|------|----------|----------|----------|
| 标题 | `# H1` | `# H1` | 直接兼容 |
| 代码块 | ` ``` ` | ` ``` ` | 直接兼容 |
| 链接 | `[text](url)` | `[text](url)` | 直接兼容 |
| 图片 | `![alt](url)` | `![alt](url)` | 直接兼容 |
| 内部锚点 | `[text](#id)` | 需要处理 | 移除或替换 |

## 错误处理（基于官方 API 返回格式）

思源笔记 API 统一返回格式：`{code: 0, msg: "", data: {}}`

| 错误场景 | code | 用户提示 |
|----------|------|----------|
| 配置不存在 | - | 请先在设置中配置思源笔记 |
| 无法连接到思源笔记 | - | 无法连接到思源笔记，请检查 API 地址 |
| Token 无效 | 非 0 | 思源笔记 Token 无效，请检查配置 |
| 笔记本不存在 | 非 0 | 指定的笔记本不存在 |
| 文档路径冲突 | 非 0 | 目标路径已存在，请修改路径配置 |
| 导出失败 | 非 0 | 导出失败：{msg} |

**错误处理逻辑**：
```python
response = requests.post(url, headers=headers, json=data)
result = response.json()
if result.get("code") != 0:
    raise Exception(result.get("msg", "未知错误"))
```

## 安全考虑

1. **Token 明文存储**：思源笔记 Token 明文存储（与现有 provider API Key 处理方式一致）
2. **HTTPS**：思源笔记 API URL 应优先使用 HTTPS
3. **输入验证**：验证 API URL 格式，防止 SSRF 攻击
4. **错误脱敏**：返回错误时不暴露敏感信息（如 Token）
5. **Token 隐藏**：前端显示配置时隐藏 Token 内容

## 配置验证

导出前进行配置验证：
1. API URL 格式正确（以 `http://` 或 `https://` 开头）
2. API Token 非空
3. 可选：测试连接验证配置有效性

## 用户体验

1. **首次使用引导**：首次点击导出时提示用户配置
2. **配置测试**：保存配置时提供"测试连接"按钮
3. **导出反馈**：导出过程显示加载状态，完成后显示成功/失败提示
4. **快速配置**：提供设置页快捷入口
