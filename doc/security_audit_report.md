# videoNote 项目安全审计报告

> 审计日期：2026-05-09

---

## 🔴 严重漏洞 (CRITICAL)

### 1. 多个 API 端点缺少认证保护

**风险**: 任何人都可以访问这些敏感接口，无需登录即可：
- 读取/修改 Cookie 配置
- 读取/修改 WebDAV 备份配置（包含密码）
- 读取/修改 AI 模型供应商配置（包含 API Key）
- 读取/修改思源笔记配置（包含 API Token）
- 执行 PDF 导出
- 修改任务队列配置
- 清理缓存

**受影响端点**:

| 路由文件 | 端点 | 敏感操作 |
|----------|------|----------|
| `backend/app/routers/config.py` | `/api/get_downloader_cookie/{platform}` | 读取 Cookie |
| `backend/app/routers/config.py` | `/api/update_downloader_cookie` | 写入 Cookie |
| `backend/app/routers/webdav.py` | `/api/config`, `/api/backup`, `/api/backups` | WebDAV 密码/备份操作 |
| `backend/app/routers/provider.py` | `/api/add_provider`, `/api/update_provider` | API Key 管理 |
| `backend/app/routers/model.py` | `/api/model_list`, `/api/models` | 模型管理 |
| `backend/app/routers/siyuan.py` | `/api/config`, `/api/notebooks` | Siyuan Token |
| `backend/app/routers/export.py` | `/api/pdf/{task_id}` | PDF 导出 |
| `backend/app/routers/note.py` | `/api/task_queue/status`, `/api/cache/clean` | 队列/缓存管理 |

**修复方案**: 所有上述端点需添加 `Depends(get_current_user)` 或 `Depends(require_admin)`。

```python
# 示例：provider.py
from app.auth.dependencies import get_current_user, require_admin

@router.post("/add_provider")
def add_provider(data: ProviderRequest, current_user=Depends(require_admin)):
    # 管理员才能添加供应商
```

---

### 2. JWT 密钥使用硬编码默认值

**文件**: `backend/app/auth/jwt_handler.py:5`

```python
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "videonote-secret-key-change-in-production")
```

**风险**: 如果部署时未设置 `JWT_SECRET_KEY` 环境变量，攻击者可以使用默认密钥伪造任意用户的 JWT Token。

**修复方案**:

```python
# jwt_handler.py
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY 环境变量必须设置，请参考 .env.example")
```

---

### 3. 默认管理员密码过于简单

**文件**: `backend/app/db/user_dao.py:131`

```python
password_hash=hash_password("123456"),
```

**风险**: 默认密码 `admin/123456` 极易被爆破，生产环境部署后若未修改将面临严重安全风险。

**修复方案**:

```python
# 方案一：随机生成密码
import secrets
import string
default_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
password_hash=hash_password(default_password)
logger.warning(f"首次启动，管理员密码已自动生成: {default_password}，请登录后立即修改")

# 方案二：强制首次登录修改
# 添加 password_changed_at 字段，首次登录检测是否为默认密码
```

---

## 🟠 高风险漏洞 (HIGH)

### 4. Siyuan API Token 明文存储

**文件**: `backend/app/db/siyuan_config_dao.py:22-43`

对比 WebDAV 密码使用 Fernet 加密存储，思源笔记的 `api_token` 直接明文写入数据库。

**风险**: 数据库泄露时，思源笔记 API Token 被直接暴露。

**修复方案**: 参考 `webdav_config_dao.py` 的加密方式，使用 Fernet 加密存储。

```python
# siyuan_config_dao.py
from cryptography.fernet import Fernet

ENCRYPTION_KEY = os.getenv('WEBDAV_ENCRYPTION_KEY')
# 复用 WebDAV 的加密密钥（或单独配置）
cipher_suite = Fernet(ENCRYPTION_KEY.encode())

# upsert_config 中加密 token
encrypted_token = cipher_suite.encrypt(api_token.encode()).decode()
config.api_token = encrypted_token

# 读取时解密
decrypted_token = cipher_suite.decrypt(config.api_token.encode()).decode()
```

---

### 5. WebDAV 加密密钥临时生成问题

**文件**: `backend/app/db/webdav_config_dao.py:11-16`

```python
ENCRYPTION_KEY = os.getenv('WEBDAV_ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    ENCRYPTION_KEY = Fernet.generate_key().decode()
    logger.warning("WEBDAV_ENCRYPTION_KEY not set, using temporary key")
```

**风险**: 未设置环境变量时，每次重启后端都会生成新密钥，导致之前加密的密码无法解密（用户需重新配置 WebDAV）。

**修复方案**: 启动时强制检查环境变量，未设置则抛出明确错误。

```python
ENCRYPTION_KEY = os.getenv('WEBDAV_ENCRYPTION_KEY')
if not ENCRYPTION_KEY:
    raise RuntimeError("WEBDAV_ENCRYPTION_KEY 环境变量必须设置，请参考 .env.example")
```

