from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pathlib import Path
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger
import tempfile
import io

logger = get_logger(__name__)

router = APIRouter()

# 获取项目根目录的绝对路径
NOTE_OUTPUT_DIR = Path(__file__).parent.parent.parent / "note_results"

# PDF 样式配置
CSS_STYLES = """
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');

body {
    font-family: 'Noto Sans SC', 'Microsoft YaHei', 'PingFang SC', sans-serif;
    line-height: 1.8;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 20px;
    color: #333;
}

h1, h2, h3, h4, h5, h6 {
    color: #1a1a1a;
    margin-top: 1.5em;
    margin-bottom: 0.8em;
    font-weight: 700;
}

h1 {
    font-size: 28px;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 10px;
}

h2 { font-size: 24px; }
h3 { font-size: 20px; }
h4 { font-size: 18px; }

p {
    margin-bottom: 1em;
}

code {
    background: #f4f4f4;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9em;
}

pre {
    background: #f4f4f4;
    padding: 15px;
    border-radius: 8px;
    overflow-x: auto;
    line-height: 1.5;
}

pre code {
    background: transparent;
    padding: 0;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 1.5em auto;
}

blockquote {
    border-left: 4px solid #4a90e2;
    padding-left: 20px;
    color: #666;
    margin: 1.5em 0;
}

ul, ol {
    padding-left: 2em;
    margin-bottom: 1em;
}

li {
    margin-bottom: 0.5em;
}

table {
    border-collapse: collapse;
    width: 100%;
    margin: 1.5em 0;
}

th, td {
    border: 1px solid #ddd;
    padding: 12px;
    text-align: left;
}

th {
    background: #f5f5f5;
    font-weight: 700;
}

a {
    color: #4a90e2;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 2em 0;
}
"""


@router.get("/pdf/{task_id}")
async def export_pdf(task_id: str):
    """
    导出笔记为 PDF

    Args:
        task_id: 任务 ID

    Returns:
        PDF 文件流
    """
    try:
        markdown_file = NOTE_OUTPUT_DIR / f"{task_id}_markdown.md"

        # 检查文件是否存在
        if not markdown_file.exists():
            logger.warning(f"PDF 导出失败：笔记不存在 (task_id={task_id})")
            raise HTTPException(
                status_code=404,
                detail=f"笔记不存在，请确认任务 ID 正确"
            )

        # 读取 Markdown 内容
        markdown_content = markdown_file.read_text(encoding="utf-8")

        if not markdown_content.strip():
            logger.warning(f"PDF 导出失败：笔记内容为空 (task_id={task_id})")
            raise HTTPException(
                status_code=400,
                detail="笔记内容为空"
            )

        # 读取笔记标题（用于文件名）
        title = None
        audio_cache_file = NOTE_OUTPUT_DIR / f"{task_id}_audio.json"
        if audio_cache_file.exists():
            try:
                import json
                audio_meta = json.loads(audio_cache_file.read_text(encoding="utf-8"))
                title = audio_meta.get("title", "").strip()
                logger.info(f"读取到标题 (task_id={task_id}): {title[:50]}...")
            except Exception as e:
                logger.warning(f"读取标题失败 (task_id={task_id}): {e}")

        # 尝试使用 markdown_pdf
        try:
            from markdown_pdf import MarkdownPdf, Section
            import re
            from urllib.parse import quote

            # 清理 markdown 内容，统一换行符
            clean_md = markdown_content.replace('\r\n', '\n')

            # 移除可能导致问题的内部链接 [text](#anchor)
            # 保留外部链接 [text](url)
            clean_md = re.sub(r'\[([^\]]+)\]\(#([^\)]+)\)', r'\1', clean_md)

            # 创建 MarkdownPdf 实例
            md_pdf = MarkdownPdf()

            # 添加 markdown 内容
            md_pdf.add_section(Section(clean_md), user_css=CSS_STYLES)

            # 生成 PDF 到内存
            pdf_buffer = io.BytesIO()
            md_pdf.save(pdf_buffer)
            pdf_content = pdf_buffer.getvalue()

        except ImportError:
            logger.error("markdown_pdf 包未安装")
            raise HTTPException(
                status_code=500,
                detail="PDF 导出功能未正确配置"
            )
        except Exception as e:
            logger.error(f"PDF 转换失败 (task_id={task_id}): {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"PDF 生成失败：{str(e)}"
            )

        logger.info(f"PDF 导出成功 (task_id={task_id})")

        # 处理文件名：使用标题或后备方案
        if title:
            # 移除文件名中的特殊字符
            safe_title = re.sub(r'[\\/*?:"<>|]', '', title)
            # 限制长度，避免过长
            safe_title = safe_title.strip()[:150]
            # 如果处理后为空，使用后备方案
            if not safe_title:
                safe_title = f"note_{task_id[:8]}"
            filename = f"{safe_title}.pdf"
            # 使用 RFC 5987 编码支持中文
            filename_encoded = quote(filename.encode('utf-8'))
        else:
            filename = f"note_{task_id}.pdf"
            filename_encoded = filename

        # 返回 PDF 文件流
        return Response(
            content=pdf_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF 导出异常 (task_id={task_id}): {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"导出失败：{str(e)}"
        )
