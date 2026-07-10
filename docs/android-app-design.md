# VideoNote Android App 设计方案

> 日期：2026-07-09
> 状态：已批准
> 分支：dev3.0

## 概述

为 VideoNote 项目开发 Android 原生移动端 App，技术栈 **Jetpack Compose + Kotlin**，最低支持 **Android 12 (API 31)**，复用现有 FastAPI 后端 API，全功能精简版（覆盖所有模块，每个模块只保留核心流程）。

---

## 1. 项目结构与构建配置

### 模块结构

```
videoNote_android/
├── app/                          # 主模块
│   ├── src/main/java/com/videonote/android/
│   │   ├── MainActivity.kt
│   │   ├── VideoNoteApp.kt          # Application class (@HiltAndroidApp)
│   │   ├── navigation/
│   │   │   ├── AppNavHost.kt        # 导航图
│   │   │   └── Routes.kt            # 类型安全路由定义
│   │   └── di/
│   │       ├── NetworkModule.kt     # Hilt: Retrofit, OkHttp
│   │       ├── DatabaseModule.kt    # Hilt: Room
│   │       └── RepositoryModule.kt  # Hilt: Repository 绑定
│   └── build.gradle.kts
├── core/
│   ├── designsystem/             # 主题、颜色、通用组件
│   ├── network/                  # Retrofit API interfaces + JWT interceptor + DTOs
│   ├── database/                 # Room DAO/Entity/Database
│   └── common/                   # 工具类、扩展函数
├── feature/
│   ├── auth/                     # 登录
│   ├── home/                     # 快速添加（链接/上传）
│   ├── notelist/                 # 笔记列表 + 收藏夹
│   ├── notedetail/               # 笔记详情
│   ├── feed/                     # 订阅动态
│   └── settings/                 # 设置
├── build.gradle.kts
├── settings.gradle.kts
└── gradle.properties
```

### 关键依赖

| 依赖 | 用途 |
|------|------|
| Jetpack Compose BOM 2024.12+ | UI 框架 |
| Navigation Compose | 类型安全路由 |
| Hilt | 依赖注入 |
| Retrofit + OkHttp | 网络请求 |
| Room | 本地缓存 |
| Coil | 图片加载 |
| DataStore (Encrypted) | Token/偏好存储 |
| Markmap 或类似 | 思维导图渲染 |
| ExoPlayer | 本地视频播放 |

### 构建配置

- minSdk: 31, targetSdk: 35, compileSdk: 35
- Kotlin 2.0+, Compose Compiler plugin

---

## 2. 核心用户流程

### 场景 1：首次使用（未登录）

```
App 启动 → 无 token → 登录页 → 输入用户名/密码 → POST /api/auth/login
→ 成功 → 保存 token 到 EncryptedDataStore → 跳转快速添加页
→ 失败 → 显示错误，留在登录页
```

登录页极简：Logo + 用户名 + 密码 + 登录按钮，无注册入口（用户由 Admin 创建）。

### 场景 2：已登录用户再次打开

```
App 启动 → 有 token → 验证未过期 → 直接进入快速添加页
→ 读取剪贴板 → 有 URL 且输入框为空 → 直接填入 URL 输入框
→ 自动识别平台 → 用户可直接点"生成笔记"
```

**剪贴板自动填入规则**：
- 输入框为空 + 剪贴板有 URL → 直接填入（零步操作）
- 输入框已有内容 + 剪贴板有 URL → 不覆盖
- `clipboardConsumed` 标记确保只自动填入一次
- 支持 `text/plain` 和 `text/x-uri` 两种剪贴板格式

**剪贴板自动填入关键代码模式**：

```kotlin
@Composable
fun QuickAddScreen() {
    val clipboardManager = LocalClipboardManager.current
    var urlInput by remember { mutableStateOf("") }
    var detectedPlatform by remember { mutableStateOf<Platform?>(null) }
    var clipboardConsumed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        if (urlInput.isEmpty() && !clipboardConsumed) {
            val clip = clipboardManager.primaryClip
            val url = extractVideoUrl(clip)
            if (url != null) {
                urlInput = url
                detectedPlatform = detectPlatform(url)
                clipboardConsumed = true
            }
        }
    }
    // URL input with clear button, platform auto-detect, etc.
}
```

---

## 3. 页面设计

