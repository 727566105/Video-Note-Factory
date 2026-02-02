# backup-config Specification

## ADDED Requirements

### Requirement: WebDAV 配置管理

系统 SHALL 提供 WebDAV 配置管理功能，用户可以保存和更新 WebDAV 服务器连接信息，包括地址、凭据和备份路径。

#### Scenario: 保存 WebDAV 配置

**Given** 用户在设置页面
**And** 用户填写了完整的 WebDAV 配置信息
**When** 用户点击保存按钮
**Then** 系统验证配置格式
**And** 系统加密存储密码
**And** 系统返回成功响应
**And** 配置信息被持久化到数据库

#### Scenario: 配置验证失败

**Given** 用户填写了无效的 WebDAV URL
**When** 用户点击保存按钮
**Then** 系统返回验证错误
**And** 提示"请输入有效的 WebDAV 地址"

#### Scenario: 获取配置时密码脱敏

**Given** 已保存 WebDAV 配置
**When** 前端请求配置信息
**Then** 系统返回配置信息
**And** 密码字段显示为脱敏格式（前 8 位 + `...`）
**And** 完整密码仅在内存中解密使用

#### Scenario: 更新配置

**Given** 已存在 WebDAV 配置
**And** 用户修改了 WebDAV 地址
**When** 用户保存更改
**Then** 系统更新配置记录
**And** 更新 `updated_at` 时间戳
**And** 返回成功响应

#### Scenario: 删除配置

**Given** 已存在 WebDAV 配置
**When** 用户点击删除按钮
**Then** 系统删除配置记录
**And** 系统停止所有自动备份任务
**And** 返回成功响应

---

### Requirement: WebDAV 连接测试

系统 SHALL 提供 WebDAV 连接测试功能，在保存配置前验证 WebDAV 服务器可达性和凭据正确性。

#### Scenario: 连接测试成功

**Given** 用户填写了 WebDAV 配置信息
**When** 用户点击测试连接按钮
**Then** 系统尝试连接 WebDAV 服务器
**And** 系统验证凭据是否正确
**And** 系统检查目标路径是否可写
**And** 返回成功消息"连接成功，可以正常使用"

#### Scenario: 连接失败

**Given** 用户填写了错误的密码
**When** 用户点击测试连接按钮
**Then** 系统返回失败消息
**And** 消息中包含具体错误原因（认证失败、网络不可达等）

#### Scenario: 路径不可写

**Given** 用户配置的 WebDAV 路径不可写
**When** 用户点击测试连接按钮
**Then** 系统返回失败消息"目标路径无写入权限"

#### Scenario: 测试连接超时

**Given** WebDAV 服务器无响应
**When** 用户点击测试连接按钮
**And** 10 秒内无响应
**Then** 系统返回超时错误
**And** 提示"连接超时，请检查服务器地址"

---

### Requirement: 配置状态查询

系统 SHALL 提供配置状态查询接口，返回当前是否已配置 WebDAV 以及自动备份是否启用。

#### Scenario: 未配置状态

**Given** 系统未保存任何 WebDAV 配置
**When** 前端查询配置状态
**Then** 返回 `configured: false`
**And** 返回 `auto_backup_enabled: false`

#### Scenario: 已配置但未启用自动备份

**Given** 系统已保存 WebDAV 配置
**And** 用户未启用自动备份
**When** 前端查询配置状态
**Then** 返回 `configured: true`
**And** 返回 `auto_backup_enabled: false`
**And** 返回上次备份时间或 null

#### Scenario: 已启用自动备份

**Given** 系统已保存 WebDAV 配置
**And** 用户已启用自动备份
**When** 前端查询配置状态
**Then** 返回 `configured: true`
**And** 返回 `auto_backup_enabled: true`
**And** 返回备份计划（Cron 表达式）

---

### Requirement: 密码安全存储

系统 MUST 使用对称加密算法存储 WebDAV 密码，加密密钥从环境变量读取，确保密码不以明文形式存储在数据库或日志中。

#### Scenario: 密码加密存储

**Given** 用户提交 WebDAV 配置
**And** 配置包含明文密码
**When** 系统保存配置
**Then** 密码使用 Fernet 加密
**And** 数据库中存储加密后的密码
**And** 明文密码不被记录到日志

#### Scenario: 密码解密使用

**Given** 数据库中存储了加密密码
**When** 系统需要连接 WebDAV
**Then** 系统从数据库读取加密密码
**And** 系统使用密钥解密密码
**And** 系统在内存中使用明文密码建立连接
**And** 连接关闭后清除内存中的明文密码

#### Scenario: 密钥缺失

**Given** 系统启动
**And** 环境变量 `WEBDAV_ENCRYPTION_KEY` 未设置
**When** 系统需要加密或解密密码
**Then** 系统返回错误
**And** 记录错误日志
**And** 返回 500 状态码给前端

---

### Requirement: 自动备份配置

系统 SHALL 支持配置自动备份计划，用户可以启用/禁用自动备份，并设置备份执行时间（使用 Cron 表达式格式）。

#### Scenario: 启用自动备份

**Given** 用户已配置 WebDAV
**And** 用户未启用自动备份
**When** 用户启用自动备份并设置为每天凌晨 2 点
**Then** 系统保存自动备份配置
**And** 系统注册定时任务到调度器
**And** 系统返回成功响应

#### Scenario: 禁用自动备份

**Given** 用户已启用自动备份
**When** 用户禁用自动备份
**Then** 系统从调度器移除定时任务
**And** 系统更新配置
**And** 系统返回成功响应

#### Scenario: 更新备份计划

**Given** 用户已启用每日备份
**When** 用户改为每周备份
**Then** 系统更新 Cron 表达式
**Then** 系统重新注册定时任务
**And** 系统返回成功响应

#### Scenario: 无效的 Cron 表达式

**Given** 用户输入了无效的 Cron 表达式
**When** 用户保存配置
**Then** 系统返回验证错误
**And** 提示"Cron 表达式格式错误"

#### Scenario: 自动备份执行

**Given** 用户已启用每日凌晨 2 点自动备份
**When** 系统时间到达凌晨 2 点
**Then** 系统自动执行备份任务
**And** 系统记录备份历史
**And** 系统更新最后备份时间

---

### Requirement: 备份历史记录

系统 SHALL 记录每次备份操作的详细信息，包括备份类型（手动/自动）、状态、文件大小、文件数量和错误信息。

#### Scenario: 记录手动备份成功

**Given** 用户触发手动备份
**When** 备份成功完成
**Then** 系统创建备份历史记录
**And** `type` 为 `manual`
**And** `status` 为 `success`
**And** `file_size` 记录备份文件大小
**And** `file_count` 记录文件数量
**And** `created_at` 记录备份时间

#### Scenario: 记录自动备份失败

**Given** 定时任务触发自动备份
**When** 备份失败（如网络错误）
**Then** 系统创建备份历史记录
**And** `type` 为 `auto`
**And** `status` 为 `failed`
**And** `error_message` 记录详细错误信息

#### Scenario: 查询备份历史

**Given** 系统有多条备份历史记录
**When** 用户请求备份历史
**Then** 系统返回按时间倒序排列的历史记录
**And** 每条记录包含类型、状态、文件大小和时间
**And** 成功记录显示绿色标记
**And** 失败记录显示红色标记和错误信息

#### Scenario: 获取最后备份时间

**Given** 系统有备份历史记录
**When** 查询最后备份时间
**Then** 系统返回最新成功备份的 `created_at`
**And** 如果没有成功备份，返回 null
