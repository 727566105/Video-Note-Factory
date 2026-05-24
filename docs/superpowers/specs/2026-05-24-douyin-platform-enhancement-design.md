# 抖音平台增强：原生 API 分页 + 频道管理优化

## Context

Bilibili 平台已实现完整的动态页面和频道管理功能（原生 API 分页、断点续获取、分批加载、频道信息丰富化）。抖音平台当前依赖 yt-dlp 获取视频列表，只能单次获取约 30 条，无法分页、无法断点续获取。需要开发抖音原生 API 分页获取能力，并优化频道详情页 UI，使抖音体验对标 Bilibili。

## 核心模块

### 模块 1：抖音原生 API 分页（后端）

**新增文件：**
- `backend/app/services/douyin_api.py` — 抖音用户视频列表分页获取
- `backend/app/services/douyin_signer.py` — 抖音签名工具整合（复用现有 `abogus.py`）

**API 端点：** `https://www.douyin.com/aweme/v1/web/aweme/post/`

**分页机制：** 游标式（`max_cursor`），区别于 B站的页码式（`pn`）
- 初始 `max_cursor=0`，每次请求返回新的 `max_cursor` 和 `has_more`
- 每页约 20 条视频

**函数签名：**
```python
def fetch_douyin_user_videos(
    sec_uid: str,
    max_cursor: int = 0,
    count: int = 20,
    max_pages: int = 100,
    page_limit: int = None,
    progress_callback=None
) -> FetchResult:
```

**签名流程：**
1. 构建参数（20+ 固定参数 + `sec_user_id` + `max_cursor` + `count`）
2. 生成 `msToken`（复用 `douyin_downloader.py` 中的 `gen_real_msToken`）
3. 生成 `a_bogus` 签名（复用 `douyin_helper/abogus.py` 中的 `ABogus` 类）
4. 携带 Cookie（`ttwid` + `sessionid`，通过 `_get_cookie_manager().get("douyin")` 获取）
5. 发送请求，解析 `aweme_list`

**错误处理：**
- API 错误：记录错误信息，终止循环
- Cookie 缺失：提示配置 Cookie
- 请求超时：重试 1 次后终止
- 请求间隔：`DOUYIN_PAGE_INTERVAL` 秒（默认 5 秒）

**视频数据解析（`parse_aweme_item`）：**
```python
{
    "content_type": "video",
    "content_id": aweme["aweme_id"],
    "content_url": f"https://www.douyin.com/video/{aweme['aweme_id']}",
    "title": aweme.get("desc", ""),
    "cover_url": aweme["video"].get("cover", {}).get("url_list", [""])[0],
    "duration": aweme["video"].get("duration", 0) // 1000,  # 毫秒转秒
    "author": aweme["author"].get("nickname", ""),
    "published_at": datetime.fromtimestamp(aweme.get("create_time", 0)),
    "raw_info": json.dumps(aweme, ensure_ascii=False),
}
```

### 模块 2：后端集成 channel_fetcher

**修改文件：**
- `backend/app/services/channel_fetcher.py` — 抖音分支改用原生 API
- `backend/app/services/channel_fetch_queue.py` — 抖音分批获取适配

**核心变更：**

1. **替换 yt-dlp 为原生 API：**
```python
# channel_fetcher.py fetch_videos() 中
if platform == "douyin":
    return fetch_douyin_user_videos(sec_uid, max_cursor=0, count=20,
                                     max_pages=max_pages, page_limit=page_limit,
                                     progress_callback=progress_callback)
```

2. **数据库迁移 — 新增 `next_cursor` 字段：**
```python
# channel_video.py
class ChannelFetchStatus(Base):
    next_page = Column(Integer, default=1)     # B站用（页码）
    next_cursor = Column(String, default="0")  # 新增：抖音用（游标）
    total_videos = Column(Integer, default=0)
```

3. **分批获取队列适配：**
- 抖音分支使用 `next_cursor` 而非 `next_page`
- `fetch_status.partial` 时从 `next_cursor` 恢复

4. **refresh 接口调整：**
```python
# subscription.py
limit = None if sub.platform == "bilibili" else 50
# 抖音现在支持分页了，可以放宽限制
limit = None if sub.platform in ("bilibili", "douyin") else 50
```

### 模块 3：跨用户数据复用

**现有机制复用，无需新增逻辑：**