### 3.1 快速添加页（首页，核心页面）

- 顶栏：App 名 + 用户头像菜单
- URL 输入框（自动检测平台，有清除按钮）
- 文件上传入口（折叠式）
- 笔记风格快速选择
- AI 模型选择
- "生成笔记"主 CTA 按钮
- 底部：最近任务状态实时显示（3 秒轮询 `GET /api/task_status/{task_id}`）
- 任务成功后显示"查看笔记"按钮

### 3.2 笔记列表页

- 顶部 Tab：`全部笔记` | `收藏夹`
- 全部笔记 Tab：平台筛选 chips（横向滚动）+ 搜索 + 卡片网格（每行 2 张）
- 卡片内容：封面图 + 标题（2 行省略）+ 作者 + 平台图标 + 相对时间
- 交互：点击→详情，长按→菜单（删除/导出/加入收藏夹），下拉刷新，滚动自动加载

### 3.3 笔记详情页（垂直滚动布局）

- 顶栏：返回 + 更多操作
- 封面图/视频播放区（YouTube 用 YouTube Player API / B站用 WebView 嵌入 / 本地文件用 ExoPlayer）
- 视频信息：标题 + 作者 + 订阅按钮 + 平台/时长/时间
- 4 Tab：摘要（Markdown 渲染）| 字幕（带时间轴）| 导图 | 原文（分段+截图）
- 底部操作栏：复制 | 导出 | 重做
- 处理中状态：进度条 + 步骤文字 + 取消按钮

### 3.4 导出功能

- 点击"导出"弹出 Bottom Sheet
- 始终可用：复制 Markdown、导出 PDF、导出图片
- 条件可用：导出到思源、导出到 Obsidian
- **动态显示策略**：加载时检查 `/siyuan/config` 和 `/obsidian/config`，只显示已配置且已启用的选项，未配置的不出现
- PDF/图片由服务端生成后下载

**导出动态菜单关键代码模式**：

```kotlin
@Composable
fun ExportSheet(noteId: String) {
    val siyuanConfig by siyuanConfigState
    val obsidianConfig by obsidianConfigState

    LaunchedEffect(Unit) {
        siyuanConfigState.load()   // GET /api/siyuan/config
        obsidianConfigState.load() // GET /api/obsidian/config
    }

    ExportOption("复制 Markdown", always = true)
    ExportOption("导出 PDF", always = true)
    ExportOption("导出图片", always = true)
    // 注意：后端 enabled 字段为 Int (0/1)，非 Boolean
    if (siyuanConfig?.enabled == 1) ExportOption("导出到思源笔记")
    if (obsidianConfig?.enabled == 1) ExportOption("导出到 Obsidian")
}
```

### 3.5 动态（Feed）页

- 顶栏：标题 + 全部已读 + 刷新
- 订阅频道横栏（头像+名称，最后一项"+"添加订阅）
- 未读计数提示
- 列表项三种状态：未读+未生成笔记 / 未读+已有笔记 / 已读+已有笔记
- 点击列表项 → Bottom Sheet 展开详情（封面大图+标题+简介+操作按钮）
- 操作：生成笔记 / 查看已有笔记 / 标记已读
- 左滑：标记已读 / 生成笔记

### 3.6 收藏夹（笔记列表页 Tab）

- 收藏夹列表：卡片式（名称+笔记数+更新时间）
- 新建收藏夹：名称+描述对话框
- 收藏夹详情：笔记列表 + AI 摘要 + 添加笔记按钮
- 添加笔记入口：笔记列表长按 / 笔记详情更多菜单
- 更多操作：编辑、生成摘要、删除

### 3.7 设置页（极简版）

- 用户信息卡片
- 修改密码
- 深色模式（开关）
- 系统健康检查
- 关于（版本+链接）
- 退出登录

**不包含**：笔记偏好、导出与同步配置、模型/Provider 管理、Cookie、用户管理、任务队列、配置导入导出

---

## 4. 导航结构

```
底部导航（4 Tab）
├── 🏠 首页（快速添加）
├── 📝 笔记（Tab: 全部笔记 | 收藏夹）
├── 📡 动态
└── ⚙️ 设置

独立页面
├── 登录页
├── 笔记详情页
└── 收藏夹详情页
```

---

## 5. 网络层设计

### JWT 认证

