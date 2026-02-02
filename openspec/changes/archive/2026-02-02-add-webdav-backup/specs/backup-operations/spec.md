# backup-operations Specification

## ADDED Requirements

### Requirement: 手动备份触发

系统 SHALL 支持用户手动触发备份操作，备份过程中显示进度，备份完成后返回结果。

#### Scenario: 成功执行手动备份

**Given** 用户已配置 WebDAV
**And** 用户点击"立即备份"按钮
**When** 备份操作开始
**Then** 系统显示加载状态
**And** 系统收集所有需要备份的文件
**And** 系统创建 ZIP 压缩包
**And** 系统上传压缩包到 WebDAV
**And** 系统记录备份历史
**And** 系统返回成功响应
**And** 前端显示"备份成功"提示

#### Scenario: 备份过程中显示进度

**Given** 备份操作正在执行
**When** 系统上传文件
**Then** 系统报告上传进度
**And** 前端显示进度条（0-100%）
**And** 用户可以看到当前正在上传的文件

#### Scenario: 备份失败处理

**Given** 用户点击"立即备份"按钮
**When** WebDAV 服务器连接失败
**Then** 系统停止备份操作
**And** 系统记录失败历史
**And** 系统返回错误响应
**And** 前端显示错误提示
**And** 用户可以重新尝试备份

#### Scenario: 备份操作并发控制

**Given** 一个备份操作正在执行
**When** 用户再次点击"立即备份"按钮
**Then** 系统返回"备份正在执行中"提示
**And** 系统不启动新的备份操作

#### Scenario: 未配置时触发备份

**Given** 用户未配置 WebDAV
**When** 用户点击"立即备份"按钮
**Then** 系统返回错误
**And** 提示"请先配置 WebDAV 连接"

---

### Requirement: 备份内容收集

系统 SHALL 收集以下内容进行备份：
1. `note_results/` 目录下所有文件（Markdown、音频缓存、JSON 元数据）
2. SQLite 数据库文件（整个 `.db` 文件）
所有文件被打包成一个 ZIP 压缩包。

#### Scenario: 收集笔记文件

**Given** note_results 目录包含多个文件
**When** 系统执行备份收集
**Then** 系统遍历 note_results 目录
**And** 系统包含所有 `.md`、`.json`、`.mp3`、`.wav` 等文件
**And** 系统保持目录结构

#### Scenario: 收集数据库

**Given** SQLite 数据库文件位于 `app.db`
**When** 系统执行备份收集
**Then** 系统包含整个数据库文件
**And** 系统验证数据库文件完整性

#### Scenario: 创建压缩包

**Given** 系统已收集所有备份文件
**When** 系统创建压缩包
**Then** 系统使用 ZIP 格式压缩
**And** 压缩包命名为 `bilinote_backup_{timestamp}.zip`
**And** 时间戳格式为 `YYYYMMDD_HHMMSS`

#### Scenario: 备份文件上传

**Given** 系统已创建备份压缩包
**When** 系统上传到 WebDAV
**Then** 系统连接到配置的 WebDAV 服务器
**And** 系统导航到配置的备份路径
And** 系统上传压缩包
**And** 系统验证上传成功

#### Scenario: 备份文件命名冲突

**Given** WebDAV 服务器已存在同名备份文件
**When** 系统上传新备份
**Then** 系统覆盖旧文件
**And** 系统不创建版本历史

---

### Requirement: 备份列表查询

系统 SHALL 支持查询 WebDAV 服务器上的备份列表，用户可以查看所有可用的备份文件。

#### Scenario: 查询备份列表

**Given** WebDAV 服务器上有多个备份文件
**When** 用户请求备份列表
**Then** 系统连接到 WebDAV 服务器
**And** 系统扫描备份目录
**And** 系统返回备份文件列表
**And** 每个备份包含文件名、大小、创建时间
**And** 列表按时间倒序排列

#### Scenario: 空备份列表

**Given** WebDAV 服务器上没有备份文件
**When** 用户请求备份列表
**Then** 系统返回空列表
**And** 前端显示"暂无备份"

#### Scenario: WebDAV 连接失败

**Given** WebDAV 服务器不可达
**When** 用户请求备份列表
**Then** 系统返回错误
**And** 提示"无法连接到 WebDAV 服务器"

