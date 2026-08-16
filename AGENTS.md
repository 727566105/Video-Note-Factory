<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# VideoNote 项目指南

AI 视频笔记工具：导入音视频链接/文件，自动转写、总结、截图，生成结构化笔记。前后端分离 + Docker 部署。

## 交互规范

- **称呼**：每次回复以「大洋仔」开头。
- **编码前置**：复杂任务先建议进入 Plan 模式规划；Plan 模式下仅编写 plan 文件，等待用户确认后再执行。
- **任务分解**：任务复杂度高（多文件、多步骤、跨模块，不限文件数量）时，由模型自行判断并使用 TodoWrite 拆解为子任务并列出计划，在关键节点与用户确认，不逐一打断。
- **任务闭环**：完成后给出极简总结，格式：1. 变更点（列出本次改动要点）。
- **Bug 修复**：调用 systematic-debugging 技能；能用单测覆盖的逻辑遵循 TDD 原则，UI/联调场景用实测验证。
- **新需求**：用户提出新需求且方案不明确时，调用 brainstorming 技能；简单需求直接实现。
- **代码后置**：编写完成后列出风险点和建议测试用例。
- **功能验证**：使用配置好的 CLI 工具 ego-browser 测试前端，根据报错信息定位并修复问题，确保测试通过；必要时先说明 ego-browser 的具体操作步骤和配置方法。
- **识图需求**：遇到识别截图、图片、图表、流程图等识图需求时，自动启用 visionpower skill 进行识别。
- **规则持久化**：被用户纠正后先区分层级——个人偏好或会话经验写入本机 memory（`~/.zcode/cli/memories/`），项目通用规则才合并去重写入 AGENTS.md。

## 目录结构

- `backend/` — FastAPI + SQLAlchemy + SQLite，入口 `main.py`（uvicorn，端口 `BACKEND_PORT`，默认 8483）
  - `app/routers/` — API 路由层（REST，挂在 `/api` 下）
  - `app/auth/` — 鉴权（`jwt_handler.py` JWT、`dependencies.py` 依赖注入/权限、`captcha.py` 图形验证码、`rate_limiter.py` 登录限流，见下方防护 gotcha）
  - `app/services/` — 业务逻辑（`task_queue.py` 任务队列、`config_export.py` 配置导入导出、`webdav_backup.py` 备份/恢复、`note_share.py` 笔记跨用户分享）
  - `app/db/` — 数据访问层（`engine.py` 引擎，`*_dao.py` 各 DAO）+ SQLAlchemy 模型 `app/models/`
  - `app/utils/path_helper.py` — **三级/四级目录命名 + 笔记文件查找（核心，见下方 gotcha）**
  - `app/transcriber/` — 转写提供器（fast-whisper/bcut/mlx 等），单例缓存 + 锁保护
  - `app/downloaders/` — 各平台下载器（douyin/xiaohongshu/bilibili/youtube/kuaishou/cctv/local）
  - `app/mcp_server.py` — MCP Server（Streamable HTTP，路径 `/mcp`，静态 Bearer Token 鉴权）
  - `app/tasks/scheduler.py` — APScheduler 定时任务（备份/缓存清理/_pending 清理/心跳看门狗）
  - `tests/` — pytest（含 `conftest.py`）
- `videoNote_frontend/` — React 19 + Vite + TypeScript + **Tailwind CSS v4 + shadcn/ui (Radix) + Zustand**（antd 仍有残留引用，新组件统一用 shadcn/ui），端口 `VITE_FRONTEND_PORT`（默认 3015）
  - `src/layouts/SettingLayout.tsx` — 设置页侧边栏分组配置（`settingGroups` 数组），4 个分组：账号与工作区 / 基础数据设置 / AI 与处理 / 系统管理
  - `src/store/` — Zustand store（`configStore` 带 persist 中间件，持久化视图模式等偏好到 localStorage）
  - API 通过 `src/utils/request.ts`（axios）→ `/api` 前缀；base URL 由 `VITE_API_BASE_URL` 配置
- `data/` — 运行时数据（`video_note.db` + `video/{platform}/{author}/{video}/` 笔记/媒体）
- `deploy.sh` / `deploy.local.sh` / `restart.sh` / `stop.sh` — 部署/重启/停止脚本（`stop.sh` 同时处理 Docker 容器和本地进程）
- `Dockerfile` — 多阶段构建（前端 pnpm build → nginx 静态文件 + 后端 Python），镜像 `dick86114/videonote:dev3.0`
- `.env` / `.env.example` / `.env.low-spec.example` — 环境变量配置
- `browser-extension/` - Chrome MV3 扩展（popup + options + background service_worker），与后端通过 `/api` 通信
  - `manifest.json` - MV3 配置，6 平台 host_permissions，版本号改动后需重打 zip
  - `popup/` + `options/` - 普通 HTML + 内联 CSS + 原生 JS（无框架）
  - `background/service_worker.js` - API 代理（绕 CORS + 注入 Bearer + 12s 超时）
  - `icons/` - 16/48/128px 三尺寸 logo（与主应用 logo.png 同源）
- `videoNote_android/` - Android 移动端（Jetpack Compose + Kotlin，minSdk 31 / targetSdk 35）
  - 模块化：`app/`（入口 + 导航 + DI）+ `core/{common,network,designsystem}` + `feature/{auth,home,notelist,notedetail,feed,settings}`
  - `app/src/main/java/com/videonote/android/` - `MainActivity.kt`、`VideoNoteApp.kt`（`@HiltAndroidApp`）、`navigation/{AppNavHost.kt, Routes.kt, MainViewModel.kt}`、`di/{NetworkModule.kt, CoilModule.kt}`
  - `core/network/` - Retrofit API + DTO + `SessionManager` + 拦截器（`AuthInterceptor`/`BaseUrlInterceptor`），不依赖 Compose
  - `core/common/` - `EncryptedDataStore`（token/serverUrl 持久化）+ `ImageProxyHelper`（图片代理 URL）+ `SessionRepository`（启动恢复）
  - `core/designsystem/` - xAI 暗色主题（`Color.kt`/`Theme.kt`/`Type.kt`/`VNComponents.kt`）：零圆角、等宽字体、白底深字 CTA、平台色点为唯一彩色
  - `feature/*/` - 每个特性模块自带 `Screen.kt`（Composable）+ `ViewModel.kt`（`@HiltViewModel`）+ `Repository.kt`（`@Singleton`）

