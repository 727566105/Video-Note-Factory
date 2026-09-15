# Agent-3: 设置模块全功能测试

> Phase 2 并行执行。
> isolatedContext: "agent-3"
> 依赖: Agent-0 完成登录

## 测试用例

- TC-MODEL-01: 供应商列表加载
- TC-MODEL-02: 新建供应商（built-in）
- TC-MODEL-03: 编辑供应商
- TC-MODEL-04: 连接测试
- TC-MODEL-05: 删除供应商
- TC-MODEL-06: 普通用户无法访问模型设置（跳过，需多用户）
- TC-DOWNLOAD-01: 下载器列表
- TC-DOWNLOAD-02: 编辑下载器 Cookie
- TC-QUEUE-01: 查看队列状态
- TC-QUEUE-02: 修改最大并发数
- TC-USERS-01: 用户列表
- TC-USERS-02: 创建新用户
- TC-USERS-03: 删除用户
- TC-SUB-SETTING-01: 订阅设置页面渲染
- TC-SUB-SETTING-02: 修改订阅设置

## 前置条件

先登录 admin 账户。

## 执行步骤

### 0. 登录

```
mcp__chrome__new_page(url="http://localhost:3015/login", isolatedContext="agent-3")
mcp__chrome__take_snapshot()
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "123456")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["VideoNote"], timeout=10000)
```

