# 保存 video_url 以支持重新生成

## 问题

新建笔记时用户输入的 `video_url` 未持久化。后端数据库 `video_tasks` 表只保存 `video_id`、`platform`、`task_id`，前端 `loadTasksFromBackend()` 加载历史任务时将 `video_url` 设为空字符串，导致「重新生成」按钮点击无反应。

## 方案：后端数据库新增 video_url 字段

### 1. 数据库模型

**文件**: `backend/app/db/models/video_tasks.py`

新增 `video_url` 字段，`nullable=True` 兼容旧数据：

```python
video_url = Column(String, nullable=True)
```

### 2. 数据库迁移

**新建文件**: `backend/scripts/add_video_url_column.py`

SQL 脚本：`ALTER TABLE video_tasks ADD COLUMN video_url VARCHAR DEFAULT NULL`

### 3. DAO 层

**文件**: `backend/app/db/video_task_dao.py`

- `insert_video_task` 新增 `video_url` 参数

### 4. API 层

**文件**: `backend/app/routers/note.py`

- `generate_note`：调用 `insert_video_task` 时传入 `data.video_url`
- `get_tasks`：返回数据中包含 `video_url` 字段

### 5. 前端

**文件**: `BillNote_frontend/src/store/taskStore/index.ts`

- `loadTasksFromBackend`：从后端数据中读取 `video_url`

**文件**: `BillNote_frontend/src/pages/HomePage/components/NoteForm.tsx`

- 编辑模式下，若 `video_url` 为空，提交时提示「该任务缺少视频链接，无法重新生成」

### 6. 撤销之前的临时修复

移除 `is_editing` schema 字段，改用更合理的校验逻辑：编辑模式下 video_url 非空则正常提交，为空则提示无法重试。