## 常用命令

```bash
# 后端（从 backend/ 运行）
../.venv/bin/python main.py                         # 启动（venv 在仓库根 .venv/）
../.venv/bin/python -m pytest tests/                # 全量测试
../.venv/bin/python -m pytest tests/test_xxx.py -v -s  # 单文件 + 打印

# 前端（从 videoNote_frontend/ 运行）
pnpm dev                          # 开发服务器（HMR，读源码，端口 3015）
pnpm build                        # 构建
pnpm lint                         # eslint
pnpm test                         # vitest 单测
pnpm test:e2e                     # playwright e2e
npx tsc --noEmit                  # TypeScript 类型检查（改完 ts/tsx 必跑）

# Android（从 videoNote_android/ 运行）
./gradlew :app:assembleDebug              # 构建 debug APK（产物 app/build/outputs/apk/debug/app-debug.apk）
./gradlew :app:assembleDebug --rerun-tasks  # 强制重编译（增量有时不识别 DTO 改动）
./gradlew :app:assembleRelease            # 构建 release APK
# 注：目前 Android 端无单元测试，改完 DTO/Serializer 后建议手动跑模拟器验证

# Docker 部署（生产模式，nginx 静态文件，无 HMR）
./deploy.sh                       # 拉镜像 + 启动容器
./stop.sh                         # 停止 Docker 容器 + 本地进程
./restart.sh                      # 重启
```

注意：venv 在**仓库根** `.venv/`，不是 `backend/venv/`。前端必须 `cd videoNote_frontend` 再跑 pnpm。`pnpm dev`（开发模式）和 Docker（生产模式）**共用 3015 端口**，不能同时运行。

## 架构边界

- **路由层只编排**：参数校验 + 调 service + 用 `ResponseWrapper`（`app/utils/response.py`）返回 `{code,msg,data}`。业务逻辑放 service/DAO。
- **DAO 层不返回 JSON**：返回 ORM 对象或原始数据，序列化在路由层。
- **路径管理统一走 `path_helper.py`**：不要在业务代码里手拼 `data/video/...` 路径，用 `get_video_folder` / `find_note_file` / `sanitize_path_name` 等。
- **数据库替换 SQLite 文件前必须 `engine.dispose()`**（释放连接池），否则 Windows/文件锁导致写入失败。
- **前端设置页导航**：新增/调整设置子页面需要同时改三处 — `App.tsx`（路由）+ `SettingLayout.tsx`（`settingGroups` 数组）+ 新页面组件。设置页偏好（视图模式等）用 Zustand `configStore` + persist 持久化，不要用 `useState`（页面切换会丢）。
- **Android 模块依赖方向**：`feature/*` → `core/{common,network,designsystem}` → `core/network`（最底层）。`core/network` **禁止**依赖 Compose 或 `core/common`（会循环依赖）。需要 Compose 的工具放 `core/common`（已加 `kotlin.compose` plugin + `compose-bom`）。
- **Android 分层**：`Screen.kt`（Composable，纯 UI）→ `ViewModel.kt`（`@HiltViewModel`，状态管理）→ `Repository.kt`（`@Singleton`，网络/数据）。Composable 不直接调 Repository，ViewModel 不直接调 API。

## 关键 gotcha