- OkHttp Interceptor 自动注入 `Authorization: Bearer <token>`
- 401 响应 → 清除本地 token → 跳转登录页
- Token 存储在 EncryptedDataStore

### API 响应处理

- 统一解包 `{code, msg, data}` 格式
- `code === 0` → 返回 `data`
- 非 0 → Toast 显示 `msg`

### 关键 API 对接

| 功能 | API |
|------|-----|
| 登录 | `POST /api/auth/login` |
| 当前用户 | `GET /api/auth/me` |
| 修改密码 | `PUT /api/auth/change-password` |
| 生成笔记 | `POST /api/generate_note` |
| 检查笔记是否已存在 | `POST /api/check_note_availability` |
| 文件上传 | `POST /api/upload` |
| 任务状态 | `GET /api/task_status/{task_id}` |
| 任务列表 | `GET /api/tasks` |
| 删除任务 | `POST /api/delete_task` |
| 取消任务 | `POST /api/cancel_task` |
| 笔记详情 | `GET /api/quick_view/{task_id}` |
| 笔记标签 | `PUT /api/notes/{task_id}/tags` |
| 动态列表 | `GET /api/feed` |
| 标记已读 | `PUT /api/feed/{item_id}/read` |
| 全部已读 | `PUT /api/feed/read-all` |
| 刷新动态 | `POST /api/feed/refresh` |
| 未读计数 | `GET /api/feed/unread-count` |
| 动态生成笔记 | `POST /api/feed/{item_id}/generate-note` |
| 订阅列表 | `GET /api/subscriptions` |
| 添加订阅 | `POST /api/subscriptions` |
| 删除订阅 | `DELETE /api/subscriptions/{id}` |
| 切换订阅 | `PUT /api/subscriptions/{id}/toggle` |
| 单订阅刷新 | `POST /api/subscriptions/{id}/refresh` |
| 刷新进度 | `GET /api/subscriptions/progress/{progress_id}` |
| 解析频道 URL | `POST /api/channels/parse-url` |
| 频道视频列表 | `GET /api/channels/{platform}/{platformId}/videos` |
| 收藏夹列表 | `GET /api/collections` |
| 创建收藏夹 | `POST /api/collections` |
| 收藏夹详情 | `GET /api/collections/{id}` |
| 更新收藏夹 | `PUT /api/collections/{id}` |
| 删除收藏夹 | `DELETE /api/collections/{id}` |
| 添加到收藏夹 | `POST /api/collections/{id}/items` |
| 移出收藏夹 | `DELETE /api/collections/{id}/items/{task_id}` |
| 生成摘要 | `POST /api/collections/{id}/generate_summary` |
| 收藏夹摘要 | `GET /api/collections/{id}/summary` |
| 收藏夹任务映射 | `GET /api/collections/task_map` |
| 导出 PDF | `GET /api/export/pdf/{task_id}` |
| 导出图片 | `GET /api/export/image/{task_id}` |
| 导出 HTML | `GET /api/export/html/{task_id}` |
| 导出 Word | `GET /api/export/docx/{task_id}` |
| 导出 EPUB | `GET /api/export/epub/{task_id}` |
| 思源导出 | `POST /api/siyuan/export/siyuan/{task_id}` |
| Obsidian 导出 | `POST /api/obsidian/export/obsidian/{task_id}` |
| 思源配置 | `GET /api/siyuan/config` |
| Obsidian 配置 | `GET /api/obsidian/config` |
| 模型列表 | `GET /api/model_list` |
| 按提供商模型列表 | `GET /api/model_list/{provider_id}` |
| 用户偏好 | `GET/PUT /api/user/preferences` |
| 图片代理 | `GET /api/image_proxy?url=...` |
| 系统健康 | `GET /api/health` |

---

## 6. 任务生命周期

后端任务状态流转：

```
PENDING → QUEUED → PARSING → DOWNLOADING → TRANSCRIBING → SUMMARIZING → SAVING → SUCCESS
```

任何阶段都可能进入 `FAILED` 或 `CANCELLED` 状态（用户主动取消时）。

移动端轮询策略：
- 生成笔记后立即开始轮询 `GET /api/task_status/{task_id}`
- 轮询间隔：3 秒
- 终止条件：状态为 `SUCCESS`、`FAILED` 或 `CANCELLED`
- 成功后显示"查看笔记"按钮
- 失败后显示错误信息 + "重试"按钮
- 取消后停止轮询，不显示额外操作