---

### 6. CORS 配置过于宽松

**文件**: `backend/main.py:87`

```python
allow_origin_regex=r"https?://.*|chrome-extension://.*",
```

**风险**: 允许任意 HTTP/HTTPS 来源访问 API，生产环境可能被恶意网站跨域调用。

**修复方案**: 生产环境通过环境变量配置允许的 origin。

```python
# 方案：ENV=production 时使用严格模式，开发模式宽松
ENV = os.getenv("ENV", "development")
if ENV == "production":
    # 生产模式：只允许配置的域名
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",")
    app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, ...)
else:
    # 开发模式：保持宽松
    app.add_middleware(CORSMiddleware, allow_origin_regex=r"https?://.*", ...)
```

---

## 🟡 中等风险 (MEDIUM)

### 7. 登录接口无速率限制

**文件**: `backend/app/routers/auth.py:41-58`

**风险**: `/api/login` 端点无速率限制，面临暴力破解攻击风险。

**修复方案**: 添加 IP/用户名级别的速率限制。

```bash
# 安装依赖
pip install fastapi-limiter
```

```python
# auth.py 中间件或依赖
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@router.post("/login")
@limiter.limit("5/minute")  # 每分钟最多 5 次
def login(req: LoginRequest):
```

---

### 8. 前端 Token 存储在 localStorage

**文件**: `videoNote_frontend/src/store/authStore/index.ts`

```typescript
persist(
    (set, get) => ({ ... }),
    { name: 'auth-storage' }
)
```

**风险**: localStorage 存储的 token 可被 XSS 攻击窃取（虽然项目当前无明显 XSS 漏洞，但风险存在）。

**修复方案**: 可考虑使用 httpOnly Cookie（需后端配合），或保持现状但确保无 XSS 漏洞。

---

### 9. 用户数据隔离审计

**文件**: `backend/app/routers/note.py:644`

```python
db_tasks = get_all_tasks(user_id=current_user.id, role=current_user.role, limit=limit)
```

**当前状态**: 实现正确，管理员可查看所有任务，普通用户只看自己的。但需确保所有 `get_current_user` 使用处一致。

---

## 🟢 已做得好的安全措施

| 项目 | 状态 | 说明 |
|------|------|------|
| **密码哈希** | ✅ | 使用 bcrypt (passlib) |
| **SQL 注入** | ✅ | SQLAlchemy ORM，无原始 SQL 拼接 |
| **路径遍历** | ✅ | 文件上传使用 UUID 重命名 (`note.py:90-107`) |
| **SSRF 防护** | ✅ | 图片代理有白名单 + 内网 IP 检查 (`note.py:469-516`) |
| **文件上传限制** | ✅ | 扩展名白名单 + 大小限制 100MB (`note.py:79-88`) |
| **错误信息** | ✅ | 不泄露堆栈，返回通用 "系统异常" |
| **WebDAV 密码加密** | ✅ | Fernet 加密（但密钥管理有问题） |
| **文件名安全** | ✅ | `sanitize_filename` 使用 UUID 生成 |
| **认证框架** | ✅ | JWT + HTTPBearer，架构合理 |

---

## 修复优先级总览

| 优先级 | 编号 | 问题 | 影响面 | 修复复杂度 |
|--------|------|------|--------|------------|
| **P0** | #1 | API 端点缺认证 | 所有配置/敏感数据可被任意访问 | 中（逐个端点加） |
| **P0** | #2 | JWT 默认密钥 | Token 可伪造 | 低（改 1 行） |
| **P0** | #3 | 默认密码 123456 | 管理员账号易被入侵 | 低（改几行） |
| **P1** | #4 | Siyuan Token 明文 | 数据库泄露风险 | 中（参考 webdav） |
| **P1** | #5 | WebDAV 密钥临时生成 | 服务重启后密码丢失 | 低（改 1 行） |
| **P2** | #6 | CORS 过宽 | 跨域攻击风险 | 低（加环境变量） |
| **P2** | #7 | 登录无速率限制 | 暴力破解风险 | 中（加依赖） |

---

## 快速修复检查清单

- [ ] #1 config.py 添加认证
- [ ] #1 webdav.py 添加认证
- [ ] #1 provider.py 添加认证
- [ ] #1 model.py 添加认证
- [ ] #1 siyuan.py 添加认证
- [ ] #1 export.py 添加认证
- [ ] #1 note.py 队列/缓存端点添加认证
- [ ] #2 JWT 密钥强制检查
- [ ] #3 默认密码改为随机生成
- [ ] #4 Siyuan Token 加密存储
- [ ] #5 WebDAV 密钥强制检查
- [ ] #6 CORS 环境变量配置
- [ ] #7 登录速率限制