- **文件名按 UTF-8 字节算，不是字符**：Linux 单文件名上限 255 **字节**。`sanitize_path_name(name, max_length=200)` 按字节截断并在字符边界安全切分。改目录命名逻辑务必保持字节语义。
- **笔记目录结构**：`data/video/{platform}/{author_id}_{author_name}/{video_id}_{title}/`，内含 `note.md`、`note_{user_id}.json`、`status.json`、`cover.jpg`、`image_*.jpg`、`screenshots/`。
- **自愈合查找**：`find_note_file` / `get_video_folder` 在精确目录不存在时，按 `{video_id}_` / `{author_id}_` 前缀扫描已有目录复用（兼容旧整机包截断点不一致）。新增路径查找逻辑要保留这层兜底。
- **导入整机包**：`_safe_extract_all` 逐文件解压 + 超长路径段截断 + zip-slip 防护（拒绝 `..`/绝对路径 + resolve 校验）。不要换回 `zipfile.extractall`。
- **备份/恢复全局状态**：`_restore_in_progress` 等模块级变量，`main.py` lifespan 启动时调 `reset_stale_backup_state()` 自愈重置（防进程被 kill 卡死）。
- **备份锁由调用方管理（防再犯导出 100% 失败 bug）**：`acquire_backup_lock`/`release_backup_lock`（`webdav_backup.py`，双标志 `_backup_in_progress`/`_restore_in_progress` 原子检查+置位）由**调用方**负责获取/释放--路由层 `_run_backup_async` 的 finally 释放、定时任务 `backup_job` 也要 acquire/release。`create_backup` 内部**不做**锁自检也不清锁标志（曾因冗余自检与锁标志冲突导致「导出整机包」100% 失败）。
- **备份下载仅管理员**：`GET /api/webdav/backup/download/{filename}` 用 `require_admin`--整机包内含 `downloader.json`（cookie 明文值），不能让普通用户下载提取。相关测试 `test_backup.py` 的 dependency_overrides 需覆盖 `require_admin` 而非 `get_current_user_flexible`。
- **配置导入**：`_is_placeholder` 只认 `********`（导出脱敏占位符）为假值；`sk-test` 是系统内置 provider 默认 key，应忠实导入，不要当占位符跳过。
- **前端单测（vitest + jsdom）**：组件测试用 `vitest.config.ts`（jsdom 环境），**必须配 `environmentOptions.jsdom.url`**，否则 `window.localStorage` 为 undefined。`src/test/setup.ts` 里 polyfill 了 localStorage/ResizeObserver —— 原因是 **Node 26 实验性 `localStorage`（未传 `--localstorage-file` 时为 undefined）会遮蔽 jsdom 的**，组件/测试直接读 `localStorage` 会静默失败。新增组件测试若报 `localStorage is not defined`/`ResizeObserver is not defined`，先在 setup.ts 兜底。login-form 的 localStorage 读写走 `safeLocalGet/Set/Remove`（try/catch，隐私模式不崩溃）。
- **登录/7天免登录鉴权链路**：勾选「7天免登录」→ 前端 `request.post('/auth/login', {remember_me:true})` → 后端才签发 **7 天有效 refresh_token**（不勾选则无）；access token 24h 过期后，`request.ts` 响应拦截器对 401 自动调 `/auth/refresh` 换新 access token（带并发锁，多请求只刷新一次），refresh_token 失效则登出跳 `/login`。改密码后旧 refresh token 被 `ensure_token_not_revoked` 吊销 → `/auth/refresh` 返回 **401**（务必 catch `JWTError`，否则变 500）。后端相关测试见 `tests/test_auth_refresh.py` / `test_auth_ratelimit.py`。
- **登录暴力破解防护（验证码 + 限流 + 持久化）**：渐进式图形验证码，`app/auth/captcha.py` 的 `CaptchaManager`（内存 + 锁）用 Pillow 生成自托管验证码（`GET /api/auth/captcha` 返回 `{captcha_id, image_base64}`）；`verify` **一次性**（校验后 pop 删，防重放）+ 过期失效（TTL 300s）。⚠️ **存储有界**：`_store` 有 `max_size`（默认 10000），`generate` 超限时淘汰最旧（dict 插入序首个），防攻击者高频刷接口撑爆内存（`CAPTCHA_MAX_SIZE`）。`login` 在 `failure_count() >= CAPTCHA_REQUIRED_FAILURES(=2)` **且 `client=="web"`** 时要求验证码，验证码缺失/错误返回 `R.error(code=428, data={captcha_id, image})`（HTTP 200，**不计入**登录失败计数），前端 `login-form.tsx` 靠 `code===428 && data.captcha_id` 显示验证码 + 「换一张」。⚠️ **验证码门仅对 web 强制**：`LoginRequest.client` 默认 `"web"`（防御优先）；插件(`options.js`)传 `client:'extension'`、Android(`LoginRequest(client="android")`)跳过验证码门（仍受 429 锁定保护），避免跨客户端共享 `username+IP` 失败计数时把无法渲染验证码的客户端锁死。⚠️ **HTTP 状态码区分**：凭据错误走 `HTTPException(401)`（真 HTTP 401，body 是 `{detail}` 无 `code`）；428 验证码要求是 `R.error`（HTTP 200 + body `{code:428}`）。⚠️ **限流与验证码共存**：`LoginRateLimiter`（5 次 → 429 锁 10 分钟）在验证码检查**之前**；验证码门挡住凭据错误，单纯连错到不了 5 次，必须「过了验证码 + 密码仍错」才累加到锁定。**跨重启持久化**：全局单例 `login_rate_limiter = LoginRateLimiter(persist=True)`，失败/清零写穿到 `login_failures` 表（`app/db/login_failure_dao.py`），`main.py` lifespan 在 `init_db()` 后调 `load_from_db()` 恢复锁定（防重启绕过）。⚠️ **并发正确性**：`record_failure`/`record_success` 的 DB 写穿放在 `self._lock` **内部**（与内存更新同锁串行化），否则并发下 DB 是最后写入者、持久化计数偏低；`increment` 用 SQLite 原子 upsert（`INSERT ... ON CONFLICT DO UPDATE`），非 SQLite 方言回退查改。`LoginRateLimiter` 默认 `persist=False` 保持纯内存（单测可直接构造）；DB 写失败只记日志、降级回纯内存、不阻断登录。测试见 `tests/test_captcha.py` / `test_auth_captcha_login.py` / `test_login_failure_persistence.py`。

### Android 端关键 gotcha

- **DTO 字段必须与后端真实返回对齐**：`core/network/dto/*.kt` 的字段名/类型必须用 curl 拉真实 API 响应对照。`ignoreUnknownKeys=true` 只保护「后端多返回字段」，**不保护**「字段缺失」或「类型不符」。
  - 无默认值的非空字段（如 `val title: String`）若后端不返回，会抛 `MissingFieldException` 整个列表加载失败
  - 类型不符（后端 int/float/bool，DTO 写 String/Boolean）会抛 `JsonDecodingException`
  - 修复套路：所有 DTO 字段尽量带默认值；类型不固定时用 `CompatSerializers.kt` 里的 `AnyToStringSerializer` / `AnyToIntSerializer` / `AnyToBooleanStrictSerializer`
- **`hiltViewModel()` 只能注入 `@HiltViewModel` 类**：继承 `ViewModel` 的才能用。普通 `@Singleton class` 用 `hiltViewModel()` 会抛 `ClassCastException`。需要在 Composable 中拿 `@Singleton` 实例时用 `@EntryPoint` + `EntryPointAccessors.fromApplication`，参考 `core/common/ImageProxyHelper.kt` 的 `rememberImageProxyHelper()`。
- **type-safe 路由比较用 `qualifiedName`**：`currentDestination.route` 是全限定类名（如 `com.videonote.android.navigation.Route.Home`，**用点号分隔**不是 `$`）。比较 active tab 时必须用 `dest.route == item.route::class.qualifiedName`，**不能**用 `simpleName`（"Home"）比较，否则永远 false，底栏不渲染 / 高亮不亮。
  - 注意：带参数的路由（如 `Route.NoteDetail(taskId)`）的 `destination.route` 是 `...Route.NoteDetail/{taskId}`，与 `qualifiedName` 不等，所以带参路由不能用作底部 tab。
