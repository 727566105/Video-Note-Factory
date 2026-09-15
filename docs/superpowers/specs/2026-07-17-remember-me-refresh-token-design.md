# 7天免登录 + 记住用户名 设计

## 背景

当前系统 JWT access token 24h 过期，过期后必须重新输入用户名密码。前端 token 存 localStorage 已持久化（关浏览器不丢），但 24h 后强制跳登录页。用户希望：

1. **记住用户名** — 登录页自动填充上次输入的用户名
2. **7天免登录** — 勾选后 7 天内不用重新输入密码（token 自动续期，用户无感知）
3. 未勾选时保持现状（24h 有效）

## 方案：Refresh Token 双令牌

### 令牌体系

| 令牌 | 过期时间 | 用途 | 存储位置 |
|------|----------|------|----------|
| access token | 24h（不变） | 访问所有 API | localStorage |
| refresh token | 7 天（仅勾选时签发） | 续期 access token | localStorage |

### 后端改动

#### `backend/app/auth/jwt_handler.py`

新增 `create_refresh_token(data, days=7)`：
- payload 加 `"type": "refresh"` 标记（区分 access token）
- 过期时间 7 天
- 签名密钥/算法与 access token 相同

新增 `decode_refresh_token(token)`：
- 验证签名 + 过期 + `"type" == "refresh"`
- 返回 `user_id`

access token 的 `create_access_token` / `decode_token` 不变，但 `decode_payload` 增加类型检查：拒绝 `"type": "refresh"` 的 token 直接访问 API。

#### `backend/app/routers/auth.py`

1. `LoginRequest` 新增 `remember_me: bool = False`

2. 登录成功返回：
   - `remember_me=False`：`{token, user}`（不变）
   - `remember_me=True`：`{token, refresh_token, user}`

3. 新增 `POST /auth/refresh`：
   - 请求体：`{refresh_token: str}`
   - 验证 refresh token → 签发新 access token（24h）
   - **不重新签发 refresh token**（固定 7 天上限，不可无限续期）
   - refresh token 无效/过期 → 401
   - 响应：`{token}`

### 前端改动

#### `src/store/authStore/index.ts`

- state 新增 `refresh_token: string | null`
- `setAuth(token, user, refresh_token?)` 接收可选 refresh token
- `logout()` 清除 refresh_token
- persist 的 `partialize` 确保 token + refresh_token 都持久化

#### `src/utils/request.ts`

响应拦截器 401 处理增强：
1. 检查是否有 refresh_token
2. 有 → 调 `POST /auth/refresh` 换新 access token
3. 更新 authStore 的 token
4. 重试原请求
5. 无 refresh_token 或刷新失败 → 走现有登出逻辑（logout + 跳转 /login）

**并发锁**：用 module 级 `isRefreshing` 标志 + 等待队列，防止多个 401 同时触发多次刷新。第一个 401 刷新时，后续 401 请求排队等待刷新完成后用新 token 重试。

#### `src/components/login-form.tsx`

新增两个 checkbox：

1. **"记住用户名"**（默认勾选）
   - 勾选：登录成功后存 `localStorage['remembered-username'] = username`
   - 不勾选：清除 `localStorage['remembered-username']`
   - 页面加载时从 localStorage 读取并填充用户名输入框

2. **"7天免登录"**（默认不勾选）
   - 勾选：登录请求带 `remember_me: true`
   - 不勾选：`remember_me: false`

### 数据流

```
正常登录（勾选7天免登录）
  → POST /auth/login {username, password, remember_me: true}
  → 返回 {token(24h), refresh_token(7d), user}
  → 前端存入 localStorage

第 1-24 小时：正常使用
  → 所有请求带 Authorization: Bearer <access_token>

第 24 小时：access token 过期
  → API 返回 401
  → 拦截器检测到 refresh_token
  → POST /auth/refresh {refresh_token}
  → 返回 {token}（新 24h access token）
  → 更新 store + 重试原请求（用户无感知）

第 7 天：refresh token 也过期
  → POST /auth/refresh 返回 401
  → 拦截器登出，跳转 /login

未勾选 7天免登录
  → POST /auth/login {remember_me: false}
  → 返回 {token(24h), user}（无 refresh_token）
  → 24h 后 401 → 拦截器无 refresh_token → 登出跳 /login
```

### 安全措施

1. **类型隔离**：refresh token 标记 `"type": "refresh"`，`get_current_user` 拒绝 refresh token 直接访问 API
2. **修改密码联动失效**：`password_changed_at` 更新后，access + refresh 同时失效（`ensure_token_not_revoked` 检查 `iat`）
3. **固定 7 天上限**：refresh 不签发新 refresh token，到 7 天必须重新登录
4. **登录限流不变**：`/auth/refresh` 不走登录限流（已认证的 refresh token），但无效 refresh token 的 401 响应不暴露用户是否存在

### 不涉及的范围

- 不改 access token 过期时间（保持 24h）
- 不改 CSRF 防护（仍用 Bearer header，非 Cookie）
- 不改用户管理逻辑（注册/改密码/角色）
- 不改 `get_current_user_flexible`（下载用 `?token=` 查询参数，保持不变）

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `backend/app/auth/jwt_handler.py` | 新增 create_refresh_token + decode_refresh_token + decode_payload 类型检查 |
| `backend/app/routers/auth.py` | LoginRequest 加 remember_me + 登录返回 refresh_token + 新增 /auth/refresh |
| `videoNote_frontend/src/store/authStore/index.ts` | state 加 refresh_token + setAuth/logout 更新 |
| `videoNote_frontend/src/utils/request.ts` | 401 拦截器加 refresh 逻辑 + 并发锁 |
| `videoNote_frontend/src/components/login-form.tsx` | 新增两个 checkbox + 记住用户名逻辑 |
