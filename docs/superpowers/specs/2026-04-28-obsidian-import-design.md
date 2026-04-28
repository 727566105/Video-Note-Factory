# Obsidian 笔记库导入功能设计

## Context

BiliNote 目前只支持从视频生成笔记。用户需要导入已有的 Obsidian 笔记库，作为可搜索的知识库，保留 `[[wiki-links]]` 关联、YAML front matter、标签和附件。

**目标**：Web 端上传 ZIP → 后端解析 → 入库存储 → 前端浏览搜索，完整的独立导入系统。

## 架构决策

- **独立存储**：新建 `obsidian_notes` 等数据表，不与视频笔记混用
- **ZIP 上传**：用户打包 Obsidian 库为 ZIP 上传，兼容所有浏览器
- **预扫描全量转换**：导入前先扫描整个 ZIP，建立文件名映射表，确保链接正确转换
- **SSE 进度推送**：导入过程通过 Server-Sent Events 实时反馈进度

## 数据表结构

### `obsidian_imports`（导入批次）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| import_name | TEXT | 导入名称（默认 ZIP 文件名） |
| file_count | INTEGER | 笔记文件数 |
| status | TEXT | pending / parsing / importing / completed / failed |
| progress | INTEGER | 当前进度百分比 0-100 |
| error_message | TEXT | 失败原因 |
| created_at | DATETIME | 创建时间 |

### `obsidian_notes`（笔记）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| import_id | INTEGER FK | 关联 obsidian_imports.id |
| title | TEXT | 笔记标题（文件名或 YAML title） |
| file_path | TEXT | 原始相对路径（如 "daily/2024-01.md"） |
| content | TEXT | Markdown 正文（链接已转换为内部 ID） |
| raw_content | TEXT | 原始 Markdown（保留 [[链接]] 原文） |
| yaml_meta | TEXT | YAML front matter（JSON 存储） |
| tags | TEXT | 标签列表（逗号分隔） |
| links | TEXT | 关联的笔记 ID 列表（逗号分隔） |
| created_at | DATETIME | 导入时间 |

### `obsidian_attachments`（附件）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| import_id | INTEGER FK | 关联 obsidian_imports.id |
| note_id | INTEGER FK | 关联 obsidian_notes.id |
| original_path | TEXT | 原始路径（如 "attachments/image.png"） |
| stored_path | TEXT | 存储路径（如 "obsidian_attachments/{id}/image.png"） |
| file_type | TEXT | image / pdf / audio / other |
| file_size | INTEGER | 文件大小（字节） |

## 后端解析流程

### 文件：`backend/app/services/obsidian_import.py`

```
ZIP 上传
  → 解压到 /tmp/obsidian_import_{uuid}/
  → 安全校验（过滤 .obsidian/、.trash/、只保留 .md 和常见附件格式）
  → 预扫描：扫描所有 .md 文件，建立 {文件名(无扩展名): 相对路径} 映射表
  → 逐文件解析：
      1. 分离 YAML front matter 和正文
      2. 提取 YAML 中的 title, tags, date 等
      3. 提取正文中的 [[链接]] 和 #标签
      4. 提取 ![[附件]] 引用
      5. 同名冲突检查 → 加后缀 _imported_{n}
      6. 批量写入数据库
  → 第二遍扫描：将 [[note_name]] 转换为内部 note_id 关联
      - 目标存在的：记录 links = "1,3,5"
      - 目标不存在的：保持原文，标记为 broken_link
  → 附件处理：复制到 note_results/obsidian_attachments/{import_id}/
  → SSE 推送完成通知
  → 清理临时目录
```

### 并发控制

- 解析阶段单线程（文件 IO 密集）
- 批量插入用 `executemany`
- SSE 每处理 10 个文件推送一次进度

### 编码处理

依次尝试：UTF-8 → GBK → Latin-1

## API 端点

### 文件：`backend/app/routers/obsidian.py`

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/obsidian/import` | 上传 ZIP，创建导入任务，返回 import_id |
| GET | `/api/obsidian/import/{id}/progress` | SSE 推送导入进度 |
| GET | `/api/obsidian/imports` | 获取导入历史列表 |
| DELETE | `/api/obsidian/import/{id}` | 删除某次导入及其所有笔记和附件 |
| GET | `/api/obsidian/notes` | 搜索/浏览已导入笔记（支持 keyword, tag, import_id 筛选） |
| GET | `/api/obsidian/notes/{id}` | 获取笔记详情（含关联链接笔记列表） |

## 前端页面

### 文件：`BillNote_frontend/src/pages/SettingPage/Obsidian.tsx`

路由：`/settings/obsidian`

**布局**：
- 顶部：拖拽上传区域（ZIP 文件）
- 中部：实时进度条（SSE）
- 导入结果摘要：成功 N 篇、跳过 N 篇、失败 N 篇
- 下方：笔记浏览（搜索框 + 列表 + 详情查看）

### 文件：`BillNote_frontend/src/services/obsidian.ts`

封装 API 调用。

## 异常处理

| 异常 | 策略 |
|------|------|
| ZIP 解压失败 | 返回错误，提示用户重新打包 |
| ZIP 过大（>500MB） | 前端限制 + 后端校验 |
| YAML 解析失败 | 跳过 YAML，用文件名作标题，正文原样保留 |
| 同名冲突 | 自动加后缀 `_imported_{n}` |
| 附件缺失 | 笔记中标记 `[附件缺失: path]` |
| 编码异常 | UTF-8 → GBK → Latin-1 依次降级 |

## 新增文件清单

| 文件 | 职责 |
|------|------|
| `backend/app/db/models/obsidian.py` | 数据表模型定义 |
| `backend/app/db/obsidian_dao.py` | 数据库操作 |
| `backend/app/services/obsidian_import.py` | 导入核心逻辑（ZIP解析、Markdown解析、链接转换） |
| `backend/app/routers/obsidian.py` | API 路由 |
| `BillNote_frontend/src/pages/SettingPage/Obsidian.tsx` | 导入管理页面 |
| `BillNote_frontend/src/services/obsidian.ts` | API 调用封装 |

## 验证方式

1. 准备一个包含 10+ .md 文件、YAML front matter、[[链接]]、标签和附件的 Obsidian 测试库
2. 打包为 ZIP，通过前端上传
3. 验证：进度实时显示、所有笔记正确入库、链接正确关联、附件路径更新、标签提取正确
4. 测试异常：上传非 ZIP 文件、空 ZIP、同名文件冲突、YAML 格式错误的文件