- **后端字段类型不稳定的重灾区**（实测）：
  - `duration` 可能是 `float` 秒数 / `string "mm:ss"` / `null` -> DTO 用 `String?` + `AnyToStringSerializer`，UI 用 `String?.formatDuration()`（`core/network/dto/DurationFormatter.kt`）格式化
  - `enabled` / `is_read` / `is_shared` 后端是 `int(0/1)`，DTO 用 `AnyToBooleanStrictSerializer`
  - `id` 后端有时是 `int` 有时是 `string(UUID)`，DTO 统一用 `String?` + `AnyToStringSerializer`
  - 后端字段名变化：`note_count`->`item_count`、`tasks`->`items`、`video_url`->`content_url`、`author`->`channel_name`、`avatar`->`avatar_url`、`name`->`model_name`。DTO 同时保留两个别名 + `effective*` 属性统一接口
- **`/api/feed` 直接返回数组**（不是 `{items:[...]}`），`FeedApi.getFeed` 返回类型是 `ApiResponse<List<FeedItem>>` 不是 `ApiResponse<FeedListResponse>`。其他列表 API（`/api/tasks`/`/api/collections`/`/api/subscriptions`/`/api/model_list`）都是 `{items: [...]}` 或 `{tasks: [...]}` 对象包数组，注意区分。
- **Json 配置**（`app/di/NetworkModule.kt`）：`ignoreUnknownKeys=true` + `coerceInputValues=true`（只处理显式 null）+ `explicitNulls=false` + `encodeDefaults=true`。改 Json 配置会影响所有 DTO 反序列化行为。
- **模拟器访问本机后端**：用 `http://10.0.2.2:8483`（10.0.2.2 是 Android 模拟器到 host 的固定映射），**不要**用 `localhost` 或 `127.0.0.1`（指模拟器自身）。
- **重新编译 DTO 改动**：增量构建偶尔不识别 DTO 变化，改完 DTO/Serializer 跑 `./gradlew :app:assembleDebug --rerun-tasks` 强制重编译。
- **暗色主题是唯一主题**：`VideoNoteTheme` 的 SYSTEM/LIGHT 都映射到暗色 `XaiColorScheme`。零圆角（`RoundedCornerShape(0.dp)`，不用 `RectangleShape` - M3 Shapes 不接受）。平台色点是唯一允许的彩色，其余走白/灰透明度色阶。

## 合集（Library）模块

- **合集总结与单条笔记完全独立**：`SummarySettings` 组件按 `variant` 区分——`note`（笔记详情/快捷添加，全量：风格/语言/视频理解/格式/备注）vs `collection`（合集，**只显示「总结模式 + 备注」**）。总结模式（overview/comparison/timeline/mindmap/trajectory）是合集专属，后端对应 `collection.py` 的 `mode_prompts`（5 套不同结构的 prompt），笔记生成没有模式概念。新增模式枚举需同步：`SummarySettings` 的 `summaryModes` 数组 + `CollectionDetail` 的 mode 白名单 + `collection.py` 的 `mode_prompts`。
- **合集页布局**：`TrajectoryTimeline`（日期分组：M月D日节点 + 今天/昨天高亮 + 数量徽章 + 时刻红色）是合集内容的**唯一展示载体**（底部条目列表已删除）。trajectory 模式为左右布局：左时间轴可拖拽调宽（默认 420，范围 260-640，双击复位），右 `TrajectorySummaryCard` 分析报告。
- **编辑入口统一**：更多菜单「编辑合集」+ 标题旁 ⚙ 打开同一对话框 = 名称/描述 + 条目管理（↑↓ 排序/删除）+ 内嵌批量添加（`getTasks(100)` 拉笔记，过滤已存在项，勾选「添加选中」后 `addItems` 自动刷新即时出现）。无独立「批量添加」按钮/跳转。
- **⚠️ React 事件坑（P0 教训）**：`handleGenerate(mode?)` 这类带参 handler 绑定 `onClick` **必须用箭头函数 `() => handleGenerate()`**；直接 `onClick={handleGenerate}` 会把 MouseEvent 当 mode 参数传入，`generateSummary` 序列化 event 抛错 → 生成永远失败且只弹 toast（曾因此「重新总结/重新生成/立即总结」全失效）。
- **⚠️ generate_summary 事件循环坑（P0 教训）**：`POST /api/collections/{id}/generate_summary` 路由**必须用同步 `def`**（`routers/collection.py`）——service 内部是同步 LLM 网络调用（`gpt.summarize()` 阻塞 30-60s），若写成 `async def` 会阻塞整个 FastAPI 事件循环，**生成期间所有其他请求（任何合集的详情/列表）全部排队不响应**，前端表现为打开其他合集一直转圈。同步 def 由 FastAPI 放到线程池执行，事件循环保持空闲。回归测试 `tests/test_collection_blocking.py`（并发断言详情请求不被生成阻塞）。
- **collectionStore 并发防护架构（改此 store 必须保持）**：`collectionStore/index.ts` 三层机制防「全局详情被迟到请求污染」——① `detailRequestSeq` 递增序号，只有最新一次 `fetchDetail` 的响应能写 `currentDetail`/`loading`（乱序请求旧响应直接丢弃）；② `detailViewId` 记录用户当前查看的合集，内部刷新统一走 `refreshDetail(id)`，仅当 `id === detailViewId` 才刷新（生成/增删条目后后台刷新不会覆盖已切换的页面）；③ `generatingIds: Record<string, boolean>` 按合集隔离生成状态（A 生成中不影响 B 的按钮/文案），同合集入口 single-flight 防重复请求。页面侧 `CollectionDetail` 用 `detail = currentDetail?.id === id ? currentDetail : null` 做归属校验，切换合集加载期间只显示 loading。
- **博主画像统计口径 parity（改统计必看）**：后端 `_build_author_stats`（`services/collection.py`）与前端 `computeAuthorStats`（`components/AuthorStatsBar.tsx`）必须**同口径**（有 parity fixture 测试锁定）：时段桶半开区间 `凌晨(0-6)/上午(6-12)/下午(12-18)/晚上(18-24)`（注意是「晚上」不是「晚间」）；平台映射 `douyin→抖音/bilibili→B站/youtube→YouTube/xiaohongshu→小红书/kuaishou→快手/cctv→CCTV`（local 及未知保原值）；峰值日并列取**最早**日期；`duration` 非空即「视频」否则「图文/实况」；`created_at` 缺失计入 total 但跳过日期/时段统计；频率 `total / max(span_days/7, 1/7)` 保留 1 位小数。
- **快照与实时语义分层**：`item_count_at_generation` = **生成时完整合集条目数**（stale 提示「生成时 N 条，当前 M 条」用），而 prompt 统计基于**可用素材数**（有笔记文件的条目）——两者不同是正常设计，勿改同一。统计卡片条始终基于当前合集 items 实时计算（前端），LLM 文字结论是生成时快照。
- **trajectory 模式 = 博主画像分析**（五维：风格特征/内容偏好/发布规律/人设定位/个人特质，每维「1 句结论 + 2~4 条依据」+ 附创作轨迹要点；时间线降级为支撑素材）。旧 7 节人生轨迹总结兼容渲染：`TrajectorySummaryCard` 的 `getSectionKind` 新关键词（风格/偏好/发布规律/人设/特质/轨迹要点）**在前匹配**、旧关键词（画像/喜好/演变/最近动态/跨平台/主题演变）保留，改映射顺序不得破坏旧总结。

