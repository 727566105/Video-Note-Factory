# WebDAV 备份功能设计文档

## 系统架构

### 组件关系图

```
┌─────────────────┐     ┌──────────────────┐
│  Frontend (React)│────▶│  Backend API     │
└─────────────────┘     └──────────────────┘
                                │
                                ▼
                        ┌─────────────────────┐
                        │  WebDAV Backup      │
                        │  Service            │
                        └─────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │  WebDAV      │        │  Database    │
            │  Server      │        │  (SQLite)    │
            └──────────────┘        └──────────────┘
```

### 数据流

**备份流程：**
```
用户点击备份按钮
    │
    ▼
前端调用 POST /api/webdav/backup
    │
    ▼
后端验证配置
    │
    ├─▶ 收集备份文件
    │   ├─ note_results/ 目录
    │   └─ database.db
    │
    ├─▶ 创建 ZIP 压缩包
    │
    ├─▶ 上传到 WebDAV
    │   ├─ 使用 webdavclient3
    │   └─ 分块上传（大文件）
    │
    └─▶ 记录备份历史
```

**恢复流程：**
```
用户点击恢复按钮
    │
    ▼
前端调用 POST /api/webdav/restore/{backup_id}
    │
    ├─▶ 从 WebDAV 下载备份文件
    │
    ├─▶ 解压并验证
    │
    ├─▶ 停止服务（防止数据冲突）
    │
    ├─▶ 替换数据库和文件
    │
    ├─▶ 重启服务
    │
    └─▶ 返回恢复结果
```

## 技术选型

### WebDAV 客户端库

**选择：`webdavclient3`**

**理由：**
- Python 原生 WebDAV 客户端库
- 支持基本文件操作（上传、下载、删除、创建目录）
- 活跃维护，文档完善
- 无需系统级依赖

**替代方案：**
- `requests` 手动实现 WebDAV 协议 - 复杂度高
- `pywebdav` - 维护不活跃

### 定时任务框架

**选择：`APScheduler`**

**理由：**
- 功能强大的 Python 定时任务库
- 支持 Cron 风格表达式
- 持久化任务状态
- 友好的 Flask/FastAPI 集成

**配置示例：**
```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(backup_job, 'cron', hour=2, minute=0)  # 每天凌晨2点
```

## 数据库设计

### webdav_configs 表

```sql
CREATE TABLE webdav_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,              -- WebDAV 服务器地址
    username TEXT NOT NULL,         -- 用户名
    password TEXT NOT NULL,         -- 密码（加密存储）
    path TEXT DEFAULT '/',          -- 备份路径
    auto_backup_enabled INTEGER DEFAULT 0,  -- 是否启用自动备份
    auto_backup_schedule TEXT DEFAULT '0 2 * * *',  -- Cron表达式
    last_backup_at DATETIME,        -- 最后备份时间
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### backup_history 表

```sql
CREATE TABLE backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,             -- manual / auto
    status TEXT NOT NULL,           -- success / failed
    file_size INTEGER,              -- 备份文件大小（字节）
    file_count INTEGER,             -- 备份文件数量
    error_message TEXT,             -- 错误信息
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API 设计

### 配置管理

```
GET    /api/webdav/config        # 获取配置
POST   /api/webdav/config        # 保存配置
PUT    /api/webdav/config        # 更新配置
DELETE /api/webdav/config        # 删除配置
```

### 备份操作

```
POST   /api/webdav/backup        # 手动触发备份
GET    /api/webdav/backup/status # 获取备份状态
```

### 恢复操作

```
POST   /api/webdav/restore/{backup_id}  # 从备份恢复
GET    /api/webdav/backups             # 获取备份列表
```

### 自动备份

```
POST   /api/webdav/schedule/enable   # 启用自动备份
PUT    /api/webdav/schedule           # 更新备份计划
DELETE /api/webdav/schedule           # 禁用自动备份
```

## 安全考虑

### 密码加密

**方案：使用 `cryptography` Fernet 对称加密**

```python
from cryptography.fernet import Fernet

# 加密
key = Fernet.generate_key()
cipher = Fernet(key)
encrypted_password = cipher.encrypt(password.encode())

# 解密
decrypted_password = cipher.decrypt(encrypted_password).decode()
```

**密钥管理：**
- 加密密钥存储在环境变量 `WEBDAV_ENCRYPTION_KEY`
- 首次部署时生成，之后不可更改

### 连接测试

在保存配置前先测试 WebDAV 连接：
1. 尝试连接 WebDAV 服务器
2. 验证凭据是否正确
3. 检查目标路径是否可写

## 错误处理

### WebDAV 连接失败

```python
try:
    client = Client(webdav_url, username=username, password=password)
    client.check()
except Exception as e:
    return {"success": False, "message": f"WebDAV 连接失败: {str(e)}"}
```

### 备份失败处理

1. 记录详细错误日志
2. 更新备份历史状态为 `failed`
3. 返回用户友好的错误信息
4. 如果是自动备份，发送通知（可选）

### 恢复安全机制

1. 恢复前自动创建当前状态备份
2. 验证备份文件完整性
3. 恢复失败时回滚到备份前状态

## 性能优化

### 大文件处理

对于大型备份（>100MB）：
- 使用分块上传
- 显示上传进度
- 支持断点续传（可选）

### 并发控制

- 同一时间只能执行一个备份/恢复操作
- 使用锁机制防止并发冲突

```python
from threading import Lock

backup_lock = Lock()

def backup():
    with backup_lock:
        # 执行备份操作
        pass
```

## 扩展性考虑

### 未来可能的扩展

1. **多备份点**：保留多个历史版本
2. **增量备份**：只备份变更的文件
3. **压缩备份**：使用 gzip 压缩减少存储空间
4. **备份验证**：备份后自动验证文件完整性
5. **多云备份**：同时备份到多个 WebDAV 服务器

### 配置扩展性

配置表设计预留字段：
- `compression_enabled` - 是否启用压缩
- `retention_days` - 备份保留天数
- `notification_enabled` - 是否启用备份通知
