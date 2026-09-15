# MCP Server 多用户加固设计

## 背景

VideoNote MCP Server 已有三层多用户隔离（contextvars 请求级 + DB user_id 过滤 + 文件 note_{uid}.json），用户数据隔离无问题。但面向 20-100 人中等规模多用户场景，存在以下隐患：

1. **无限流**：API Key 泄露或恶意调用，可无限制触发 import_video（视频下载+AI 生成），耗尽资源和 LLM 配额
2. **同步 DB 阻塞 event loop**：async tool 内直接调同步 DAO，高并发下请求串行化
3. **后台线程无上限**：每次裸 new Thread(daemon=True)，多用户同时导入视频创建大量线程
4. **API Key 无过期/无活跃追踪**：静态 Key 泄露后只能手动重置，无法判断哪些 Key 长期未用

## 设计

### 1. MCP 限流（按 user_id 滑动窗口）

**新建文件**：`backend/app/mcp_rate_limiter.py`

**机制**：内存滑动窗口（collections.deque），每个 user_id 一个 deque 记录最近请求时间戳。

**分级限流**：

| 类别 | 频率限制 | 涵盖的 tools |
|------|---------|-------------|
| 重操作 | 5 次/分钟 | `import_video`, `generate_from_feed`, `refresh_subscription` |
| 轻操作 | 60 次/分钟 | `list_notes`, `view_note`, `get_task_status`, `cancel_task`, `delete_task`, `export_note`, `list_subscriptions`, `add_subscription`, `get_feed`, `refresh_feed`, `list_channel_videos`, `list_author_videos`, `list_collections`, `generate_summary` |

**集成点**：在 `mcp_auth_middleware` 中，验证 API Key 成功后、转发请求前检查限流。

**超限响应**：HTTP 429 + JSON body `{"error": "rate_limit_exceeded", "retry_after": <秒数>}`。

**内存清理**：deque 超过 10 分钟无请求时自动清理（防止长期运行的内存泄漏）。

**线程安全**：用 `threading.Lock` 保护 deque 操作（mcp_auth_middleware 在 ASGI 层，可能有并发请求）。

### 2. 后台线程池

**修改文件**：`backend/app/mcp_server.py`、`backend/main.py`

**当前实现**：
```python
def _safe_run_in_thread(target, task_id, *args):
    thread = threading.Thread(target=..., daemon=True)
    thread.start()
```

**改为**：
```python
# 全局线程池，max_workers=10
_background_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="vn-bg")

def _safe_run_in_thread(target, task_id, *args):
    _background_executor.submit(...)
```

**生命周期管理**：
- `main.py` lifespan startup：无需显式启动（ThreadPoolExecutor 惰性创建线程）
- `main.py` lifespan shutdown：`_background_executor.shutdown(wait=True, cancel_futures=False)` 优雅关闭

**全局共享**：线程池是模块级变量，MCP 和 Web 的后台任务共用，全系统后台任务并发统一受控（max_workers=10）。

### 3. DB 操作异步包装

**修改文件**：`backend/app/mcp_server.py`（仅 MCP tool 函数内部）

**当前实现**（阻塞 event loop）：
```python
@mcp.tool()
async def list_notes(ctx: Context, limit: int = 20):
    user = _get_user(ctx)
    tasks = get_all_tasks(user_id=user["user_id"], ...)  # 同步阻塞
    ...
```

**改为**（不阻塞 event loop）：
```python
import anyio

@mcp.tool()
async def list_notes(ctx: Context, limit: int = 20):
    user = _get_user(ctx)
    tasks = await anyio.to_thread.run_sync(
        lambda: get_all_tasks(user_id=user["user_id"], ...)
    )
    ...
```

**范围**：仅包装 MCP tool 内的 DAO 调用（读/写数据库的操作）。不修改 DAO 本身（零侵入）。

**处理方式**：
- 简单的单次 DAO 调用：直接 `await anyio.to_thread.run_sync(lambda: ...)`
- 多次 DAO 调用：合并到一个 lambda 或辅助函数中，一次 run_sync 执行
- 文件 IO（读笔记 json）：同样包装

**注意**：`anyio.to_thread.run_sync` 内部使用默认的线程池（anyio 管理的），与上面的 `_background_executor`（用于长任务）是独立的。DB 操作是短任务，适合 anyio 默认线程池。

### 4. API Key 安全增强

**修改文件**：`backend/app/db/models/users.py`、`backend/app/db/init_db.py`、`backend/app/db/user_dao.py`、`backend/app/mcp_server.py`、`videoNote_frontend/src/pages/SettingPage/McpSettings.tsx`

**新增字段**（users 表）：
- `api_key_created_at` (DateTime)：API Key 创建时间
- `api_key_last_used_at` (DateTime)：最后使用时间

**init_db 迁移**：`ALTER TABLE users ADD COLUMN api_key_created_at DATETIME` + `api_key_last_used_at DATETIME`

**更新逻辑**：
- 生成 API Key 时（`generate_api_key`）：设置 `api_key_created_at = now()`
- MCP 认证成功时（`mcp_auth_middleware`）：异步更新 `api_key_last_used_at = now()`（非阻塞，失败静默忽略，不影响请求处理）

**前端展示**（McpSettings.tsx）：
- 显示创建时间："创建于 2026-07-11"
- 显示最后活跃："最后活跃：2 小时前" / "超过 30 天未使用，建议撤销"
- 基于活跃时间提示是否应该撤销长期不用的 Key

**不强制过期**：保持易用性（静态 Key 不过期），但通过"最后活跃"信息让用户自行判断。

## 不改的部分

- **三层隔离架构**：contextvars + DB user_id + 文件 note_{uid}.json 已经完善，不改
- **DAO 层**：不改为 async SQLAlchemy（改动太大，用 anyio 包装足够）
- **Redis/外部存储**：20-100 人规模不需要，内存限流足够
- **API Key 强制过期**：保持静态 Key 易用性，只加活跃追踪
- **MCP 协议层**：不改 FastMCP 的 session 管理

## 测试计划

| 测试 | 验证 |
|------|------|
| `test_rate_limiter_allows_under_limit` | 未超限的请求正常通过 |
| `test_rate_limiter_blocks_over_limit` | 超限请求返回 429 |
| `test_rate_limiter_heavy_vs_light` | 重操作和轻操作独立计数 |
| `test_rate_limiter_cleans_stale_entries` | 10 分钟无请求的 deque 被清理 |
| `test_thread_pool_limits_concurrency` | 线程池 max_workers 上限生效 |
| `test_db_async_wrapper_no_block` | DAO 调用不阻塞 event loop |
| `test_api_key_tracks_last_used` | 认证成功后 last_used_at 更新 |