## 敏感区域改动前必读

- 改 `path_helper.py` 目录命名/查找逻辑 → 影响所有笔记媒体定位，先看现有自愈合测试
- 改 `clone_task_to_user` / `find_note_file` glob 回退 / `find_source_data` / 删除清理 → 看 `tests/test_multiuser_isolation.py`（`TestCrossUserReuse` / `TestGenerateNoteReuse` / `TestHardDelete` / `TestCleanupTaskFiles`，含幂等、跨用户隔离、引用计数回归）
- 改备份/恢复 → 看 `tests/test_backup_import.py` + `tests/test_webdav_cleanup.py` + `tests/test_webdav_hardening.py`（含 zip-slip 安全回归）
- 改笔记分享 → 看 `tests/test_note_share.py`（跨用户权限 + 冲突解决）
- 改 `SettingLayout.tsx` 分组结构 → 需同步检查 `App.tsx` 路由是否存在
- 改 `collectionStore` / 合集生成链路 → 保持并发防护三层机制（seq/detailViewId/generatingIds），看 `test_collection_blocking.py` + `collectionStore.test.ts` + `test_collection_profile_summary.py`（统计 parity）
- 改 Android DTO（`core/network/dto/*.kt`）→ 先用 curl 拉对应后端 API 真实返回，逐字段对照类型/字段名/是否缺失。无默认值的非空字段是高危（后端不返回就崩）。
- 改 Android 底部导航（`AppNavHost.kt` 的 `XaiBottomBar`）→ 注意 type-safe 路由必须用 `qualifiedName` 比较，带参路由不能用作 tab。
- `openspec/` — 架构/重大变更走 OpenSpec 提案流程（见文件顶部 managed block）
- 根 `CLAUDE.md` / `videoNote_frontend/CLAUDE.md` — 更详细的项目约定

## 删除逻辑（物理删除，非软删除）

- **用户删除即物理删除**：`POST /api/delete_task`（`note.py`）直接 `db.delete(task)` + 清理本地文件 + 清理关联数据，不再有 `deleted_at` 软删除标记。前端确认弹窗"此操作不可恢复"名副其实。
- **删除执行顺序**（符合外键约束，防孤儿数据）：
  1. 定位任务 + 权限校验（task_id 或 video_id+platform 两种入参；空入参返回 400）
  2. `_cleanup_task_relations(task_id, user_id)` - 清关联数据（**先于主表删除**）
  3. `hard_delete_task_by_user(task_id, user_id)` - 物理删 video_tasks 记录，返回被删 task 对象
  4. `_cleanup_task_files(task)` - 清本地文件（按引用计数决定是否 rmtree 整个视频目录）
  5. `task_queue.remove(task_id)` - 清任务队列
- **`hard_delete_task_by_user` 异常处理**：任务不存在返回 None（幂等）；数据库故障 **抛异常**（让调用方返回 500，不误报"删除成功"）。
- **跨用户共享视频目录**：多用户引用同一 `video_id` 时，只删当前用户的 `note_{user_id}.json` + `status.json`；`other_refs` 计数为 0 才 `rmtree` 整个视频目录（含媒体/截图/exports）。
- **关联数据清理带 user_id 过滤**：`collection_items` 通过 `join collections` 过滤 user_id，`feed_items` 用自带 user_id 字段。**防跨用户共享 task_id 时误删其他用户的合集/feed**（`clone_task_to_user` 会让多用户共享同一 task_id）。
- **`get_video_folder()` 有 mkdir 副作用**：删除文件时不要用它，改用 `get_video_folder_name()` + `get_author_folder_name()` + `_get_platform_dir()` + `VIDEO_DIR` 手动拼路径。
- **已移除的接口/字段**：`cleanup_deleted_tasks` 管理员清理接口（`config.py`）、`deleted_at` 字段（`video_tasks` 模型 + init_db 迁移）、`soft_delete_task`/`get_deleted_tasks`/`hard_delete_task` DAO 函数、前端"清理过期数据"按钮（`TaskQueue.tsx`）。旧库的 `deleted_at` 列保留但代码不再读写。
- **MCP 删除接口**：`mcp_server.py` 的 `delete_task` 也是物理删除，复用 `_cleanup_task_files` + `_cleanup_task_relations`。