---

### Requirement: 数据恢复

系统 SHALL 支持从 WebDAV 备份恢复数据，恢复过程包括下载备份、验证、停止服务、替换数据、重启服务。

#### Scenario: 成功恢复数据

**Given** 用户选择一个备份文件
**And** 用户点击恢复按钮
**When** 恢复操作开始
Then** 系统下载备份文件
**And** 系统验证备份文件完整性
**And** 系统停止当前服务
**And** 系统备份当前数据（安全措施）
**And** 系统解压备份文件
**And** 系统替换数据库和 note_results 目录
**And** 系统重启服务
**And** 系统记录恢复历史
**And** 系统返回成功响应
**And** 前端显示"恢复成功"提示

#### Scenario: 恢复前自动备份

**Given** 用户触发恢复操作
**When** 系统开始恢复流程
**Then** 系统自动创建当前状态备份
**And** 备份命名为 `bilinote_pre_restore_{timestamp}.zip`
**And** 系统在恢复成功后保留此备份

#### Scenario: 备份文件验证失败

**Given** 用户选择的备份文件已损坏
**When** 系统验证备份文件
**Then** 系统返回错误
**And** 提示"备份文件已损坏"
**And** 系统不执行恢复操作

#### Scenario: 恢复失败回滚

**Given** 恢复过程中发生错误
**When** 系统无法完成恢复
**Then** 系统使用预创建的备份回滚
**And** 系统确保服务正常运行
**And** 系统记录失败原因到日志
**And** 系统返回错误响应
**And** 前端显示"恢复失败，已回滚"提示

#### Scenario: 恢复操作并发控制

**Given** 一个恢复操作正在执行
**When** 用户尝试触发另一个恢复操作
**Then** 系统返回"恢复正在执行中"提示
**And** 系统不启动新的恢复操作

#### Scenario: 恢复确认提示

**Given** 用户点击恢复按钮
**When** 系统准备执行恢复
**Then** 系统显示二次确认对话框
**And** 对话框提示"恢复将覆盖当前数据，是否继续？"
**And** 用户必须确认后才能执行恢复

---

### Requirement: 备份状态查询

系统 SHALL 提供备份状态查询接口，返回当前是否正在执行备份或恢复操作，以及操作的进度信息。

#### Scenario: 查询空闲状态

**Given** 系统当前没有执行任何备份或恢复操作
**When** 前端查询备份状态
**Then** 返回 `is_busy: false`
**And** 返回 `current_operation: null`
**And** 返回 `progress: 0`

#### Scenario: 查询备份进行中状态

**Given** 系统正在执行备份操作
**And** 上传进度为 60%
**When** 前端查询备份状态
**Then** 返回 `is_busy: true`
**And** 返回 `current_operation: "backup"`
**And** 返回 `progress: 60`
**And** 返回 `message: "正在上传文件..."`

#### Scenario: 查询恢复进行中状态

**Given** 系统正在执行恢复操作
**And** 恢复进度为 40%
**When** 前端查询备份状态
**Then** 返回 `is_busy: true`
**And** 返回 `current_operation: "restore"`
**And** 返回 `progress: 40`
**And** 返回 `message: "正在恢复数据..."`

---

### Requirement: 备份文件删除

系统 SHALL 支持删除 WebDAV 服务器上的备份文件，用户可以手动清理旧的备份。

#### Scenario: 删除单个备份

**Given** 用户选择一个备份文件
**When** 用户点击删除按钮
**Then** 系统显示确认对话框
**And** 用户确认删除
**And** 系统从 WebDAV 服务器删除文件
**And** 系统返回成功响应
**And** 前端从列表中移除该备份

#### Scenario: 删除失败处理

**Given** 用户尝试删除备份文件
**When** WebDAV 服务器返回权限错误
**Then** 系统返回错误响应
**And** 提示"删除失败：权限不足"
**And** 前端显示错误提示
**And** 备份文件保留在列表中

#### Scenario: 取消删除操作

**Given** 用户点击删除按钮
**When** 系统显示确认对话框
**And** 用户点击取消
**Then** 系统不执行删除操作
**And** WebDAV 服务器上的文件保持不变
