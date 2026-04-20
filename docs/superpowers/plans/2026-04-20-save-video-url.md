# 保存 video_url 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 持久化 video_url 字段，支持历史任务重新生成笔记

**Architecture:** 后端数据库新增 video_url 列，API 层保存并返回该字段，前端读取并校验

**Tech Stack:** SQLAlchemy (ORM), FastAPI, React/TypeScript, Zustand

---

## Task 1: 数据库模型新增 video_url 字段

**Files:**
- Modify: `backend/app/db/models/video_tasks.py`

- [ ] **Step 1: 修改 VideoTask 模型**

```python
from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import declarative_base

from app.db.engine import Base


class VideoTask(Base):
    __tablename__ = "video_tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    video_id = Column(String, nullable=False)
    platform = Column(String, nullable=False)
    task_id = Column(String, unique=True, nullable=False)
    video_url = Column(String, nullable=True)  # 新增字段，nullable=True 兼容旧数据
    created_at = Column(DateTime, server_default=func.now())
```

- [ ] **Step 2: 提交变更**

```bash
git add backend/app/db/models/video_tasks.py
git commit -m "feat(db): VideoTask 模型新增 video_url 字段"
```

---

## Task 2: 创建数据库迁移脚本

**Files:**
- Create: `backend/scripts/add_video_url_column.py`

- [ ] **Step 1: 创建迁移脚本**

```python
#!/usr/bin/env python3
"""
数据库迁移脚本：为 video_tasks 表添加 video_url 字段

使用方法：
    python backend/scripts/add_video_url_column.py
"""
import sys
import os

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.engine import get_db

def add_video_url_column():
    """为 video_tasks 表添加 video_url 列"""
    db = next(get_db())
    try:
        # 检查列是否已存在
        result = db.execute(text("PRAGMA table_info(video_tasks)"))
        columns = [row[1] for row in result.fetchall()]

        if 'video_url' in columns:
            print("video_url 列已存在，跳过迁移")
            return

        # 添加新列
        db.execute(text("ALTER TABLE video_tasks ADD COLUMN video_url VARCHAR DEFAULT NULL"))
        db.commit()
        print("成功添加 video_url 列")
    except Exception as e:
        db.rollback()
        print(f"迁移失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    add_video_url_column()
```

- [ ] **Step 2: 提交变更**

```bash
git add backend/scripts/add_video_url_column.py
git commit -m "feat(db): 添加 video_url 字段迁移脚本"
```

---

## Task 3: DAO 层支持 video_url

**Files:**
- Modify: `backend/app/db/video_task_dao.py`

- [ ] **Step 1: 修改 insert_video_task 函数**

```python
from app.db.models.video_tasks import VideoTask
from app.db.engine import get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)


# 插入任务
def insert_video_task(video_id: str, platform: str, task_id: str, video_url: str = None):
    db = next(get_db())
    try:
        task = VideoTask(
            video_id=video_id,
            platform=platform,
            task_id=task_id,
            video_url=video_url  # 新增参数
        )
        db.add(task)
        db.commit()
        db.refresh(task)
        logger.info(f"Video task inserted successfully. video_id: {video_id}, platform: {platform}, task_id: {task_id}, video_url: {video_url}")
    except Exception as e:
        logger.error(f"Failed to insert video task: {e}")
    finally:
        db.close()
```

- [ ] **Step 2: 提交变更**

```bash
git add backend/app/db/video_task_dao.py
git commit -m "feat(dao): insert_video_task 支持 video_url 参数"
```

---

## Task 4: API 层保存并返回 video_url

**Files:**
- Modify: `backend/app/routers/note.py`

- [ ] **Step 1: 导入 insert_video_task 并修改 generate_note**

找到 `generate_note` 函数中创建任务的代码，添加 `video_url` 参数：

```python
from app.db.video_task_dao import get_task_by_video, get_all_tasks, delete_task_by_id, insert_video_task

# 在 generate_note 函数中，找到创建 task_id 的位置
# 修改前（约第 212-213 行）：
# task_id = str(uuid.uuid4())

# 修改后：
if data.task_id:
    # 如果传了task_id，说明是重试！
    task_id = data.task_id
    # 更新之前的状态
    NoteGenerator()._update_status(task_id, TaskStatus.PENDING)
    logger.info(f"重试模式，复用已有 task_id={task_id}")
else:
    # 正常新建任务
    task_id = str(uuid.uuid4())
    # 保存任务到数据库，包含 video_url
    insert_video_task(video_id, data.platform, task_id, data.video_url)
```

注意：需要删除或注释掉原有的 `insert_video_task` 调用位置（如果有的话），确保只在新建时调用。

- [ ] **Step 2: 修改 get_tasks 返回 video_url**

找到 `get_tasks` 函数中构建 result 的位置（约第 413-419 行）：

```python
result.append({
    "task_id": task.task_id,
    "video_id": task.video_id,
    "platform": task.platform,
    "video_url": task.video_url,  # 新增字段
    "created_at": task.created_at.isoformat() if task.created_at else None,
    "note": note_data
})
```

同时修改没有笔记文件的情况（约第 422-428 行）：

```python
result.append({
    "task_id": task.task_id,
    "video_id": task.video_id,
    "platform": task.platform,
    "video_url": task.video_url,  # 新增字段
    "created_at": task.created_at.isoformat() if task.created_at else None,
    "note": None
})
```

- [ ] **Step 3: 提交变更**

```bash
git add backend/app/routers/note.py
git commit -m "feat(api): generate_note 保存 video_url，get_tasks 返回 video_url"
```