### 1. TC-MODEL-01: 供应商列表加载

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/model")
mcp__chrome__wait_for(["模型供应商", "供应商"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/model-01-list.png")
```

验证：左侧面板显示供应商列表。

### 2. TC-MODEL-02: 新建供应商

```
mcp__chrome__take_snapshot()
# 点击新建供应商按钮
mcp__chrome__click(new_provider_uid)
mcp__chrome__wait_for(["新建供应商"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/model-02-new-form.png")

# 填写表单
mcp__chrome__take_snapshot()
# 选择类型 built-in
mcp__chrome__click(type_selector_uid)
mcp__chrome__click(built_in_option_uid)
# 填写名称
mcp__chrome__fill(name_uid, "E2E-TestProvider")
# 填写 API Key
mcp__chrome__fill(api_key_uid, "sk-test-e2e-123")
# 填写 Base URL
mcp__chrome__fill(base_url_uid, "https://api.openai.com/v1")
# 点击保存
mcp__chrome__click(save_uid)
mcp__chrome__wait_for(["E2E-TestProvider"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/model-02-created.png")
```

验证：供应商 "E2E-TestProvider" 出现在列表中。

### 3. TC-MODEL-03: 编辑供应商

```
mcp__chrome__take_snapshot()
# 点击 E2E-TestProvider 进入编辑
mcp__chrome__click(e2e_provider_uid)
mcp__chrome__wait_for(["E2E-TestProvider"], timeout=5000)
# 修改名称
mcp__chrome__fill(name_uid, "E2E-UpdatedProvider")
mcp__chrome__click(save_uid)
mcp__chrome__wait_for(["E2E-UpdatedProvider"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/model-03-updated.png")
```

验证：名称更新为 "E2E-UpdatedProvider"。

### 4. TC-MODEL-04: 连接测试

```
# 在编辑页找到测试连接按钮
mcp__chrome__take_snapshot()
mcp__chrome__click(test_connection_uid)
mcp__chrome__take_screenshot(filePath="test-results/model-04-test.png")
```

验证：显示连接测试结果（可能失败因为测试 API Key 无效，这是正常的）。

### 5. TC-MODEL-05: 删除供应商

```
# 回到供应商列表
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/model")
mcp__chrome__wait_for(["E2E-UpdatedProvider"], timeout=10000)
mcp__chrome__take_snapshot()
# 找到删除按钮
mcp__chrome__click(delete_provider_uid)
# 确认删除
mcp__chrome__wait_for(["确认"], timeout=5000)
mcp__chrome__click(confirm_delete_uid)
mcp__chrome__wait_for(["删除成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/model-05-deleted.png")
```

验证：供应商从列表移除。

### 6. TC-DOWNLOAD-01: 下载器列表

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/download")
mcp__chrome__wait_for(["下载器"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/download-01-list.png")
```

验证：左侧显示下载器选项列表。

### 7. TC-DOWNLOAD-02: 编辑下载器 Cookie

```
mcp__chrome__take_snapshot()
# 点击某平台下载器（如 bilibili）
mcp__chrome__click(bilibili_downloader_uid)
mcp__chrome__wait_for(["Cookie"], timeout=5000)
mcp__chrome__take_snapshot()
# 填写 Cookie
mcp__chrome__fill(cookie_uid, "test-cookie-value-e2e")
mcp__chrome__click(save_cookie_uid)
mcp__chrome__wait_for(["保存成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/download-02-cookie.png")
```

验证：Cookie 保存成功提示。

### 8. TC-QUEUE-01: 查看队列状态

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/taskqueue")
mcp__chrome__wait_for(["任务队列"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/queue-01-status.png")
```

验证：显示当前执行中数量、最大并发数、排队中数量。

### 9. TC-QUEUE-02: 修改最大并发数

```
mcp__chrome__take_snapshot()
# 记录当前并发数
# 修改并发数（点击 +/- 或直接输入）
mcp__chrome__click(decrease_concurrency_uid)
mcp__chrome__click(save_queue_uid)
mcp__chrome__wait_for(["保存成功"], timeout=5000)
# 刷新验证
mcp__chrome__navigate_page(type="reload")
mcp__chrome__wait_for(["任务队列"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/queue-02-updated.png")
# 恢复原始值
mcp__chrome__click(increase_concurrency_uid)
mcp__chrome__click(save_queue_uid)
```

验证：并发数更新成功。

### 10. TC-USERS-01: 用户列表

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/users")
mcp__chrome__wait_for(["用户管理"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/users-01-list.png")
```

验证：显示用户列表，至少包含 admin 用户。

### 11. TC-USERS-02: 创建新用户

```
mcp__chrome__take_snapshot()
# 点击添加用户按钮
mcp__chrome__click(add_user_uid)
mcp__chrome__wait_for(["添加用户"], timeout=5000)
# 填写用户信息
mcp__chrome__fill(new_username_uid, "e2e_test_user")
mcp__chrome__fill(new_password_uid, "test123456")
# 选择角色 user
mcp__chrome__click(role_selector_uid)
mcp__chrome__click(user_role_uid)
# 保存
mcp__chrome__click(save_user_uid)
mcp__chrome__wait_for(["e2e_test_user"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/users-02-created.png")
```

验证：新用户 "e2e_test_user" 出现在列表中。

### 12. TC-USERS-03: 删除用户

```
mcp__chrome__take_snapshot()
# 找到 e2e_test_user 的删除按钮
mcp__chrome__click(delete_user_uid)
mcp__chrome__wait_for(["确认"], timeout=5000)
mcp__chrome__click(confirm_delete_user_uid)
mcp__chrome__wait_for(["删除成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/users-03-deleted.png")
```

验证：用户从列表移除。

### 13. TC-SUB-SETTING-01: 订阅设置页面渲染

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/subscription")
mcp__chrome__wait_for(["订阅"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/sub-setting-01.png")
```

验证：显示自动刷新频率选择器、RSSHub 地址输入框。

### 14. TC-SUB-SETTING-02: 修改订阅设置

```
mcp__chrome__take_snapshot()
# 修改刷新频率
mcp__chrome__click(frequency_selector_uid)
mcp__chrome__click(new_frequency_uid)
# 点击保存
mcp__chrome__click(save_sub_setting_uid)
mcp__chrome__wait_for(["保存"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/sub-setting-02.png")
```

验证：设置已保存提示。

## 清理

- TC-MODEL-05 已删除 E2E-UpdatedProvider
- TC-USERS-03 已删除 e2e_test_user
- TC-QUEUE-02 已恢复原始并发数

## 输出

- 测试结果统计：PASS/FAIL
- 截图文件：`test-results/model-*.png`, `test-results/download-*.png`, `test-results/queue-*.png`, `test-results/users-*.png`, `test-results/sub-setting-*.png`
