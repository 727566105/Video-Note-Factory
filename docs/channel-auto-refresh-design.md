# 频道定时刷新 — 管理员配置设计

## Context

管理员需要在频道管理页面为每个订阅频道单独设置自动刷新间隔，系统自动定期获取最新视频。现有系统使用 APScheduler 全局任务 + 环境变量控制，缺少 UI 配置入口和单频道灵活控制。

## 需求

- 每频道单独设置刷新间隔（非全局统一）
- 仅管理员可设置
- 已禁用订阅跳过刷新
- 预设选项分组：高频/中频/低频/周期

## 方案：动态 APScheduler 任务

为每个订阅创建独立的 APScheduler 定时任务，订阅增删改时动态管理任务生命周期。

### 预设间隔选项

| 分组 | 选项 | 分钟值 |
|------|------|--------|
| 高频 | 每3分钟 | 3 |
| 高频 | 每5分钟 | 5 |
| 高频 | 每10分钟 | 10 |
| 中频 | 每15分钟 | 15 |
| 中频 | 每30分钟 | 30 |
| 低频 | 每1小时 | 60 |
| 低频 | 每2小时 | 120 |
| 低频 | 每6小时 | 360 |
| 低频 | 每12小时 | 720 |
| 周期 | 每天 | 1440 |
| 周期 | 每周 | 10080 |
| 周期 | 每月 | 43200 |

天/周/月周期使用 CronTrigger（固定时间点），其余使用 IntervalTrigger。

### 周期选项的执行时间配置

高频/中频/低频选项使用 IntervalTrigger，无需额外配置。

周期选项（每天/每周/每月）使用 CronTrigger，**管理员可设置具体执行时间**：

| 周期选项 | 额外配置 | UI 控件 | 示例 |
|----------|----------|---------|------|
| 每天 | 执行时刻 | 小时下拉 (0-23) | 每天 03:00 |
| 每周 | 星期几 + 时刻 | 星期下拉 + 小时下拉 | 每周一 10:00 |
| 每月 | 几号 + 时刻 | 日期下拉 (1-28) + 小时下拉 | 每月1号 08:00 |

**前端交互**：选择周期选项后，自动展开时间选择器，默认值为凌晨 3 点。

**CronTrigger 映射**：
```
每天 03:00 → CronTrigger(hour=3, minute=0)
每周一 10:00 → CronTrigger(day_of_week='mon', hour=10, minute=0)
每月1号 08:00 → CronTrigger(day=1, hour=8, minute=0)
```

### 后端 API

**新增接口：**

- `PUT /api/subscriptions/{sub_id}/fetch-interval` — 管理员设置间隔（require_admin）
  ```
  Body: {
    "fetch_interval": 1440,
    "fetch_at_hour": 3,     // 仅周期选项需要
    "fetch_at_day": null    // 每天=null，每周=0-6，每月=1-28
  }
  ```
- `GET /api/subscriptions/fetch-intervals` — 获取预设选项列表（含时间配置提示）

**现有接口联动：**

- `POST /api/subscriptions` → 添加后 `add_job()`
- `DELETE /api/subscriptions/{sub_id}` → 删除前 `remove_job()`
- `PUT /api/subscriptions/{sub_id}/toggle` → `reschedule_job()`

**任务执行逻辑：**

1. 检查订阅 enabled 状态，未启用跳过
2. 调用 `fetch_all_for_subscription(sub, limit=50)`（复用 channel_fetcher.py）
3. 调用 `upsert_feed_items()` 写入新内容
4. 更新 `last_checked_at`

### 前端 UI

ChannelsPage 订阅表格新增「刷新间隔」列（管理员可见）：
- 分组下拉选择器
- 当前值高亮
- 修改后 toast 提示
- 显示上次刷新时间和下次刷新估算

### 数据库

复用已有 `subscriptions.fetch_interval`（INTEGER, DEFAULT 60）。

**新增字段**（用于周期选项的执行时间配置）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `fetch_at_hour` | INTEGER | 执行时刻（0-23），默认 3 |
| `fetch_at_day` | INTEGER | 每周：星期几（0=周一，6=周日）；每月：几号（1-28）|

迁移逻辑：`migrate_subscriptions_table()` 检查并添加新字段。

### 调度管理器 SubscriptionScheduler

新建 `backend/app/tasks/subscription_scheduler.py`：

- `startup()` — 启动时加载所有 enabled 订阅，创建任务
- `add_job(subscription)` — 新订阅创建任务
- `remove_job(subscription_id)` — 删除订阅移除任务
- `reschedule_job(subscription)` — 修改间隔/状态时重新调度
- `shutdown()` — 清理所有任务

任务 ID 规则：`sub_fetch_{subscription.id}`

### 启动流程

```
main.py lifespan → scheduler.start() → SubscriptionScheduler.startup()
  → 查询 enabled=1 订阅 → 为每个创建 APScheduler Job
```

## 关键文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/app/tasks/subscription_scheduler.py` | 新建 | 调度管理器 |
| `backend/app/tasks/scheduler.py` | 修改 | 移除旧全局任务 |
| `backend/app/routers/subscription.py` | 修改 | 新增接口 + 联动 |
| `videoNote_frontend/src/pages/ChannelsPage/index.tsx` | 修改 | 管理员间隔 UI |
| `videoNote_frontend/src/services/subscription.ts` | 修改 | API 方法 |

## 验证

1. 管理员设置频道 A 间隔为 3 分钟 → 后端日志确认任务创建
2. 等待 3 分钟 → 确认自动刷新触发
3. 修改间隔 → 确认任务重新调度
4. 禁用订阅 → 确认任务暂停
5. 重启后端 → 确认任务自动恢复