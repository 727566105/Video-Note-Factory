# B站视频描述抓取与展示设计

> 解决问题：笔记生成时未抓取B站视频描述，用户希望在笔记详情页看到视频原始描述。

## 目标

1. 在视频下载阶段调用B站视频详情API获取描述
2. 将描述存储到数据库和笔记JSON中
3. 在笔记详情页 LeftPanel 中标题下方可折叠显示

---

## 后端实现

### 1. 添加 description 字段

**文件**: `backend/app/models/audio_model.py`

`AudioDownloadResult` 添加 `description: Optional[str] = None`

### 2. 下载器获取描述

**文件**: `backend/app/downloaders/bilibili_downloader.py`

下载完成后，用 `video_id`（BV号）调用：
```
GET https://api.bilibili.com/x/web-interface/view?bvid={video_id}
```

从响应 JSON 的 `data.desc` 字段提取描述文本，赋值给 `AudioDownloadResult.description`。

不需要 WBI 签名，直接 GET 请求即可。使用 Cookie 提高成功率。

### 3. 数据库存储

**文件**: `backend/app/db/models/video_tasks.py`

`VideoTask` 模型添加 `description = Column(String, nullable=True)`

**文件**: `backend/app/db/video_task_dao.py`

`update_task_metadata()` 添加 description 参数

**文件**: `backend/app/db/init_db.py`

添加迁移：检查 `video_tasks` 表是否有 `description` 列，没有则 `ALTER TABLE ADD`

### 4. note.py 保存描述

**文件**: `backend/app/services/note.py`

`_save_audio_metadata()` 中将 `audio_meta.description` 写入 DB

note.json 的 `audio_meta` 自动包含 description（因为 AudioDownloadResult 序列化）

---

## 前端实现

### 1. 类型定义

**文件**: `videoNote_frontend/src/types/api.ts`

`AudioMeta` 接口添加 `description?: string`

### 2. LeftPanel 显示描述

**文件**: `videoNote_frontend/src/pages/NoteDetailPage/LeftPanel.tsx`

标题和作者信息下方添加描述区域：
- 默认折叠，CSS `line-clamp-2` 限制2行
- 点击"展开"按钮显示全文
- 点击"收起"按钮恢复折叠
- 无描述时（null/空字符串）不渲染

---

## 文件清单

| 操作 | 文件 |
|------|------|
| 修改 | `backend/app/models/audio_model.py` |
| 修改 | `backend/app/downloaders/bilibili_downloader.py` |
| 修改 | `backend/app/db/models/video_tasks.py` |
| 修改 | `backend/app/db/video_task_dao.py` |
| 修改 | `backend/app/db/init_db.py` |
| 修改 | `backend/app/services/note.py` |
| 修改 | `videoNote_frontend/src/pages/NoteDetailPage/LeftPanel.tsx` |

---

## 验证方案

1. 提交B站视频链接生成笔记 → note.json 的 `audio_meta.description` 非空
2. 打开笔记详情页 → 标题下方显示描述，默认折叠
3. 点击展开 → 显示完整描述
4. 提交非B站视频 → 无描述时不显示描述区域（不影响其他平台）
