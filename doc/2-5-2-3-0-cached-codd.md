# videoNote v2.5.2 后端 API 接口文档

## 文档概述

本文档为 videoNote v2.5.2 版本后端 API 接口完整文档，用于新版本 3.0 对接参考。

---

## 基础信息

### 服务地址
- 默认端口: `8483`
- 基础 URL: `http://127.0.0.1:8483`

### 认证方式
- JWT Token 认证
- Header: `Authorization: Bearer <token>`
- 部分接口需要管理员权限 (`require_admin`)

### 统一响应格式
```json
{
  "code": 0,          // 0 表示成功，非 0 表示失败
  "msg": "操作成功",   // 消息
  "data": {}          // 响应数据
}
```

---

## API 模块清单

| 模块 | 路径前缀 | 说明 |
|------|---------|------|
| 健康检查 | `/api` | 服务状态检查 |
| 用户认证 | `/api/auth` | 登录、用户管理 |
| 笔记生成 | `/api` | 核心：视频笔记生成 |
| 供应商管理 | `/api` | AI 供应商配置 |
| 模型管理 | `/api` | AI 模型配置 |
| 配置管理 | `/api` | 下载器 Cookie、系统检查 |
| 导出服务 | `/api/export` | PDF/图文导出 |
| 思源笔记 | `/api/siyuan` | 思源笔记集成 |
| WebDAV 备份 | `/api/webdav` | 云端备份恢复 |
| 配置备份 | `/api/configs` | 配置导出导入 |

---

## 1. 健康检查 (`/api`)

### GET `/api/health`
健康检查接口，无需认证。

**响应示例:**
```json
{
  "code": 0,
  "msg": "success",
  "data": {"status": "ok"}
}
```

---

## 2. 用户认证 (`/api/auth`)

### POST `/api/auth/login`
用户登录，无需认证。

**请求参数:**
```json
{
  "username": "string",
  "password": "string"
}
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin"
    }
  }
}
```

### GET `/api/auth/me`
获取当前用户信息，需要认证。

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### GET `/api/auth/users`
获取所有用户列表，需要管理员权限。

### POST `/api/auth/users`
创建用户，需要管理员权限。

**请求参数:**
```json
{
  "username": "string",
  "password": "string",
  "role": "user"  // 可选，默认 user
}
```

### PUT `/api/auth/users/{user_id}`
更新用户信息，需要管理员权限。

### DELETE `/api/auth/users/{user_id}`
删除用户，需要管理员权限。

### PUT `/api/auth/change-password`
修改密码，需要认证。

**请求参数:**
```json
{
  "old_password": "string",
  "new_password": "string"
}
```

---

## 3. 笔记生成 (`/api`)

### POST `/api/generate_note`
提交视频笔记生成任务，需要认证。

**请求参数:**
```json
{
  "video_url": "string",           // 视频 URL 或本地路径
  "platform": "string",            // 平台标识: bilibili/douyin/kuaishou/youtube/local
  "quality": "string",             // 下载质量: high/medium/low
  "model_name": "string",          // AI 模型名称
  "provider_id": "string",         // 供应商 ID
  "screenshot": false,             // 是否截图，可选
  "link": false,                   // 是否添加链接，可选
  "task_id": "string",             // 重试时复用任务 ID，可选
  "format": [],                    // 格式化选项，可选
  "style": "string",               // 笔记风格，可选
  "extras": "string",              // 额外参数，可选
  "video_understanding": false,    // 视频理解模式，可选
  "video_interval": 0,             // 视频截图间隔秒数，可选
  "grid_size": []                  // 截图网格尺寸，可选
}
```

**响应示例:**
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "task_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### GET `/api/task_status/{task_id}`
查询任务状态，需要认证。

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "status": "SUCCESS",           // PENDING/RUNNING/SUCCESS/FAILED
    "message": "笔记生成完成",
    "task_id": "xxx",
    "result": {
      "markdown": "笔记内容...",
      "transcript": {},
      "audio_meta": {},
      "model_name": "gpt-4",
      "style": "detailed",
      "versions": []
    }
  }
}
```

### GET `/api/tasks`
获取历史任务列表，需要认证。

**请求参数:**
- `limit`: 返回数量限制，默认 100

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "tasks": [
      {
        "task_id": "xxx",
        "video_id": "BV1xx",
        "platform": "bilibili",
        "video_url": "https://...",
        "created_at": "2024-01-01T00:00:00",
        "status": "SUCCESS",
        "message": "",
        "note": {}
      }
    ]
  }
}
```