---

## Task 5: 前端读取 video_url

**Files:**
- Modify: `BillNote_frontend/src/store/taskStore/index.ts`

- [ ] **Step 1: 修改 loadTasksFromBackend 函数**

找到 `formData` 构建位置（约第 253-262 行），修改 `video_url` 字段：

```typescript
formData: {
  video_url: t.video_url || '',  // 从后端读取
  link: false,
  screenshot: false,
  platform: t.platform,
  quality: 'high',
  model_name: t.note.model_name || '',
  style: t.note.style || '',
  provider_id: '',
},
```

- [ ] **Step 2: 提交变更**

```bash
git add BillNote_frontend/src/store/taskStore/index.ts
git commit -m "feat(store): loadTasksFromBackend 读取 video_url"
```

---

## Task 6: 前端校验 video_url 并提示

**Files:**
- Modify: `BillNote_frontend/src/pages/HomePage/components/NoteForm.tsx`

- [ ] **Step 1: 撤销 is_editing 临时修复，恢复原始 schema**

将 schema 恢复为原始版本（移除 is_editing 字段和条件判断）：

```typescript
const formSchema = z
  .object({
    video_url: z.string().optional(),
    platform: z.string().nonempty('请选择平台'),
    quality: z.enum(['fast', 'medium', 'slow']),
    screenshot: z.boolean().optional(),
    link: z.boolean().optional(),
    model_name: z.string().nonempty('请选择模型'),
    format: z.array(z.string()).default([]),
    style: z.string().nonempty('请选择笔记生成风格'),
    extras: z.string().optional(),
    video_understanding: z.boolean().optional(),
    video_interval: z.coerce.number().min(1).max(30).default(4).optional(),
    grid_size: z
      .tuple([z.coerce.number().min(1).max(10), z.coerce.number().min(1).max(10)])
      .default([3, 3])
      .optional(),
  })
  .superRefine(({ video_url, platform }, ctx) => {
    if (platform === 'local') {
      if (!video_url) {
        ctx.addIssue({ code: 'custom', message: '本地视频路径不能为空', path: ['video_url'] })
      }
    }
    else {
      if (!video_url) {
        ctx.addIssue({ code: 'custom', message: '视频链接不能为空', path: ['video_url'] })
      }
      else {
        try {
          const url = new URL(video_url)
          if (!['http:', 'https:'].includes(url.protocol))
            throw new Error()
        }
        catch {
          ctx.addIssue({ code: 'custom', message: '请输入正确的视频链接', path: ['video_url'] })
        }
      }
    }
  })
```

- [ ] **Step 2: 移除 defaultValues 中的 is_editing**

```typescript
defaultValues: {
  platform: 'bilibili',
  quality: 'medium',
  model_name: modelList[0]?.model_name || '',
  style: 'minimal',
  video_interval: 4,
  grid_size: [3, 3],
  format: [],
},
```

- [ ] **Step 3: 移除 form.reset 中的 is_editing**

```typescript
form.reset({
  platform: formData.platform || 'bilibili',
  video_url: formData.video_url || '',
  model_name: formData.model_name || modelList[0]?.model_name || '',
  style: formData.style || 'minimal',
  quality: formData.quality || 'medium',
  extras: formData.extras || '',
  screenshot: formData.screenshot ?? false,
  link: formData.link ?? false,
  video_understanding: formData.video_understanding ?? false,
  video_interval: formData.video_interval ?? 4,
  grid_size: formData.grid_size ?? [3, 3],
  format: formData.format ?? [],
})
```

- [ ] **Step 4: 修改 onSubmit 函数，编辑模式下校验 video_url**

```typescript
const onSubmit = async (values: NoteFormValues) => {
  console.log('Not even go here')
  const payload: NoteFormValues = {
    ...values,
    provider_id: modelList.find(m => m.model_name === values.model_name)!.provider_id,
    task_id: currentTaskId || '',
  }

  // 编辑模式下校验 video_url
  if (currentTaskId) {
    if (!payload.video_url) {
      message.error('该任务缺少视频链接，无法重新生成')
      return
    }
    retryTask(currentTaskId, payload)
    return
  }

  // message.success('已提交任务')
  const data = await generateNote(payload)
  addPendingTask(data.task_id, values.platform, payload)
}
```

- [ ] **Step 5: 提交变更**

```bash
git add BillNote_frontend/src/pages/HomePage/components/NoteForm.tsx
git commit -m "feat(form): 编辑模式下校验 video_url，为空时提示无法重试"
```

---

## Task 7: 验证与测试

- [ ] **Step 1: 运行数据库迁移**

```bash
cd backend
python scripts/add_video_url_column.py
```

预期输出：`成功添加 video_url 列` 或 `video_url 列已存在，跳过迁移`

- [ ] **Step 2: 启动后端服务**

```bash
cd backend
python main.py
```

- [ ] **Step 3: 启动前端服务**

```bash
cd BillNote_frontend
pnpm dev
```

- [ ] **Step 4: 功能测试**

1. 新建笔记：输入视频链接，生成笔记
2. 刷新页面：确认历史记录中有该任务
3. 点击任务：确认视频链接正确显示
4. 点击「重新生成」：确认可以正常提交
5. 测试旧数据：点击旧任务，确认提示「该任务缺少视频链接，无法重新生成」

---

## 自检清单

- [x] Spec 覆盖：所有需求已实现
- [x] 无占位符：所有代码完整
- [x] 类型一致：字段命名统一为 `video_url`
