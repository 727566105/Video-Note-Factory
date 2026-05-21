# Agent-2: 笔记列表与详情测试

> Phase 2 并行执行，建议延迟 30 秒启动（等待 Agent-1 生成笔记数据）。
> isolatedContext: "agent-2"
> 依赖: Agent-0 完成登录，Agent-1 生成笔记数据（弱依赖，可复用已有数据）

## 测试用例

- TC-NOTES-01: 笔记列表加载
- TC-NOTES-02: 视图切换
- TC-NOTES-03: 搜索笔记
- TC-NOTES-04: 删除笔记
- TC-NOTES-05: 批量删除笔记
- TC-NOTES-06: 查看笔记详情
- TC-NOTES-07: 重新生成笔记
- TC-DETAIL-01: 详情页渲染
- TC-DETAIL-02: 导出 PDF
- TC-DETAIL-03: 导出图片
- TC-DETAIL-04: 导出思源笔记
- TC-DETAIL-05: 版本历史查看

## 前置条件

先登录 admin 账户。确保至少有 1 条已完成的笔记（复用已有数据或等待 Agent-1 生成）。

## 执行步骤

### 0. 登录

```
mcp__chrome__new_page(url="http://localhost:3015/login", isolatedContext="agent-2")
mcp__chrome__take_snapshot()
mcp__chrome__fill(username_uid, "admin")
mcp__chrome__fill(password_uid, "123456")
mcp__chrome__click(submit_button_uid)
mcp__chrome__wait_for(["VideoNote"], timeout=10000)
```

### 1. TC-NOTES-01: 笔记列表加载

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/notes")
mcp__chrome__wait_for(["笔记列表"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/notes-01-list.png")
```

验证：显示笔记列表，包含标题、平台、状态、时间、操作按钮列。

### 2. TC-NOTES-02: 视图切换

```
mcp__chrome__take_snapshot()
# 找到视图切换按钮组（表格/卡片/瀑布流图标）
# 点击卡片视图
mcp__chrome__click(card_view_uid)
mcp__chrome__take_screenshot(filePath="test-results/notes-02-card.png")
# 点击瀑布流视图
mcp__chrome__click(masonry_view_uid)
mcp__chrome__take_screenshot(filePath="test-results/notes-02-masonry.png")
# 切回表格视图
mcp__chrome__click(table_view_uid)
mcp__chrome__take_screenshot(filePath="test-results/notes-02-table.png")
```

验证：三种视图均正确渲染。

### 3. TC-NOTES-03: 搜索笔记

```
mcp__chrome__take_snapshot()
# 找到搜索框
mcp__chrome__fill(search_uid, "测试")
mcp__chrome__press_key(key="Enter")
# 等待筛选结果
mcp__chrome__take_screenshot(filePath="test-results/notes-03-search.png")
# 清空搜索
mcp__chrome__fill(search_uid, "")
mcp__chrome__press_key(key="Enter")
```

验证：搜索后只显示匹配结果。

### 4. TC-NOTES-06: 查看笔记详情

```
mcp__chrome__take_snapshot()
# 找到第一条笔记的标题链接，点击进入详情
mcp__chrome__click(note_title_uid)
mcp__chrome__wait_for(["导出"], timeout=10000)
mcp__chrome__take_screenshot(filePath="test-results/detail-01-render.png")
```

验证：跳转到 `/notes/{id}`，显示双栏布局。

### 5. TC-DETAIL-01: 详情页渲染验证

```
mcp__chrome__take_snapshot()
```

验证：
- 左栏：视频播放器或截图 + 视频信息
- 右栏：Markdown 笔记内容
- 工具栏：导出按钮可见

### 6. TC-DETAIL-02: 导出 PDF

```
mcp__chrome__take_snapshot()
# 找到导出 PDF 按钮
mcp__chrome__click(export_pdf_uid)
mcp__chrome__take_screenshot(filePath="test-results/detail-02-pdf.png")
```

验证：触发 PDF 下载或弹出导出选项。

### 7. TC-DETAIL-03: 导出图片

```
mcp__chrome__take_snapshot()
# 找到导出图片按钮
mcp__chrome__click(export_image_uid)
mcp__chrome__wait_for(["模板"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/detail-03-image.png")
# 选择模板并确认
mcp__chrome__click(confirm_export_uid)
mcp__chrome__take_screenshot(filePath="test-results/detail-03-image-export.png")
```

验证：弹出模板选择对话框，选择后生成图片。

### 8. TC-DETAIL-05: 版本历史查看

```
mcp__chrome__take_snapshot()
# 找到版本切换下拉（在 Markdown 标题区域）
# 如果存在版本选择器，点击切换版本
mcp__chrome__take_screenshot(filePath="test-results/detail-05-version.png")
```

验证：如果笔记有多个版本，可切换查看。

### 9. 返回笔记列表继续测试

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/notes")
mcp__chrome__wait_for(["笔记列表"], timeout=10000)
```

### 10. TC-NOTES-07: 重新生成笔记

```
mcp__chrome__take_snapshot()
# 找到一条已完成笔记的重新生成按钮（RotateCw 图标）
mcp__chrome__click(regenerate_uid)
mcp__chrome__take_screenshot(filePath="test-results/notes-07-regenerate.png")
```

验证：触发重新生成流程。

### 11. TC-NOTES-04: 删除笔记

```
mcp__chrome__navigate_page(type="url", url="http://localhost:3015/notes")
mcp__chrome__wait_for(["笔记列表"], timeout=10000)
mcp__chrome__take_snapshot()
# 找到某条笔记的删除按钮
mcp__chrome__click(delete_note_uid)
# 在确认弹窗中点击确认
mcp__chrome__wait_for(["确认"], timeout=5000)
mcp__chrome__click(confirm_delete_uid)
mcp__chrome__wait_for(["删除成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/notes-04-delete.png")
```

验证：笔记从列表移除。

### 12. TC-NOTES-05: 批量删除笔记

```
mcp__chrome__take_snapshot()
# 勾选 2-3 条笔记
mcp__chrome__click(checkbox_uid_1)
mcp__chrome__click(checkbox_uid_2)
# 点击批量删除
mcp__chrome__click(batch_delete_uid)
mcp__chrome__wait_for(["确认"], timeout=5000)
mcp__chrome__click(confirm_batch_delete_uid)
mcp__chrome__wait_for(["删除成功"], timeout=5000)
mcp__chrome__take_screenshot(filePath="test-results/notes-05-batch-delete.png")
```

验证：所选笔记被删除。

## 注意事项

- TC-DETAIL-04（导出思源笔记）标记为 `@external-dependent`，跳过此用例（由 Agent-5 测试集成功能）
- 删除操作只针对测试过程中明确可删除的数据

## 输出

- 测试结果统计：PASS/FAIL
- 截图文件：`test-results/notes-*.png`, `test-results/detail-*.png`
