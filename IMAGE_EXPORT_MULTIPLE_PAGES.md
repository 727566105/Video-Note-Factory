# 图文导出多页功能实现

## 问题描述

用户反馈图文导出功能将所有内容拼接成一张超长图片，希望改为导出多张独立图片（一页一张）。

## 解决方案

### 后端修改 (backend/app/utils/image_export.py)

1. **修改 `html_to_image_sync()` 函数**
   - 返回类型从 `bytes` 改为 `list[bytes]`
   - 不再将多页 PDF 拼接成一张长图
   - 每页 PDF 转换为独立的图片
   - 返回图片列表

2. **修改 `html_to_image()` 异步函数**
   - 返回类型从 `bytes` 改为 `list[bytes]`
   - 调用更新后的同步函数

3. **修改 `export_note_as_image()` 函数**
   - 返回类型从 `tuple[bytes, str | None]` 改为 `tuple[list[bytes], str | None]`
   - 移除缓存逻辑（因为现在返回多张图片）
   - 返回图片列表和标题

### API 修改 (backend/app/routers/export.py)

**修改 `/api/export/image/{task_id}` 端点**

- 接收多张图片列表
- 如果只有 1 张图片：直接返回图片文件
- 如果有多张图片：打包为 ZIP 文件返回
- 响应头添加 `X-Image-Count` 标识图片数量

### 前端修改 (BillNote_frontend/src/components/ExportImageButton.tsx)

**更新 `handleExport()` 函数**

- 读取响应头中的 `X-Image-Count` 和 `Content-Type`
- 根据文件类型显示不同的成功消息
- ZIP 文件显示：`图文导出成功（N张图片已打包）`
- 单张图片显示：`图文导出成功`

## 使用效果

### 单页笔记

- 直接下载单张图片文件（.png 或 .jpg）
- 文件名：`笔记标题.png`

### 多页笔记

- 下载 ZIP 压缩包
- 文件名：`笔记标题.zip`
- ZIP 内容：`笔记标题_1.png`, `笔记标题_2.png`, `笔记标题_3.png` ...

## 技术细节

### 图片生成流程

1. Markdown → HTML（使用 markdown 库）
2. HTML → PDF（使用 WeasyPrint）
3. PDF → 多张图片（使用 pdf2image，每页一张）
4. 多张图片 → ZIP 打包（使用 zipfile）

### 依赖包

- `weasyprint`: HTML 转 PDF
- `pdf2image`: PDF 转图片
- `Pillow`: 图片处理
- `markdown`: Markdown 转 HTML

## 测试建议

1. 测试短笔记（单页）：应直接下载单张图片
2. 测试长笔记（多页）：应下载 ZIP 文件，包含多张图片
3. 测试不同模板：xiaohongshu、simple、academic
4. 验证文件名正确性（中文标题编码）

## 部署状态

✅ 后端代码已更新
✅ 前端代码已更新
✅ 后端服务已重启（PID: 28505）
✅ 功能已就绪，可以测试

## 相关文件

- `backend/app/utils/image_export.py` - 图片生成核心逻辑
- `backend/app/routers/export.py` - 导出 API 端点
- `BillNote_frontend/src/components/ExportImageButton.tsx` - 前端导出按钮