| 层级 | 表 | 共享方式 |
|------|------|----------|
| 全局缓存 | `channel_videos` | 无 user_id，同一博主视频数据只存一份 |
| 获取进度 | `channel_fetch_status` | 无 user_id，断点信息全局共享 |
| 用户副本 | `feed_items` | 有 user_id，每用户独立（已读状态、笔记关联） |

**用户 B 订阅已订阅博主的流程：**
1. `find_subscription_by_platform_id("douyin", sec_uid)` 检查已有订阅
2. `count_channel_videos()` 检查共享缓存
3. 有缓存 → `create_feed_items_from_channel_videos()` 复制（零 API 调用）
4. 无缓存 → 创建订阅，加入串行队列获取
5. 刷新时才调用 `fetch_douyin_user_videos` 重新获取

### 模块 4：前端平台特性配置

**新增文件：**
- `src/config/platformFeatures.ts` — 平台能力配置对象
- `src/hooks/usePlatformFeatures.ts` — 平台能力检测 Hook

**PlatformFeatures 接口：**
```typescript
interface PlatformFeatures {
  pagination: boolean
  paginationType: 'page' | 'cursor'
  resume: boolean
  batchFetch: boolean
  defaultPageSize: number
  dynamicFeed: boolean
  videoDuration: boolean
  channelAvatar: boolean
  channelStats: boolean
  subscribersDisplay: boolean
  timeJump: boolean
  portraitVideo?: boolean
}
```

**抖音配置：**
```typescript
douyin: {
  pagination: true,          // 原生 API 后支持
  paginationType: 'cursor',
  resume: true,
  batchFetch: true,
  defaultPageSize: 20,
  dynamicFeed: false,
  videoDuration: true,
  channelAvatar: true,
  channelStats: false,
  subscribersDisplay: false,
  timeJump: false,
  portraitVideo: true,       // 竖屏视频为主
}
```

### 模块 5：频道详情页 UI 优化

**修改文件：**
- `src/pages/ChannelDetailPage/index.tsx` — 网格视图 + 条件渲染
- `src/pages/ChannelsPage/index.tsx` — 频道信息丰富化

**UI 改进：**
1. **网格/列表切换** — 新增视图模式 toggle
2. **抖音竖屏卡片** — 9:16 aspect-ratio（基于 `features.portraitVideo`）
3. **条件渲染** — 根据 `usePlatformFeatures(platform)` 隐藏不支持的功能
4. **进度条优化** — 分批加载进度可视化（已获取/总数）
5. **频道头像展示** — 抖音频道头像获取

**条件渲染示例：**
```tsx
const features = usePlatformFeatures(platform)

{features.batchFetch && fetchStatus?.has_more && (
  <Button onClick={handleLoadMore}>加载更多</Button>
)}
{features.subscribersDisplay && <AvatarGroup users={subscribers} />}
```

## 开发顺序

1. 后端：`douyin_api.py` + `douyin_signer.py`（签名计算、分页获取）
2. 后端：集成到 `channel_fetcher.py` + `channel_fetch_queue.py` + DB 迁移
3. 前端：`platformFeatures.ts` + `usePlatformFeatures.ts`
4. 前端：`ChannelDetailPage` 网格视图 + 条件渲染

## 验证

1. 后端单元测试：抖音 API 分页 + 签名
2. 集成测试：订阅 → 获取 → 存 DB → 跨用户复用
3. 断点续传：中断后恢复
4. 前端测试：网格/列表切换 + 竖屏卡片
5. 端到端：Chrome MCP 浏览器验证

## 完整修改文件清单

| 操作 | 文件 |
|------|------|
| 新增 | `backend/app/services/douyin_api.py` |
| 新增 | `backend/app/services/douyin_signer.py` |
| 新增 | `src/config/platformFeatures.ts` |
| 新增 | `src/hooks/usePlatformFeatures.ts` |
| 修改 | `backend/app/services/channel_fetcher.py` |
| 修改 | `backend/app/services/channel_fetch_queue.py` |
| 修改 | `backend/app/db/models/channel_video.py` |
| 修改 | `backend/app/db/init_db.py` |
| 修改 | `backend/app/routers/subscription.py` |
| 修改 | `src/pages/ChannelDetailPage/index.tsx` |
| 修改 | `src/pages/ChannelsPage/index.tsx` |