### POST `/api/delete_task`
删除任务，需要认证。

**请求参数:**
```json
{
  "task_id": "string",      // 优先使用
  "video_id": "string",     // 兼容旧逻辑
  "platform": "string"      // 兼容旧逻辑
}
```

### POST `/api/upload`
上传本地文件（视频/音频），需要认证。

**请求参数:**
- Content-Type: `multipart/form-data`
- file: 文件对象

**限制:**
- 最大文件大小: 100MB
- 支持格式: 图片/视频/音频常见格式

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "url": "/uploads/xxx.mp4"
  }
}
```

### GET `/api/image_proxy`
图片代理接口，用于获取平台封面图。

**请求参数:**
- `url`: 图片 URL

### GET `/api/task_queue/status`
获取任务队列状态，需要认证。

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "running_count": 1,
    "queued_count": 0,
    "max_concurrent": 2,
    "running_tasks": ["task_id_1"],
    "queued_tasks": []
  }
}
```

### POST `/api/task_queue/config`
更新队列配置，需要认证。

**请求参数:**
```json
{
  "max_concurrent": 2  // 1-10 之间
}
```

### GET `/api/cache/stats`
获取缓存统计，需要认证。

### POST `/api/cache/clean`
手动清理缓存，需要认证。

**请求参数:**
- `dry_run`: 是否模拟运行，默认 false
- `ttl_days`: 自定义 TTL 天数

---

## 4. 供应商管理 (`/api`)

### POST `/api/add_provider`
添加供应商，需要管理员权限。

**请求参数:**
```json
{
  "name": "string",          // 供应商名称
  "api_key": "string",       // API 密钥
  "base_url": "string",      // API 地址
  "logo": "string",          // Logo 标识，可选
  "logo_url": "string",      // Logo URL，可选
  "type": "string"           // 类型: built-in/custom/newapi
}
```

### GET `/api/get_all_providers`
获取所有供应商，需要管理员权限。

**响应示例:**
```json
{
  "code": 0,
  "data": [
    {
      "id": "xxx",
      "name": "OpenAI",
      "base_url": "https://api.openai.com",
      "logo": "openai",
      "type": "built-in",
      "enabled": 1
    }
  ]
}
```

### GET `/api/get_provider_by_id/{id}`
获取单个供应商详情，需要管理员权限。

### POST `/api/update_provider`
更新供应商，需要管理员权限。

**请求参数:**
```json
{
  "id": "string",
  "name": "string",          // 可选
  "api_key": "string",       // 可选
  "base_url": "string",      // 可选
  "logo": "string",          // 可选
  "logo_url": "string",      // 可选
  "type": "string",          // 可选
  "enabled": 1               // 可选，0/1
}
```

### DELETE `/api/delete_provider/{id}`
删除供应商，需要管理员权限。

### POST `/api/connect_test`
测试供应商连接，需要管理员权限。

**请求参数:**
```json
{
  "id": "string"
}
```

### POST `/api/upload_icon`
上传供应商图标，需要管理员权限。

**请求参数:**
- Content-Type: `multipart/form-data`
- file: 图片文件 (jpg/png/webp/svg，最大 2MB)

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "url": "/uploads/icons/xxx.png"
  }
}
```

---

## 5. 模型管理 (`/api`)

### GET `/api/model_list`
获取所有模型列表，需要认证。

### GET `/api/model_list/{provider_id}`
获取指定供应商的模型列表，需要认证。

### POST `/api/models`
添加模型，需要认证。

**请求参数:**
```json
{
  "provider_id": "string",
  "model_name": "string"
}
```

### GET `/api/models/delete/{model_id}`
删除模型，需要认证。

### GET `/api/model_enable/{provider_id}`
获取供应商已启用的模型，需要认证。

---

## 6. 配置管理 (`/api`)

### GET `/api/get_downloader_cookie/{platform}`
获取下载器 Cookie，需要认证。

**平台标识:** bilibili/douyin/kuaishou/youtube

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "platform": "bilibili",
    "cookie": "xxx"
  }
}
```

### POST `/api/update_downloader_cookie`
更新下载器 Cookie，需要认证。

**请求参数:**
```json
{
  "platform": "string",
  "cookie": "string"
}
```

