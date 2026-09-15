# 频道定时刷新 — 管理员配置实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现管理员为每个订阅频道单独设置自动刷新间隔，系统动态创建 APScheduler 任务定时获取最新内容。

**Architecture:** 创建 SubscriptionScheduler 调度管理器，为每个订阅动态添加/移除 APScheduler 任务；周期选项使用 CronTrigger 支持具体执行时刻配置；前端管理员界面提供分组下拉选择器。

**Tech Stack:** APScheduler (IntervalTrigger + CronTrigger), SQLite, React + shadcn/ui Select

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `backend/app/tasks/subscription_scheduler.py` | 新建 | 订阅调度管理器核心 |
| `backend/app/tasks/scheduler.py` | 修改 | 移除旧全局任务，接入新调度器 |
| `backend/app/db/models/subscriptions.py` | 修改 | 添加 fetch_at_hour, fetch_at_day 字段 |
| `backend/app/db/init_db.py` | 修改 | 添加迁移函数 |
| `backend/app/routers/subscription.py` | 修改 | 新增 API + 联动调度器 |
| `backend/main.py` | 修改 | lifespan 接入 SubscriptionScheduler |
| `videoNote_frontend/src/services/subscription.ts` | 修改 | 添加 API 方法 |
| `videoNote_frontend/src/pages/ChannelsPage/index.tsx` | 修改 | 管理员间隔选择 UI |

---

## 预设间隔选项常量

```python
FETCH_INTERVAL_OPTIONS = {
    "高频": [{"label": "每3分钟", "value": 3}, {"label": "每5分钟", "value": 5}, {"label": "每10分钟", "value": 10}],
    "中频": [{"label": "每15分钟", "value": 15}, {"label": "每30分钟", "value": 30}],
    "低频": [{"label": "每1小时", "value": 60}, {"label": "每2小时", "value": 120}, {"label": "每6小时", "value": 360}, {"label": "每12小时", "value": 720}],
    "周期": [{"label": "每天", "value": 1440}, {"label": "每周", "value": 10080}, {"label": "每月", "value": 43200}],
}
```

---

### Task 1: 数据库迁移 — 添加 fetch_at_hour 和 fetch_at_day 字段

- [ ] **Step 1:** 修改 `backend/app/db/models/subscriptions.py` Subscription 类添加 `fetch_at_hour = Column(Integer, default=3)` 和 `fetch_at_day = Column(Integer, nullable=True)`
- [ ] **Step 2:** 在 `backend/app/db/init_db.py` 添加 `migrate_subscriptions_fetch_time()` 函数并在 `init_db()` 调用
- [ ] **Step 3:** 启动后端验证迁移日志
- [ ] **Step 4:** Commit

---

### Task 2: 创建 SubscriptionScheduler 调度管理器

- [ ] **Step 1:** 创建 `backend/app/tasks/subscription_scheduler.py`（完整代码见设计文档）
- [ ] **Step 2:** Commit

---

### Task 3: 修改 scheduler.py 接入新调度器

- [ ] **Step 1:** 在 `scheduler.py` 顶部导入 `init_subscription_scheduler`，修改 `start_scheduler()` 移除 `_setup_subscription_fetch_job()` 调用，改为 `init_subscription_scheduler(scheduler)`，删除旧的全局订阅轮询函数
- [ ] **Step 2:** Commit

---

### Task 4: 修改 subscription.py 新增 API 和联动

- [ ] **Step 1:** 添加导入 `require_admin` 和 `get_subscription_scheduler, FETCH_INTERVAL_OPTIONS`
- [ ] **Step 2:** 添加 `@router.get("/fetch-intervals")` API
- [ ] **Step 3:** 添加 `@router.put("/{sub_id}/fetch-interval")` API（require_admin）
- [ ] **Step 4:** 修改 `add_subscription` 在返回成功前调用 `sched.add_job(sub)`
- [ ] **Step 5:** 修改 `delete_subscription` 在删除前调用 `sched.remove_job(sub_id)`
- [ ] **Step 6:** 修改 `toggle_subscription` 在状态变更后调用 `sched.reschedule_job(sub)`
- [ ] **Step 7:** 更新 `list_subscriptions` 返回添加 `fetch_at_hour` 和 `fetch_at_day` 字段
- [ ] **Step 8:** Commit

---

### Task 5: 确认 main.py lifespan

- [ ] **Step 1:** 检查 lifespan 已调用 `start_scheduler()`（通常已有）
- [ ] **Step 2:** Commit（如有修改）

---

### Task 6: 前端 API 方法

- [ ] **Step 1:** 在 `subscription.ts` 更新 Subscription 接口添加 `fetch_at_hour` 和 `fetch_at_day`
- [ ] **Step 2:** 添加 `fetchIntervalOptions()` 和 `updateFetchInterval()` API 方法
- [ ] **Step 3:** Commit

---

### Task 7: 前端 ChannelsPage UI

- [ ] **Step 1:** 添加导入和状态，加载预设选项
- [ ] **Step 2:** 在表格添加「刷新间隔」列（管理员可见），使用 Select 分组显示
- [ ] **Step 3:** Commit

---

### Task 8: 验证测试

- [ ] **Step 1:** 后端启动验证日志
- [ ] **Step 2:** API curl 验证
- [ ] **Step 3:** 前端页面验证
- [ ] **Step 4:** 3 分钟定时触发验证