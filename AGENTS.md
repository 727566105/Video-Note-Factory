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

## 目录结构

- `backend/` — FastAPI + SQLAlchemy + SQLite，入口 `main.py`（uvicorn，端口 `BACKEND_PORT`，默认 8483）
  - `app/routers/` — API 路由层（REST，挂在 `/api` 下）
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
- **配置导入**：`_is_placeholder` 只认 `********`（导出脱敏占位符）为假值；`sk-test` 是系统内置 provider 默认 key，应忠实导入，不要当占位符跳过。

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

## 敏感区域改动前必读

- 改 `path_helper.py` 目录命名/查找逻辑 → 影响所有笔记媒体定位，先看现有自愈合测试
- 改备份/恢复 → 看 `tests/test_backup_import.py` + `tests/test_webdav_cleanup.py` + `tests/test_webdav_hardening.py`（含 zip-slip 安全回归）
- 改笔记分享 → 看 `tests/test_note_share.py`（跨用户权限 + 冲突解决）
- 改 `SettingLayout.tsx` 分组结构 → 需同步检查 `App.tsx` 路由是否存在
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

## status.json 归属校验（防张冠李戴）

- **写 status.json 时必带 task_id**：`NoteGenerator._update_status`（`services/note.py`）写入时带 `task_id` 字段，供读取时做归属校验。
- **读取时校验 task_id 归属**：`/api/tasks`（`note.py` 的 `get_tasks`）和 `/api/task_status/{task_id}`（`note.py`）读 status.json 时，若 `file_task_id != current_task_id` 且状态为 FAILED，**忽略旧状态**（回退到 PENDING/实时队列/数据库推断）。
- **只对 FAILED 状态生效**：现有 SUCCESS 任务的旧 status.json 无 task_id 字段，校验规则不能影响它们（否则会破坏所有成功任务的状态显示）。
- **`find_note_file` 自愈合扫描的风险**：自愈合按 `video_id_` 前缀扫描，可能找到**其他 task_id 的旧 status.json**（比如 6-28 的失败任务遗留的 status.json 被 7-20 的新任务扫描到）。归属校验是兜底防护。
- **前端轮询接口是 status.json 张冠李戴的真凶**：`useTaskPolling`（`hooks/useTaskPolling.ts`）每 3 秒调 `/api/task_status/{task_id}` 单查活跃任务状态。这个接口读 status.json 时也必须做归属校验，否则会用旧 status 覆盖 `loadTasksFromBackend` 返回的最新状态。
- **前端 taskStore 合并逻辑**：`loadTasksFromBackend`（`store/taskStore/index.ts`）的合并策略 - 本地过时 FAILED/PENDING **不能覆盖**后端最新状态。只有本地是活跃态（PROCESSING/QUEUED 等）且后端也是活跃态时才保留本地（轮询更实时）。

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

## 抖音 URL 解析（关键 gotcha）

- **搜索页 URL**：抖音搜索页是 `https://www.douyin.com/search/xxx?modal_id=7621100275181771880&type=general`，真正的 video_id 在 `modal_id` 查询参数里，**不在路径里**。
- **`url_parser.py` 抖音分支**：先匹配 `/(?:video|note)/(\d+)`，匹配不到再兜底 `r'[?&]modal_id=(\d+)'`。
- **`douyin_downloader.extract_video_id`**：同样有 modal_id 兜底。**注意 `find_url` 正则不含 `?&=` 字符，会截断查询参数**，所以必须保留 `original_url`，head 请求失败时用原始 URL 兜底匹配 patterns。
- **video_id 兜底**：`generate_note` 路由在 URL 解析失败时用 `task_id` 作为 `effective_video_id`（避免 DB 记录创建失败），但这会导致复用检查失效（不同任务的 video_id 都是各自 UUID）。

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