## 跨用户复用（视频解析结果）

- **复用链路**（`generate_note` 路由 + `subscription_scheduler._auto_generate_notes`）：`find_matching_note`（同 video_id+platform，排除本人 + style 匹配）→ `find_completed_task_by_video` → `find_source_data` → 任一命中即 `clone_task_to_user` 复制任务给新用户，**不再重新下载/转写**，直接用已有媒体文件生成自己的笔记。
- **`clone_task_to_user` 必须生成新 UUID task_id**：`video_tasks.task_id` 是 UNIQUE 约束，多用户共享同一 task_id 会冲突。原 task_id 存 `source_task_id` 字段追踪起源；幂等（`source_task_id+user_id` 已存在则直接返回）。
- **`find_source_data` 的源数据定义**：transcript.json（音频/视频类型）**或** 视频目录含已下载媒体文件（图文/实况照片没有 transcript）——用 `find_note_file(status)` 定位目录（带自愈合），避免 author_name 不一致找不到。
- **`find_note_file` 跨用户 glob 回退**：四级目录和自愈合扫描两条路径，在 `note_{user_id}.json` 和 `note.json` 都缺失时，找目录下任意 `note_*.json`（如 note_2.json）复用展示。
- **复用后必须回写 feed_items.task_id**：`update_feed_item_task_by_content(content_id, platform, user_id, cloned.task_id)`，否则动态页「查看笔记」跳到已删除/不存在的旧 task_id。订阅自动生成（`subscription_scheduler.py`）复用后同样回写。
- **跨用户复用的删除语义**：多用户共享同一 video_id 时，`_cleanup_task_relations` 必须带 user_id 过滤（collection_items join collections、feed_items 自带 user_id），防误删他人关联数据。
- **平台无关**：所有平台（douyin/xiaohongshu/bilibili/youtube/kuaishou/cctv）都走同一链路，无平台分支；B 站图文同样有 article 类型。

## status.json 归属校验（防张冠李戴）

- **写 status.json 时必带 task_id**：`NoteGenerator._update_status`（`services/note.py`）写入时带 `task_id` 字段，供读取时做归属校验。
- **读取时校验 task_id 归属**：`/api/tasks`（`note.py` 的 `get_tasks`）和 `/api/task_status/{task_id}`（`note.py`）读 status.json 时，若 `file_task_id != current_task_id` 且状态为 FAILED，**忽略旧状态**（回退到 PENDING/实时队列/数据库推断）。
- **只对 FAILED 状态生效**：现有 SUCCESS 任务的旧 status.json 无 task_id 字段，校验规则不能影响它们（否则会破坏所有成功任务的状态显示）。
- **`find_note_file` 自愈合扫描的风险**：自愈合按 `video_id_` 前缀扫描，可能找到**其他 task_id 的旧 status.json**（比如 6-28 的失败任务遗留的 status.json 被 7-20 的新任务扫描到）。归属校验是兜底防护。
- **前端轮询接口是 status.json 张冠李戴的真凶**：`useTaskPolling`（`hooks/useTaskPolling.ts`）每 3 秒调 `/api/task_status/{task_id}` 单查活跃任务状态。这个接口读 status.json 时也必须做归属校验，否则会用旧 status 覆盖 `loadTasksFromBackend` 返回的最新状态。⚠️ 轮询的 task_status 用 **silent**（`X-Silent` 头，`get_task_status(id, true)`）：已删除/非当前用户任务返回 403 时静默 `dismissTask`，**不再弹"无权访问该任务" toast**（否则删除/跨用户任务会在批量删除后 3s 内误弹误导性提示）。删除任务（`NoteListPage`）成功后也要立即 `dismissTask` 已删任务，避免被轮询再次命中。
- **前端 taskStore 合并逻辑**：`loadTasksFromBackend`（`store/taskStore/index.ts`）的合并策略 - 本地过时 FAILED/PENDING **不能覆盖**后端最新状态。只有本地是活跃态（PROCESSING/QUEUED 等）且后端也是活跃态时才保留本地（轮询更实时）。
- **原作品删除但本地有笔记 → 仍显示**：`NoteDetailPage` 对 FAILED + 有本地内容（note 文件）的任务，照常渲染笔记 + 黄色 `StaleNoteBanner` 提示条（"原作品已被删除"），并**总是**调 `loadTasksFromBackend` 刷新（不依赖 localStorage 缓存，`useEffect` 依赖只留 `[id, loadTasksFromBackend]`）。

## 笔记保存的空 title bug（`save_note_to_file`）

- **位置**：`routers/note.py` 的 `save_note_to_file`（被 `run_note_task` 调用）。
- **原 bug**：图文笔记（article/live_photo）的 `NoteResult` 没有 `audio_meta`，走 elif 分支 `elif hasattr(note, 'title') and note.title:`。但**标题可能为空**（抖音返回空标题），`note.title=''` 判断为 False，跳过整个分支，导致 `video_id/author_id/platform` 全是 None。
- **后果**：`get_note_file_path_v2` 走 `author_id=None` 分支，写到 `_pending/{task_id}/note_1.json`。但 `_pending` 已被 `_cleanup_pending` 清理 -> **note.json 丢失，但 status.json 已先写成 SUCCESS**。结果：status 显示成功，笔记内容为空。
- **修复**：用 `video_id` 判断（`elif getattr(note, 'video_id', None):`），空标题也能正确提取字段。同时加 `result_path.parent.mkdir(parents=True, exist_ok=True)` 防御。

## 并发与任务队列（关键架构）

