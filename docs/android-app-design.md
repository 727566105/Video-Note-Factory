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
- 底部：最近任务状态实时显示（3 秒轮询 `/task_status`）
- 任务成功后显示"查看笔记"按钮

### 3.2 笔记列表页

- 顶部 Tab：`全部笔记` | `收藏夹`
- 全部笔记 Tab：平台筛选 chips（横向滚动）+ 搜索 + 卡片网格（每行 2 张）
- 卡片内容：封面图 + 标题（2 行省略）+ 作者 + 平台图标 + 相对时间
- 交互：点击→详情，长按→菜单（删除/导出/加入收藏夹），下拉刷新，滚动自动加载

### 3.3 笔记详情页（垂直滚动布局）

- 顶栏：返回 + 更多操作
- 封面图/视频播放区（B站/YouTube iframe / ExoPlayer 本地播放）
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
    if (siyuanConfig?.enabled == true) ExportOption("导出到思源笔记")
    if (obsidianConfig?.enabled == true) ExportOption("导出到 Obsidian")
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
| 任务状态 | `GET /api/task_status/{id}` |
| 任务列表 | `GET /api/tasks` |
| 删除任务 | `POST /api/delete_task` |
| 取消任务 | `POST /api/cancel_task` |
| 笔记详情 | `GET /api/quick_view/{id}` |
| 笔记标签 | `PUT /api/notes/{id}/tags` |
| 动态列表 | `GET /api/feed` |
| 标记已读 | `PUT /api/feed/{id}/read` |
| 全部已读 | `PUT /api/feed/read-all` |
| 刷新动态 | `POST /api/feed/refresh` |
| 未读计数 | `GET /api/feed/unread-count` |
| 动态生成笔记 | `POST /api/feed/{id}/generate-note` |
| 订阅列表 | `GET /api/subscriptions` |
| 添加订阅 | `POST /api/subscriptions` |
| 删除订阅 | `DELETE /api/subscriptions/{id}` |
| 切换订阅 | `PUT /api/subscriptions/{id}/toggle` |
| 收藏夹列表 | `GET /api/collections` |
| 创建收藏夹 | `POST /api/collections` |
| 收藏夹详情 | `GET /api/collections/{id}` |
| 添加到收藏夹 | `POST /api/collections/{id}/items` |
| 移出收藏夹 | `DELETE /api/collections/{id}/items/{task_id}` |
| 生成摘要 | `POST /api/collections/{id}/generate_summary` |
| 收藏夹摘要 | `GET /api/collections/{id}/summary` |
| 导出 PDF | `GET /api/pdf/{id}` |
| 导出图片 | `GET /api/image/{id}` |
| 思源导出 | `POST /api/siyuan/export/siyuan/{id}` |
| Obsidian 导出 | `POST /api/obsidian/export/obsidian/{id}` |
| 思源配置 | `GET /api/siyuan/config` |
| Obsidian 配置 | `GET /api/obsidian/config` |
| 模型列表 | `GET /api/model_list` |
| 用户偏好 | `GET/PUT /api/user/preferences` |
| 系统健康 | `GET /api/health` |

---

## 6. 任务生命周期

后端任务状态流转：

```
PENDING → QUEUED → PARSING → DOWNLOADING → TRANSCRIBING → SUMMARIZING → SAVING → SUCCESS
```

任何阶段都可能进入 `FAILED` 状态。

移动端轮询策略：
- 生成笔记后立即开始轮询 `GET /api/task_status/{id}`
- 轮询间隔：3 秒
- 终止条件：状态为 `SUCCESS` 或 `FAILED`
- 成功后显示"查看笔记"按钮
- 失败后显示错误信息 + "重试"按钮

---

## 7. 支持平台

| 平台 | 标识 | URL 模式 |
|------|------|----------|
| Bilibili | bilibili | bilibili.com/video/BV* |
| YouTube | youtube | youtube.com/watch* / youtu.be/* |
| 抖音 | douyin | douyin.com/video/* |
| 小红书 | xiaohongshu | xiaohongshu.com/* |
| 快手 | kuaishou | kuaishou.com/* |
| 央视频 | cctv | cctv.com/* |
| 本地视频 | local | 文件上传 |
| 本地音频 | local_audio | 文件上传 |

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
