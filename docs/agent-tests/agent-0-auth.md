# Agent-0: 认证与预置状态测试

> Phase 1 串行执行，必须最先完成。
> isolatedContext: "agent-0"

## 测试用例

- TC-AUTH-01: 正常登录（admin）
- TC-AUTH-02: 登录失败 — 错误密码
- TC-AUTH-03: 登录失败 — 空字段
- TC-AUTH-04: 未登录访问受保护路由
- TC-AUTH-05: 获取当前用户信息
- TC-AUTH-06: 修改密码 — 正常流程
- TC-AUTH-07: 修改密码 — 旧密码错误

## 执行步骤

### 1. 创建浏览器并测试未登录访问 (TC-AUTH-04)

```
mcp__chrome__new_page(url="http://localhost:3015/", isolatedContext="agent-0")
mcp__chrome__wait_for(["登录你的账户"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/auth-04-redirect.png")
```

验证：页面重定向到 `/login`，可见 "登录你的账户" 标题。

### 2. 测试空字段登录 (TC-AUTH-03)

```
mcp__chrome__take_snapshot()
# 找到用户名输入框 uid 和密码输入框 uid
# 不填写任何内容，直接点击登录按钮
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["请输入用户名和密码"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/auth-03-empty.png")
```

验证：显示 "请输入用户名和密码" 错误提示。

### 3. 测试错误密码登录 (TC-AUTH-02)

```
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "wrongpassword")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["用户名或密码错误"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/auth-02-wrong.png")
```

验证：显示 "用户名或密码错误" 错误提示。

### 4. 正常登录 admin (TC-AUTH-01)

```
# 清空并重新填写
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "123456")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["VideoNote", "快捷添加笔记"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/auth-01-success.png")
```

验证：页面跳转到 `/`，可见 "VideoNote" 标题和 "快捷添加笔记"。

### 5. 验证用户信息 (TC-AUTH-05)

```
mcp__chrome__evaluate_script(function="() => { const auth = JSON.parse(localStorage.getItem('auth-storage')); return auth?.state?.user; }")
```

验证：返回 `{ id: 1, username: "admin", role: "admin" }`。

### 6. 修改密码 — 旧密码错误 (TC-AUTH-07)

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/users")
mcp__chrome__wait_for(["用户管理"], timeout=10000)
mcp__chrome__take_snapshot()
# 找到修改密码区域
# 填写旧密码 wrongold，新密码 newpass123
mcp__chrome__fill(old_password_uid, "wrongold")
mcp__chrome__fill(new_password_uid, "newpass123")
mcp__chrome__click(change_password_submit_uid)
mcp__chrome__wait_for(["旧密码错误"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/auth-07-wrong-old.png")
```

验证：toast 提示 "旧密码错误"。

### 7. 修改密码 — 正常流程 (TC-AUTH-06)

```
# 填写正确旧密码
mcp__chrome__fill(old_password_uid, "123456")
mcp__chrome__fill(new_password_uid, "test123456")
mcp__chrome__fill(confirm_password_uid, "test123456")
mcp__chrome__click(change_password_submit_uid)
mcp__chrome__wait_for(["密码修改成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/auth-06-success.png")

# 验证新密码登录：清除 auth-storage
mcp__chrome__evaluate_script(function="() => { localStorage.removeItem('auth-storage'); }")
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/login")
mcp__chrome__wait_for(["登录你的账户"], timeout=5000)
mcp__chrome__take_snapshot()
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "test123456")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["VideoNote"], timeout=10000)

# 改回密码 123456
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/settings/users")
mcp__chrome__wait_for(["用户管理"], timeout=10000)
mcp__chrome__take_snapshot()
mcp__chrome__fill(old_password_uid, "test123456")
mcp__chrome__fill(new_password_uid, "123456")
mcp__chrome__fill(confirm_password_uid, "123456")
mcp__chrome__click(change_password_submit_uid)
mcp__chrome__wait_for(["密码修改成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/auth-06-restore.png")
```

验证：密码修改成功，新密码可登录，最终改回 123456。

## 输出

- 测试结果统计：PASS/FAIL
- 截图文件：`test-results/auth-*.png`
- 管理员已登录状态供后续 Agent 使用