---

## 7. 支持平台

| 平台 | 标识 | URL 模式 | 短链/分享文本模式 |
|------|------|----------|-------------------|
| Bilibili | bilibili | bilibili.com/video/BV* | b23.tv/* |
| YouTube | youtube | youtube.com/watch* / youtu.be/* | — |
| 抖音 | douyin | douyin.com/video/* | v.douyin.com/* / 分享文本含"复制打开抖音"或"抖音" |
| 小红书 | xiaohongshu | xiaohongshu.com/* | xhslink.com/* |
| 快手 | kuaishou | kuaishou.com/* | v.kuaishou.com/* |
| 央视频 | cctv | cctv.com/* | — |
| 本地视频 | local | 文件上传 | — |
| 本地音频 | local_audio | 文件上传 | — |

---

## 8. 实现步骤

1. **项目脚手架**：创建 Android 项目，配置 Gradle、Hilt、Compose、Navigation
2. **core/network**：Retrofit + OkHttp + JWT Interceptor + API 接口定义
3. **core/designsystem**：主题、颜色、通用组件
4. **feature/auth**：登录页 + Token 管理
5. **feature/home**：快速添加页 + 剪贴板检测 + 任务轮询
6. **feature/notelist**：笔记列表 + 收藏夹 Tab
7. **feature/notedetail**：笔记详情 + 4 Tab + 导出
8. **feature/feed**：动态列表 + 频道管理 + 添加订阅
9. **feature/settings**：设置页（极简版）
10. **集成测试 + 优化**：端到端测试、性能优化、深色模式适配

---

## 9. 实现注意事项

### 剪贴板隐私（Android 12+）

- Android 12 (API 31)：`ClipboardManager.getText()` 仍可正常调用
- Android 13+ (API 33)：系统会在 App 读取剪贴板时自动显示 Toast 提示用户，无需额外处理
- 使用 `ClipboardManager.OnPrimaryClipChangedListener` 监听变化比主动轮询更友好
- `clipboardConsumed` 标记确保只自动填入一次，避免重复读取

### API 双重错误格式

后端返回两种错误格式，移动端需同时处理：

1. **业务错误**：HTTP 200 + `{code: 非0, msg: "错误信息", data: null}` → Toast 显示 `msg`
2. **HTTP 错误**：HTTP 4xx/5xx + `{detail: "错误信息"}` → Toast 显示 `detail`

网络层 Interceptor 应统一处理这两种格式。

### `generate_note` 请求体关键字段

```json
{
  "video_url": "https://...",
  "platform": "bilibili",
  "smart_mode": true,
  "model_name": "gpt-4o-mini",
  "provider_id": 1,
  "style": "detailed",
  "output_language": "zh",
  "format": "screenshot",
  "screenshot": true,
  "link": false
}
```

- `smart_mode: true` 时后端自动选择模型和提供商，移动端可省略 `model_name` / `provider_id`
- `smart_mode: false` 时必须指定 `model_name` 和 `provider_id`
- 移动端默认 `smart_mode: true`，用户手动选模型时切换为 `false`

### Obsidian 导出 `content_sections` 参数

Obsidian 导出 API 接受 `content_sections` 字段，允许用户选择导出笔记的哪些部分：

```json
{
  "content_sections": ["summary", "raw_article", "subtitles"]
}
```

可选值：`summary`、`raw_article`、`subtitles`、`outline`、`screenshots`。移动端默认全选，后续可加自定义选项。

### 图片加载与 Referer 限制

B站、抖音等平台的封面图有 Referer 校验，直接加载会 403。解决方案：

1. **优先**：通过后端图片代理 `GET /api/image_proxy?url=...` 加载（推荐，后端处理 Referer）
2. **备选**：Coil 配置 OkHttp 时添加对应平台 Referer header

### 笔记风格快速选择（移动端精简版）

Web 端 `SummarySettings` 包含：style、output_language、video_understanding、video_interval、grid_size、format、extras。

移动端精简为：
- **风格**：简洁 / 详细 / 要点（对应 `style`：minimal / detailed / bullet）
- **模型**：智能选择 / 手动选择（对应 `smart_mode`）
- 其余参数使用后端默认值，不在移动端暴露
