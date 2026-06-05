# Change: Add Share Poster

## Why
笔记详情页目前只能复制、导出或下载内容，缺少一个适合社交传播的分享入口。用户需要把视频封面、标题、作者、笔记摘要、分享时间和链接二维码整合成有设计感的海报，并支持保存、系统分享和复制链接。

## What Changes
- 在笔记详情页新增“分享”入口，打开分享海报对话框。
- 生成可预览的分享海报，包含视频封面、标题、作者/平台、笔记内容摘录、分享时间、链接二维码和 VideoNote 品牌信息。
- 支持可扩展的海报风格选择，首批包含 B 站、小红书、YouTube、X、微信公众号、专业简约等风格，每种风格有配套色彩、背景、图标元素和版式语言。
- 支持保存海报图片、调用系统分享能力、复制分享链接。
- 复用现有前端 `html2canvas` 图文生成能力，优先前端生成海报，避免新增后端依赖。

## Impact
- Affected specs: `share-poster`
- Related existing change: `add-image-export`
- Affected code:
  - `videoNote_frontend/src/pages/NoteDetailPage/RightPanel.tsx`
  - `videoNote_frontend/src/components/SharePosterDialog.tsx` 或同等新增组件
  - 可能复用/抽取 `videoNote_frontend/src/components/ExportImageDialog.tsx` 中的图片生成逻辑
