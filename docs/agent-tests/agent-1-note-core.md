# Agent-1: 首页笔记核心测试

> Phase 2 并行执行。
> isolatedContext: "agent-1"
> 依赖: Agent-0 完成登录

## 测试用例

- TC-HOME-01: 首页渲染验证
- TC-HOME-02: 笔记生成 — Bilibili 视频
- TC-HOME-03: 空链接校验
- TC-HOME-04: 切换到上传 Tab
- TC-HOME-05: 总结设置对话框
- TC-HOME-06: 模型选择对话框
- TC-HOME-07: 平台选择器切换
- TC-HOME-08: 快速粘贴功能

## 前置条件

先登录 admin 账户。

## 执行步骤

### 0. 登录

```
mcp__chrome__new_page(url="http://localhost:3015/login", isolatedContext="agent-1")
mcp__chrome__take_snapshot()
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "123456")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["VideoNote"], timeout=10000)
```

### 1. TC-HOME-01: 首页渲染验证

```
# 已在首页
mcp__chrome__take_snapshot()
mcp__chrome__take_screenshot(filePath="test-results/home-01-render.png")
```

验证以下元素存在：
- 标题 "VideoNote"（渐变色）
- "链接" 和 "上传" Tab
- textarea（placeholder="请输入视频网站链接"）
- "总结设置" 按钮
- 模型选择按钮
- "生成笔记" 按钮

### 2. TC-HOME-03: 空链接校验

```
# 不填链接，直接点击生成
mcp__chrome__take_snapshot()
mcp__chrome__click(generate_button_uid)
mcp__chrome__wait_for(["请输入视频链接"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/home-03-empty-link.png")
```

验证：toast 提示 "请输入视频链接"。

### 3. TC-HOME-07: 平台选择器切换

```
mcp__chrome__take_snapshot()
# 点击平台选择器
mcp__chrome__click(platform_selector_uid)
# 等待下拉菜单出现
mcp__chrome__wait_for(["bilibili", "youtube"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/home-07-platform.png")

# 选择 bilibili
mcp__chrome__click(bilibili_option_uid)
mcp__chrome__take_screenshot(filePath="test-results/home-07-bilibili.png")
```

验证：平台图标和名称正确切换。

### 4. TC-HOME-04: 切换到上传 Tab

```
mcp__chrome__take_snapshot()
mcp__chrome__click(upload_tab_uid)
mcp__chrome__wait_for(["选择音视频文件"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/home-04-upload.png")
```

验证：可见上传区域，包含 "选择音视频文件" 按钮、拖拽区域。

```
# 切回链接 Tab
mcp__chrome__click(link_tab_uid)
mcp__chrome__wait_for(["请输入视频网站链接"], timeout=5000)
```

### 5. TC-HOME-05: 总结设置对话框

```
mcp__chrome__take_snapshot()
mcp__chrome__click(settings_button_uid)  # "总结设置" 按钮
mcp__chrome__wait_for(["风格", "简洁"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/home-05-settings.png")
# 关闭对话框
mcp__chrome__press_key(key="Escape")
```

验证：弹出对话框，包含风格选择、输出语言、格式选项。

### 6. TC-HOME-06: 模型选择对话框

```
mcp__chrome__take_snapshot()
mcp__chrome__click(model_select_button_uid)
mcp__chrome__wait_for(["智能优选"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/home-06-model.png")
# 关闭对话框
mcp__chrome__press_key(key="Escape")
```

验证：弹出模型选择对话框，列出可用模型。

### 7. TC-HOME-02: 笔记生成 — Bilibili 视频

```
mcp__chrome__take_snapshot()
# 在 textarea 中输入 Bilibili 链接
mcp__chrome__fill(textarea_uid, "https://www.bilibili.com/video/BV1GJ4m1A7QG")
mcp__chrome__take_screenshot(filePath="test-results/home-02-input.png")

# 如果弹出"发现已有笔记"对话框，点击"重新生成"
# 检查是否有可用性预检弹窗

# 点击生成笔记
mcp__chrome__click(generate_button_uid)
mcp__chrome__wait_for(["已提交"], timeout=15000)
mcp__chrome__take_screenshot(filePath="test-results/home-02-submitted.png")
```

验证：toast 提示 "笔记生成任务已提交！" 或 "已保存到我的笔记"。

### 8. TC-HOME-08: 快速粘贴功能

```
mcp__chrome__take_snapshot()
mcp__chrome__click(paste_button_uid)  # "快速粘贴" 按钮
# 等待结果（成功或失败取决于剪贴板权限）
mcp__chrome__take_screenshot(filePath="test-results/home-08-paste.png")
```

验证：如果剪贴板有内容则粘贴成功，否则提示无法读取。

## 输出

- 测试结果统计：PASS/FAIL
- 截图文件：`test-results/home-*.png`
- 若 TC-HOME-02 成功生成了笔记，此数据供 Agent-2 使用