### GET `/api/sys_health`
系统健康检查（检查 ffmpeg），需要认证。

### GET `/api/sys_check`
系统检查，需要认证。

---

## 7. 导出服务 (`/api/export`)

### GET `/api/export/pdf/{task_id}`
导出笔记为 PDF，需要认证。

**请求参数:**
- `style`: PDF 样式 (default/simple/print/academic)

**响应:**
- Content-Type: `application/pdf`
- 文件下载

### GET `/api/export/styles`
获取 PDF 样式列表，需要认证。

**响应示例:**
```json
{
  "styles": [
    {"id": "default", "name": "默认样式", "description": "..."},
    {"id": "simple", "name": "简洁样式", "description": "..."},
    {"id": "print", "name": "打印样式", "description": "..."},
    {"id": "academic", "name": "学术样式", "description": "..."}
  ]
}
```

### POST `/api/export/batch`
批量导出 PDF，需要认证。

**请求参数:**
- Body: `{"task_ids": ["id1", "id2"]}`
- Query: `style` 样式参数

**响应:**
- ZIP 文件下载

### GET `/api/export/history`
获取导出历史，需要认证。

### GET `/api/export/history/{task_id}`
获取指定任务的导出历史，需要认证。

### GET `/api/export/redownload/{task_id}`
重新下载缓存的 PDF，需要认证。

### GET `/api/export/image/templates`
获取图文模板列表，需要认证。

**响应示例:**
```json
{
  "templates": [
    {"id": "xiaohongshu", "name": "小红书风格"},
    {"id": "simple", "name": "简洁风格"},
    {"id": "academic", "name": "学术风格"}
  ]
}
```

### GET `/api/export/image/{task_id}`
导出笔记为图文，需要认证。

**请求参数:**
- `template`: 模板类型 (xiaohongshu/simple/academic)
- `width`: 图片宽度 (400-1920)，默认 1080
- `format`: 图片格式 (png/jpg/jpeg)

**响应:**
- 单张图片或 ZIP 包（多张图片）

---

## 8. 思源笔记 (`/api/siyuan`)

### GET `/api/siyuan/config`
获取思源笔记配置，需要认证。

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "api_url": "http://127.0.0.1:6806",
    "api_token": "********",  // 脱敏
    "default_notebook": "笔记本ID",
    "enabled": 1,
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### POST `/api/siyuan/config`
保存思源笔记配置，需要认证。

**请求参数:**
```json
{
  "api_url": "http://127.0.0.1:6806",
  "api_token": "string",
  "default_notebook": "string"  // 可选
}
```

### PUT `/api/siyuan/config`
更新思源笔记配置，需要认证。

### GET `/api/siyuan/notebooks`
获取笔记本列表，需要认证。

### POST `/api/siyuan/test`
测试思源笔记连接，需要认证。

**请求参数:**
```json
{
  "api_url": "http://127.0.0.1:6806",
  "api_token": "string"
}
```

### POST `/api/siyuan/export/siyuan/{task_id}
导出笔记到思源笔记，需要认证。

**请求参数:**
- `title`: 标题，可选

### GET `/api/siyuan/history`
获取思源笔记导出历史，需要认证。

### GET `/api/siyuan/history/{task_id}`
获取指定任务的思源导出历史，需要认证。

---

## 9. WebDAV 备份 (`/api/webdav`)

### GET `/api/webdav/config`
获取 WebDAV 配置，需要认证。

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "configured": true,
    "id": 1,
    "url": "https://webdav.example.com",
    "username": "user",
    "password": "********",  // 脱敏
    "path": "/backup",
    "auto_backup_enabled": false,
    "auto_backup_schedule": "0 2 * * *",
    "last_backup_at": "..."
  }
}
```

### POST `/api/webdav/config`
保存 WebDAV 配置，需要认证。

**请求参数:**
```json
{
  "url": "string",
  "username": "string",
  "password": "string",
  "path": "/",            // 可选，默认 "/"
  "auto_backup_enabled": 0, // 可选，0/1
  "auto_backup_schedule": "0 2 * * *"  // cron 表达式
}
```

### PUT `/api/webdav/config`
更新 WebDAV 配置，需要认证。

### DELETE `/api/webdav/config`
删除 WebDAV 配置，需要认证。

### POST `/api/webdav/test`
测试 WebDAV 连接，需要认证。

**请求参数:**
```json
{
  "url": "string",
  "username": "string",
  "password": "string"
}
```

### POST `/api/webdav/backup`
手动触发备份，需要认证。

**请求参数:**
- `backup_type`: 备份类型 (manual/auto)，默认 manual

### GET `/api/webdav/backup/status`
获取备份状态，需要认证。

### GET `/api/webdav/backups`
获取备份列表，需要认证。

### DELETE `/api/webdav/backups/{backup_name}
删除备份文件，需要认证。