- **`TaskQueueManager`（`app/services/task_queue.py`）** 是全局单例，控制并发执行数（`MAX_CONCURRENT_TASKS` 默认 3）。所有方法用 `threading.RLock` 保护，`acquire` 有 task_id 去重（已在运行/排队的不重复入队），`release` 幂等（看门狗先释放后卡死线程不会重复拉起）。
- **心跳看门狗**：`NoteGenerator._check_cancelled` 每个阶段切换点调 `task_queue.update_heartbeat`，`scheduler.py` 每 5 分钟检查 `get_stale_tasks(900)`（15 分钟无心跳视为卡死），自动释放槽位 + 写 FAILED + 拉起下一个排队任务。改笔记生成流程时保持心跳调用。
- **重新生成防重**：`generate_note` 路由在 `acquire` 前检查 `task_queue.is_active(task_id)`，前端 `retryTask` 检查 task status 是否活跃态。
- **文件迁移**：`move_note_files_to_video_folder` 迁移列表必须包含 `cover.jpg`、`image_*.jpg`、`screenshots/`（否则 `_pending` 目录的媒体会被 `rmtree` 删掉）。
- **启动阻塞预热**：`main.py` 的 `await warm_up_transcriber_async(...)` 确保模型加载完后才接受请求（`_init_transcriber` 有锁防止并发重复加载模型）。

## 下载器规范（6 平台 + 本地）

- **封面统一走 `save_cover_to_video_dir`**：返回本地 API 路径 `/api/video_cover/{platform}/{author_id}/{video_id}`。下载失败时 `cover_url = None`，**绝不保留远程 CDN URL**（抖音/快手/小红书的签名 URL 会过期导致永久丢封面）。
- **图文笔记图片处理**：`note.py` 的 article/live_photo 分支先判断 `raw_info['images']` 是本地文件还是远程 URL — 本地文件直接 `shutil.copy2` 复用，远程 URL 才调 `DownloadHelper.download_file`。各下载器存的 images 类型不一致（抖音存本地路径，小红书图文存远程 URL）。
- **所有 `requests.get/post` 必须加 `timeout`**。无 timeout 的网络请求会永久阻塞后台线程，看门狗也救不回来。
- **抛 `ValueError`**，不抛裸 `Exception`（调用方靠异常类型做降级）。
- **生产代码禁止 `print()`**，用 `logger`（`from app.utils.logger import get_logger`）。
- **cookie 为空时不设 Cookie header**（否则传字面 "None" 给 requests）。
- **支持平台**：抖音(douyin)、小红书(xiaohongshu)、B站(bilibili, yt-dlp)、YouTube(yt-dlp)、快手(kuaishou)、CCTV、本地文件(local/local_audio)。每个平台在 `app/downloaders/` 下有独立下载器。

## 浏览器插件（browser-extension/）

- **MV3 架构**：`manifest_version: 3`，`background/service_worker.js` 做 API 代理（绕 CORS + 注入 Bearer Token + 12s fetch 超时），popup/options 是普通 HTML + 内联 CSS + 原生 JS（无框架）。
- **chrome.storage.local 键名约定**：`videoNoteUrl` / `authToken` / `refreshToken` / `authUsername` / `authRole` / `defaultModel` / `defaultProviderId` / `defaultStyle` / `defaultFormat` / `defaultQuality` / `cookieStatus`。改键名会破坏向后兼容（用户需重新配置）。
- **`apiCall` 走 service worker 代理**：`chrome.runtime.sendMessage({type:'apiCall', url, options, token})`。有 1 次重试（service worker 冷启动）+ 20s 总超时兜底（避免 service worker 通道异常时 Promise 永久 pending）。
- **`apiCallWithAuth` 自动续期**：401 时用 `refreshToken` 调 `/api/auth/refresh` 换新 token 重试一次；refresh 也失效则清登录态 + 弹 authGate。
- **`setLoading`/`clearLoading` 模式**：`setLoading(btn, text)` 存 `btn.dataset.orig = 原始HTML`，`clearLoading` 还原。**连续 `setLoading` 不覆盖 orig**（只在 `!dataset.orig` 时存），否则 `clearLoading` 会还原成 spinner HTML（已踩坑，pushBtn 卡在"推送中"）。
- **Message 全局提示**：`showMessage(state, opts)` 浮在 popup 顶部（`position:absolute` + `z-index:50`），不进文档流不占位。`.message` 默认 `display:none`，`.show` 时 `display:flex`；显示需 `void el.offsetWidth` reflow 后加 `.show` class 触发 transition；消失需先移除 `.show` 触发淡出，200ms 后清 inline display。
- **打包**：改完代码用 `cd browser-extension && zip -rq ../videonote-helper-vX.Y.Z.zip manifest.json background/ popup/ options/ icons/`。zip 在仓库根，被 .gitignore（不入仓库）。
- **版本号**：`manifest.json` 的 `version` 字段，每次改动递增（用户重载插件能识别更新）。
- **Cookie 功能是管理员专属（三层防御，勿放开）**：后端 `update_downloader_cookie` / `test_downloader_cookie` / `get_downloader_cookie/{platform}`（`config.py`）均 `require_admin`（未登录 401、普通用户 403）；插件 `popup.js` 三层防御——`applyCookiePermission()` 隐藏非管理员的 Cookie Tab、localStorage 恢复 Tab 需 `authRole==='admin'`、`onPush()` 运行时独立 `getAuth()` 二次校验（`authRole` 缺失按非管理员 fail-closed）。**UI 不显示"推 Cookie 需管理员"类提示文案**（用户明确要求移除，普通用户直接看不到 Cookie 功能即可）；**登录前文案也不得提及 Cookie**（登录遮罩只说"提交笔记任务"，authGate 阶段无法区分角色，提及即向普通用户泄露功能存在）。`update_downloader_cookie` 有审计日志（记录 username/id/platform）。权限矩阵测试见 `tests/test_cookie_endpoint_auth.py`（401/403/200 + 输入边界）。

## 抖音 URL 解析（关键 gotcha）

