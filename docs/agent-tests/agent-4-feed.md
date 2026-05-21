# Agent-4: 订阅与动态测试

> Phase 2 并行执行。
> isolatedContext: "agent-4"
> 依赖: Agent-0 完成登录

## 测试用例

- TC-FEED-01: 动态页面加载
- TC-FEED-02: 视图切换
- TC-FEED-03: 刷新动态
- TC-FEED-04: 标记全部已读
- TC-FEED-05: 频道管理页面
- TC-FEED-06: 添加订阅
- TC-FEED-07: 频道详情页
- TC-FEED-08: 取消订阅

## 前置条件

先登录 admin 账户。

## 执行步骤

### 0. 登录

```
mcp__chrome__new_page(url="http://localhost:3015/login", isolatedContext="agent-4")
mcp__chrome__take_snapshot()
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "123456")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["VideoNote"], timeout=10000)
```

### 1. TC-FEED-05: 频道管理页面（先测频道管理，为后续动态测试准备数据）

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/channels")
mcp__chrome__wait_for(["已订阅"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/feed-05-channels.png")
```

验证：显示两个 Tab（"已订阅"/"已总结"），已订阅列表可见。

### 2. TC-FEED-06: 添加订阅

```
mcp__chrome__take_snapshot()
# 找到 URL 输入框
mcp__chrome__fill(channel_url_uid, "https://space.bilibili.com/946974")
# 点击添加按钮
mcp__chrome__click(add_subscription_uid)
mcp__chrome__wait_for(["订阅成功"], timeout=30000)
mcp__chrome__take_screenshot(filePath="test-results/feed-06-subscribed.png")
```

验证：订阅成功提示，频道出现在列表中。

**注意：** 此步骤涉及外部平台 API 调用，可能需要较长超时（30-60秒）。若超时则标记为 SKIP 并记录原因。

### 3. TC-FEED-07: 频道详情页

```
mcp__chrome__take_snapshot()
# 点击刚订阅的频道
mcp__chrome__click(channel_item_uid)
mcp__chrome__wait_for(["视频"], timeout=15000)
mcp__chrome__take_screenshot(filePath="test-results/feed-07-detail.png")
```

验证：显示频道视频列表。

### 4. TC-FEED-01: 动态页面加载

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/feed")
mcp__chrome__wait_for(["动态"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/feed-01-page.png")
```

验证：显示动态列表（网格或空状态）。

### 5. TC-FEED-02: 视图切换

```
mcp__chrome__take_snapshot()
# 找到视图切换按钮
# 点击列表视图
mcp__chrome__click(list_view_uid)
mcp__chrome__take_screenshot(filePath="test-results/feed-02-list.png")
# 点击网格视图
mcp__chrome__click(grid_view_uid)
mcp__chrome__take_screenshot(filePath="test-results/feed-02-grid.png")
```

验证：两种视图均正确切换。

### 6. TC-FEED-03: 刷新动态

```
mcp__chrome__take_snapshot()
# 点击刷新按钮
mcp__chrome__click(refresh_uid)
mcp__chrome__take_screenshot(filePath="test-results/feed-03-refresh.png")
# 等待刷新完成
mcp__chrome__wait_for(["刷新成功"], timeout=60000)
mcp__chrome__take_screenshot(filePath="test-results/feed-03-refreshed.png")
```

验证：刷新按钮有 loading 状态，完成后有提示。

**注意：** 刷新涉及外部 API 调用，可能超时。

### 7. TC-FEED-04: 标记全部已读

```
mcp__chrome__take_snapshot()
# 点击全部已读按钮
mcp__chrome__click(mark_all_read_uid)
mcp__chrome__wait_for(["已全部标记为已读"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/feed-04-read.png")
```

验证：所有未读标记消失。

### 8. TC-FEED-08: 取消订阅

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/channels")
mcp__chrome__wait_for(["已订阅"], timeout=10000)
mcp__chrome__take_snapshot()
# 找到 TC-FEED-06 添加的订阅
mcp__chrome__click(delete_subscription_uid)
mcp__chrome__wait_for(["确认"], timeout=5000)
mcp__chrome__click(confirm_delete_uid)
mcp__chrome__wait_for(["删除成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/feed-08-unsubscribed.png")
```

验证：订阅从列表移除。

## 清理

- TC-FEED-08 已删除测试添加的订阅

## 输出

- 测试结果统计：PASS/FAIL/SKIP
- 截图文件：`test-results/feed-*.png`