### POST `/api/webdav/restore/{backup_name}
从备份恢复，需要认证。

### POST `/api/webdav/restore/upload`
从上传文件恢复，需要认证。

**请求参数:**
- Content-Type: `multipart/form-data`
- file: .zip 备份文件

### POST `/api/webdav/schedule/enable`
启用自动备份，需要认证。

**请求参数:**
```json
{
  "auto_backup_enabled": 1,
  "auto_backup_schedule": "0 2 * * *"
}
```

### PUT `/api/webdav/schedule`
更新备份计划，需要认证。

### DELETE `/api/webdav/schedule`
禁用自动备份，需要认证。

### GET `/api/webdav/schedule`
获取备份计划，需要认证。

### GET `/api/webdav/history`
获取备份历史，需要认证。

**请求参数:**
- `limit`: 数量限制，默认 50

### GET `/api/webdav/stats`
获取备份统计，需要认证。

### DELETE `/api/webdav/history/{history_id}`
删除单条备份历史，需要认证。

### DELETE `/api/webdav/history`
删除所有备份历史，需要认证。

---

## 10. 配置备份 (`/api/configs`)

### GET `/api/configs/export`
导出所有配置为 JSON，需要管理员权限。

**响应示例:**
```json
{
  "code": 0,
  "data": {
    "providers": [...],
    "models": [...],
    "downloaders": [...],
    "siyuan": {...},
    "webdav": {...}
  }
}
```

### GET `/api/configs/export/file`
导出配置为文件下载，需要管理员权限。

**响应:**
- 文件名: `videonote_configs.json`

### POST `/api/configs/import/preview`
预览导入配置文件，需要管理员权限。

**请求参数:**
- Content-Type: `multipart/form-data`
- file: JSON 配置文件

### POST `/api/configs/import/preview/json`
预览导入配置（JSON 数据），需要管理员权限。

**请求参数:**
```json
{
  "config_data": {...}
}
```

### POST `/api/configs/import/execute`
执行配置导入，需要管理员权限。

**请求参数:**
```json
{
  "config_data": {...},
  "selected_items": ["providers", "models"],
  "credentials": {
    "providers": {
      "provider_id": {"api_key": "xxx"}
    }
  }
}
```

---

## 附录

### 任务状态枚举
```python
PENDING = "PENDING"      # 排队中
RUNNING = "RUNNING"      # 执行中
SUCCESS = "SUCCESS"      # 成功
FAILED = "FAILED"        # 失败
```

### 平台标识
```python
"bilibili"    # B站
"douyin"      # 抖音
"kuaishou"    # 快手
"youtube"     # YouTube
"local"       # 本地文件
```

### 下载质量
```python
"high"        # 高质量
"medium"      # 中等质量
"low"         # 低质量
```

### 供应商类型
```python
"built-in"    # 内置供应商（OpenAI/DeepSeek/Qwen等）
"custom"      # 自定义供应商
"newapi"      # NewAPI 中转服务
```

---

## 前端对接注意事项

1. **认证流程**：先调用 `/api/auth/login` 获取 token，后续请求携带 Authorization header

2. **任务轮询**：建议每 3 秒轮询 `/api/task_status/{task_id}`，直到状态变为 SUCCESS 或 FAILED

3. **供应商初始化**：`providerStore` 没有 persist，需要在 useEffect 中调用 `fetchProviderList()`

4. **响应处理**：判断 `code === 0` 表示成功，非 0 时通过 `msg` 获取错误信息

5. **文件下载**：PDF/图片导出接口直接返回文件流，需要处理 Content-Disposition header

---

## 文件位置参考

- 路由定义: `backend/app/routers/*.py`
- 主入口: `backend/main.py`
- 应用创建: `backend/app/__init__.py`
- 服务层: `backend/app/services/*.py`
- 数据访问: `backend/app/db/*_dao.py`
- 工具函数: `backend/app/utils/*.py`