- **搜索页 URL**：抖音搜索页是 `https://www.douyin.com/search/xxx?modal_id=7621100275181771880&type=general`，真正的 video_id 在 `modal_id` 查询参数里，**不在路径里**。
- **`url_parser.py` 抖音分支**：先匹配 `/(?:video|note)/(\d+)`，匹配不到再兜底 `r'[?&]modal_id=(\d+)'`。
- **`douyin_downloader.extract_video_id`**：同样有 modal_id 兜底。**注意 `find_url` 正则不含 `?&=` 字符，会截断查询参数**，所以必须保留 `original_url`，head 请求失败时用原始 URL 兜底匹配 patterns。
- **video_id 兜底**：`generate_note` 路由在 URL 解析失败时用 `task_id` 作为 `effective_video_id`（避免 DB 记录创建失败），但这会导致复用检查失效（不同任务的 video_id 都是各自 UUID）。
- **原作品被删/私密/审核中**：抖音 API 返回 `aweme_detail: null`（伴 `filter_detail` 字段）。`douyin_downloader.fetch_video_info` 优先读 `filter_detail` 的 `filter_reason/detail_msg/notice` 生成友好错误消息（不要暴露"缺少 aweme_detail"原始错误）。本地已有该视频笔记时，前端仍展示笔记 + 黄条提示原作品已删除（见 status.json 归属校验节）。

## LLM 错误归一化（`_normalize_error_message`）

- **位置**：`app/services/note.py` 的 `_normalize_error_message(raw)`，把 LLM SDK 异常转成用户友好提示。
- **严格匹配 HTTP 状态码**：`'401' in msg_lower` 这种宽松匹配会误判（如错误消息里含"401"数字的任务编号、video_id 都会被误判为 API Key 无效）。必须用 `'http 401'` / `'invalid_api_key'` / `'incorrect api key'` 等明确关键词。
- **分类关键词**：401(key 无效) / 403(权限) / 429(配额) / 5xx(服务异常) / timeout / connection。前端 `classifyError` 靠这些关键词分类，改归因逻辑要同步检查前端。
- **调用点**：`generate()` / `generate_from_transcript()` 的 `except Exception` 调用，写入 `status.json` 的 `message` 字段。

## 笔记风格/格式动态化

- **`GET /api/note_options`**（`config.py`）：返回 `{styles, formats}`，复用 `app.gpt.prompt_builder.note_styles` / `note_formats` 常量。后端改了常量，插件自动同步。用 `get_current_user`（普通用户可访问）。
- **后端 `style` 字段不枚举校验**：`note.py` 的 `VideoRequest.style: str = None`，任意字符串都能进 DB。`prompt_builder.note_styles` 只是 prompt 生成时参考的字典，不是校验枚举。所以插件传中文 label 不会 422，但 LLM 会用错风格模板（应传英文 value 如 `minimal`/`detailed`）。
- **`DownloadQuality` 枚举**（`app/enmus/note_enums.py`）：`fast`/`medium`/`slow`，**会校验**（`quality: DownloadQuality`）。插件必须传这三个值之一，否则 422。
- **`mcp_server.py` 的 `_VALID_QUALITIES`**：重复定义了 `{"fast", "medium", "slow"}`，与枚举不同步（技术债，后续应直接用枚举）。

## Android 端实况照片（Live Photo）保存方案（独家逆向）

### vivo OriginOS 实况照片机制（与 Google MotionPhoto 完全不同）

vivo 实况照片不是单文件（MotionPhoto），而是**双文件 + MediaStore `live_photo` 自定义隐藏列**：

1. **文件结构**：两份独立文件 `xxx.jpg`（静态图）+ `xxx.mp4`（实况视频），同目录同前缀
2. **MediaStore `live_photo` 字段**：图片和视频记录都要写，值必须完全相同
   - 格式：`<13位毫秒时间戳>000000000000000`（28 位，如 `1784565185491000000000000000`）
   - 只写图片不写视频 -> 相册显示 2 份独立文件；都写且值相同 -> 合并为 1 个实况照片
3. **写入坑**：`live_photo` 是隐藏列，`ContentValues.put("live_photo", ...)` 在 `insert` 时被过滤。必须先 insert + 写文件 + `IS_PENDING=0`，再用 `ContentResolver.update()` **单独**写入

### 各平台图片格式差异

- 小红书 `image_*.jpg`：标准 JPEG（FF D8 开头）
- 抖音 `image_*.jpg`：**实际是 WebP**（RIFF...WEBP），文件名 .jpg 但内容是 WebP

### 后端媒体 API

- `GET /api/note_media/{task_id}`（鉴权）：返回 `{content_type, images[], live_photos[{index, video_url}], cover_url}`
- `GET /api/note_media_file/{platform}/{author_id}/{video_id}/{filename}`（无鉴权 + Range）：图片/实况视频
- `GET /api/video_file/{platform}/{author_id}/{video_id}`（无鉴权 + Range）：视频原文件
- `images[i]` 与 `live_photos[j]` 按 `index` 配对（`live_photos[j].index` 对应 `image_{index}.jpg`，1-based）

### 适配其他厂商

- **OPPO**：可能也有类似的 `live_photo` 自定义列，调研方法：在真机上用抖音保存实况图 -> `adb shell content query --uri content://media/external/images/media` 查所有字段 -> 找自定义列
- **小米**：支持 Google MotionPhoto XMP 格式（GCamera:MicroVideoOffset）
- **华为**：有自己的 LivePhoto API

### 相关文件

- `core/common/media/MediaStoreSaver.kt` - `saveLivePhotoVivo()` 方法
- `core/common/media/MediaDownloader.kt` - `saveLivePhoto()` 编排
- `feature/notedetail/NoteDetailViewModel.kt` - `downloadLivePhoto()` 下载+保存
- 完整技术文档：`~/.zcode/cli/memories/projects/videonote-9e923298f7f309f5/topics/vivo-live-photo-spec.md`
