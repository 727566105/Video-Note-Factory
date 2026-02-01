# PDF 导出功能设计文档

## 架构设计

### 组件交互

```
┌─────────┐        ┌──────────┐        ┌──────────┐        ┌──────────┐
│ 前端UI  │───────▶│ API路由  │───────▶│ PDF服务  │───────▶│  PDF文件  │
│ Export  │  GET   │ /export  │        │ generate │        │  返回    │
│ Button  │        /pdf/:id   │        │          │        │          │
└─────────┘        └──────────┘        └──────────┘        └──────────┘
                                               │
                                               ▼
                                         ┌──────────┐
                                         │ Markdown │
                                         │  缓存    │
                                         └──────────┘
```

### 数据流

1. 用户点击"导出 PDF"按钮
2. 前端调用 `GET /api/export/pdf/{task_id}`
3. 后端从 `note_results/{task_id}_markdown.md` 读取 Markdown
4. 使用 `markdown_pdf` 转换为 PDF
5. 返回 PDF 文件流（Content-Type: application/pdf）
6. 浏览器触发下载

## 技术实现

### 后端实现

#### 新增路由文件：`backend/app/routers/export.py`

```python
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pathlib import Path
import markdown_pdf

router = APIRouter()

NOTE_OUTPUT_DIR = Path("note_results")

@router.get("/pdf/{task_id}")
async def export_pdf(task_id: str):
    """导出笔记为 PDF"""
    markdown_file = NOTE_OUTPUT_DIR / f"{task_id}_markdown.md"

    if not markdown_file.exists():
        raise HTTPException(status_code=404, detail="笔记不存在")

    markdown_content = markdown_file.read_text(encoding="utf-8")

    # 转换为 PDF
    pdf_content = markdown_pdf.markdown_str_to_pdf(
        markdown_content,
        css_str=CSS_STYLES
    )

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=note_{task_id}.pdf"
        }
    )
```

#### PDF 样式配置

```python
CSS_STYLES = """
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');

body {
    font-family: 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
    line-height: 1.8;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
}

h1, h2, h3 {
    color: #333;
    margin-top: 1.5em;
}

h1 { font-size: 28px; border-bottom: 2px solid #eee; padding-bottom: 10px; }
h2 { font-size: 24px; }
h3 { font-size: 20px; }

code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 4px;
}

pre {
    background: #f4f4f4;
    padding: 15px;
    border-radius: 8px;
    overflow-x: auto;
}

img {
    max-width: 100%;
    height: auto;
}

blockquote {
    border-left: 4px solid #ddd;
    padding-left: 20px;
    color: #666;
}
"""
```

#### 注册路由

在 `backend/app/__init__.py` 中添加：
```python
from app.routers import export
app.include_router(export.router, prefix="/api/export")
```

### 前端实现

#### 导出按钮组件：`BillNote_frontend/src/components/ExportPDFButton.tsx`

```tsx
import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Download } from 'lucide-react';

interface ExportPDFButtonProps {
  taskId: string;
  disabled?: boolean;
}

export function ExportPDFButton({ taskId, disabled = false }: ExportPDFButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/export/pdf/${taskId}`);
      if (!response.ok) throw new Error('导出失败');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `note_${taskId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('PDF 导出成功');
    } catch (error) {
      toast.error('PDF 导出失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <FileText className="w-4 h-4 animate-pulse" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span>{loading ? '生成中...' : '导出 PDF'}</span>
    </button>
  );
}
```

#### 集成到笔记详情页

在 `BillNote_frontend/src/pages/HomePage/components/MarkdownViewer.tsx` 中添加导出按钮。

## 错误处理

1. **笔记不存在**: 返回 404
2. **转换失败**: 返回 500，记录日志
3. **超时**: 设置较长的响应超时（60s）

## 性能考虑

1. **缓存**: 生成的 PDF 可缓存到 `note_results/{task_id}.pdf`
2. **异步处理**: 对于大文档，可考虑后台生成
3. **限制**: 单次 PDF 大小限制为 50MB

## 测试策略

### 单元测试
- PDF 生成函数测试
- 样式渲染测试

### 集成测试
- API 端点测试
- 文件下载测试

### E2E 测试
- 完整导出流程测试

## 后续优化

1. 支持自定义样式模板
2. 支持批量导出
3. 添加导出历史记录
4. 支持导出为 Word/Notion 等其他格式
