# Agent-5: 集成模块与系统测试

> Phase 2 并行执行。
> isolatedContext: "agent-5"
> 依赖: Agent-0 完成登录

## 测试用例

- TC-INTEG-01: 思源笔记 — 查看配置
- TC-INTEG-02: 思源笔记 — 测试连接（成功）`@external-dependent`
- TC-INTEG-03: 思源笔记 — 测试连接（失败）
- TC-INTEG-04: WebDAV — 查看配置
- TC-INTEG-05: WebDAV — 测试连接 `@external-dependent`
- TC-INTEG-06: WebDAV — 创建备份 `@external-dependent`
- TC-INTEG-07: 关于页面
- TC-INTEG-08: 配置导入导出
- TC-SYS-01: 侧边栏导航 — 展开态
- TC-SYS-02: 侧边栏折叠/展开
- TC-SYS-03: 用户下拉菜单

## 前置条件

先登录 admin 账户。

## 执行步骤

### 0. 登录

```
mcp__chrome__new_page(url="http://localhost:3015/login", isolatedContext="agent-5")
mcp__chrome__take_snapshot()
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "123456")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["VideoNote"], timeout=10000)
```

### 1. TC-INTEG-01: 思源笔记 — 查看配置

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/siyuan")
mcp__chrome__wait_for(["思源笔记"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/integ-01-siyuan.png")
```

验证：显示思源笔记配置表单，包含 API URL、API Token、默认笔记本字段。

### 2. TC-INTEG-03: 思源笔记 — 测试连接（失败）

```
mcp__chrome__take_snapshot()
# 填入无效地址
mcp__chrome__fill(siyuan_url_uid, "http://invalid-host:9999")
mcp__chrome__fill(siyuan_token_uid, "test-token")
mcp__chrome__click(siyuan_test_uid)
mcp__chrome__wait_for(["连接失败"], timeout=15000)
mcp__chrome__take_screenshot(filePath="test-results/integ-03-siyuan-fail.png")
```

验证：显示连接失败提示和原因。

### 3. TC-INTEG-02: 思源笔记 — 测试连接（成功）`@external-dependent`

```
mcp__chrome__take_snapshot()
# 填入有效的思源笔记地址（如果本地有运行思源笔记）
mcp__chrome__fill(siyuan_url_uid, "http://127.0.0.1:6806")
mcp__chrome__fill(siyuan_token_uid, "")
mcp__chrome__click(siyuan_test_uid)
mcp__chrome__take_screenshot(filePath="test-results/integ-02-siyuan-success.png")
```

验证：若思源笔记服务可用，显示连接成功；否则标记 SKIP。

### 4. TC-INTEG-04: WebDAV — 查看配置

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/webdav")
mcp__chrome__wait_for(["WebDAV"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/integ-04-webdav.png")
```

验证：显示 WebDAV 配置表单，包含 URL、用户名、密码、路径字段。

### 5. TC-INTEG-05: WebDAV — 测试连接 `@external-dependent`

```
mcp__chrome__take_snapshot()
# 填入 WebDAV 地址
mcp__chrome__fill(webdav_url_uid, "https://dav.example.com")
mcp__chrome__fill(webdav_username_uid, "test")
mcp__chrome__fill(webdav_password_uid, "test")
mcp__chrome__click(webdav_test_uid)
mcp__chrome__take_screenshot(filePath="test-results/integ-05-webdav-test.png")
```

验证：显示连接测试结果。若外部服务不可用，标记 SKIP。

### 6. TC-INTEG-06: WebDAV — 创建备份 `@external-dependent`

```
# 如果 WebDAV 连接成功
mcp__chrome__take_snapshot()
mcp__chrome__click(webdav_backup_uid)
mcp__chrome__wait_for(["备份成功"], timeout=60000)
mcp__chrome__take_screenshot(filePath="test-results/integ-06-webdav-backup.png")
```

验证：备份完成提示。若 WebDAV 未配置则标记 SKIP。

### 7. TC-INTEG-07: 关于页面

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/about")
mcp__chrome__wait_for(["videoNote"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/integ-07-about.png")
```

验证：显示项目名称 "videoNote"、版本号、技术栈信息。

### 8. TC-INTEG-08: 配置导入导出

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings")
mcp__chrome__wait_for(["设置"], timeout=10000)
mcp__chrome__take_snapshot()
# 找到导出配置按钮
mcp__chrome__click(export_config_uid)
mcp__chrome__take_screenshot(filePath="test-results/integ-08-export.png")
```

验证：触发配置 JSON 文件下载。

### 9. TC-SYS-01: 侧边栏导航 — 展开态

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/")
mcp__chrome__wait_for(["VideoNote"], timeout=10000)
mcp__chrome__take_snapshot()

# 测试侧边栏导航
# 点击 "笔记列表"
mcp__chrome__click(notes_nav_uid)
mcp__chrome__wait_for(["笔记列表"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/sys-01-notes.png")

# 点击 "动态"
mcp__chrome__click(feed_nav_uid)
mcp__chrome__wait_for(["动态"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/sys-01-feed.png")

# 点击 "频道管理"
mcp__chrome__click(channels_nav_uid)
mcp__chrome__wait_for(["已订阅"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/sys-01-channels.png")

# 点击 "快捷添加笔记"
mcp__chrome__click(quick_add_uid)
mcp__chrome__wait_for(["VideoNote"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/sys-01-home.png")
```

验证：每次点击都正确导航到对应路由。

### 10. TC-SYS-02: 侧边栏折叠/展开

```
# 在首页
mcp__chrome__take_snapshot()
# 点击折叠按钮
mcp__chrome__click(collapse_sidebar_uid)
mcp__chrome__take_screenshot(filePath="test-results/sys-02-collapsed.png")

# 验证折叠态：应只显示图标
# 点击展开按钮（Sparkles 或 PanelLeft 图标）
mcp__chrome__click(expand_sidebar_uid)
mcp__chrome__take_screenshot(filePath="test-results/sys-02-expanded.png")
```

验证：折叠态只显示图标，展开态显示完整导航。

### 11. TC-SYS-03: 用户下拉菜单

```
mcp__chrome__take_snapshot()
# 点击用户头像/名称（侧边栏底部）
mcp__chrome__click(user_avatar_uid)
# 等待下拉菜单
mcp__chrome__wait_for(["退出登录"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/sys-03-menu.png")

# 点击退出登录
mcp__chrome__click(logout_uid)
mcp__chrome__wait_for(["登录你的账户"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/sys-03-logout.png")
```

验证：下拉菜单正常显示，退出登录后回到 `/login`。

## 输出

- 测试结果统计：PASS/FAIL/SKIP
- 截图文件：`test-results/integ-*.png`, `test-results/sys-*.png`
- 标记 `@external-dependent` 的用例若外部服务不可用则记录 SKIP
