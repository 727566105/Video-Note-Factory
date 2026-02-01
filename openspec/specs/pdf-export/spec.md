# pdf-export Specification

## Purpose
TBD - created by archiving change add-pdf-export. Update Purpose after archive.
## Requirements
### Requirement: PDF 导出 API 端点

系统 SHALL 提供 PDF 导出 API 端点，该端点 MUST 支持将已生成的 Markdown 笔记转换为 PDF 格式并返回文件流。

#### Scenario: 成功导出 PDF

**Given** 一个有效的任务 ID
**And** 对应的 Markdown 笔记文件存在
**When** 客户端调用 `GET /api/export/pdf/{task_id}`
**Then** 系统返回 PDF 文件流
**And** Content-Type 为 `application/pdf`
**And** 文件名为 `note_{task_id}.pdf`

#### Scenario: 笔记不存在

**Given** 一个无效的任务 ID
**When** 客户端调用 `GET /api/export/pdf/{task_id}`
**Then** 系统返回 404 状态码
**And** 返回错误信息 "笔记不存在"

#### Scenario: PDF 生成失败

**Given** 一个有效的任务 ID
**And** Markdown 文件存在但包含非法内容
**When** 客户端调用 `GET /api/export/pdf/{task_id}`
**Then** 系统返回 500 状态码
**And** 返回错误信息

---

### Requirement: PDF 样式渲染

生成的 PDF SHALL 支持中文字体显示，MUST 正确渲染 Markdown 基本元素（标题、列表、代码块、引用）和图片。

#### Scenario: 中文内容显示

**Given** Markdown 包含中文字符
**When** 生成 PDF
**Then** 中文字符正确显示
**And** 不出现乱码或方框

#### Scenario: 基本 Markdown 元素

**Given** Markdown 包含标题、列表、代码块、引用
**When** 生成 PDF
**Then** 所有元素正确渲染
**And** 样式清晰可读

#### Scenario: 图片显示

**Given** Markdown 包含图片引用
**When** 生成 PDF
**Then** 图片正确嵌入 PDF
**And** 图片大小自适应

---

### Requirement: 前端导出按钮

笔记详情页界面 SHALL 提供 PDF 导出按钮，该按钮 MUST 在笔记生成成功后可用，点击后 SHALL 触发 PDF 下载并显示相应的用户反馈。

#### Scenario: 显示导出按钮

**Given** 用户在笔记详情页
**And** 笔记已成功生成
**When** 页面渲染
**Then** 显示"导出 PDF"按钮
**And** 按钮位置明显（工具栏或右上角）

#### Scenario: 点击导出

**Given** 用户点击"导出 PDF"按钮
**When** API 请求成功
**Then** 显示加载状态
**And** 成功后触发浏览器下载
**And** 显示成功提示

#### Scenario: 导出失败处理

**Given** 用户点击"导出 PDF"按钮
**When** API 请求失败
**Then** 停止加载状态
**And** 显示错误提示
**And** 按钮可重新点击

---

### Requirement: 下载文件命名

导出的 PDF 文件 SHALL 使用 `note_{task_id}.pdf` 格式命名，MUST 对文件名中的特殊字符进行安全处理以防止文件系统问题。

#### Scenario: 标准文件名

**Given** 一个任务 ID 为 `abc123`
**When** 下载 PDF
**Then** 文件名为 `note_abc123.pdf`

#### Scenario: 文件名安全性

**Given** 任务 ID 包含特殊字符
**When** 下载 PDF
**Then** 文件名经过安全处理
**And** 不包含可能导致问题的字符

---

### Requirement: 性能要求

PDF 导出操作 SHALL 在性能约束内完成：普通笔记（5000字以下）MUST 在 5秒内完成，大笔记（20000字以下）SHALL 在 20秒内完成，超时 MUST 返回错误响应。

#### Scenario: 普通笔记导出

**Given** 一个包含 5000 字的 Markdown 笔记
**When** 执行导出操作
**Then** 导出时间少于 5 秒

#### Scenario: 大笔记导出

**Given** 一个包含 20000 字的 Markdown 笔记
**When** 执行导出操作
**Then** 导出时间少于 20 秒

#### Scenario: 超时处理

**Given** 导出操作超过 60 秒
**When** 仍未完成
**Then** 返回超时错误
**And** 提示用户重试或联系管理员

---

### Requirement: 错误日志

系统 SHALL 记录所有 PDF 导出操作的成功和失败情况，MUST 包含任务 ID、错误堆栈和时间戳信息，用于故障排查和性能监控。

#### Scenario: 记录失败原因

**Given** PDF 导出失败
**When** 错误发生
**Then** 系统记录详细错误日志
**And** 日志包含任务 ID、错误堆栈、时间戳

#### Scenario: 监控导出统计

**Given** 系统正在运行
**When** PDF 导出发生
**Then** 记录导出成功/失败次数
**And** 记录平均导出时间

---

