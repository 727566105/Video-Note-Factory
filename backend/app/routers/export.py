from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import Response, FileResponse
from pathlib import Path
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger
import io
import re
import json
from urllib.parse import quote
from typing import Literal
from datetime import datetime

logger = get_logger(__name__)

router = APIRouter()

# 获取项目根目录的绝对路径
NOTE_OUTPUT_DIR = Path(__file__).parent.parent.parent / "note_results"
EXPORT_HISTORY_FILE = NOTE_OUTPUT_DIR / ".export_history.json"

# PDF 样式主题
StyleType = Literal["default", "simple", "print", "academic"]

# 图文导出格式和模板
ImageFormat = Literal["png", "jpg", "jpeg"]
ImageTemplate = Literal["xiaohongshu", "simple", "academic"]


def _add_export_history(task_id: str, style: str, title: str | None = None):
    """记录导出历史"""
    try:
        history = []
        if EXPORT_HISTORY_FILE.exists():
            history = json.loads(EXPORT_HISTORY_FILE.read_text(encoding="utf-8"))

        record = {
            "task_id": task_id,
            "style": style,
            "title": title,
            "timestamp": datetime.now().isoformat(),
            "pdf_file": f"{task_id}_{style}.pdf"
        }

        history.insert(0, record)
        # 只保留最近 1000 条记录
        history = history[:1000]

        EXPORT_HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception as e:
        logger.warning(f"记录导出历史失败: {e}")


def _get_export_history(limit: int = 50) -> list:
    """获取导出历史"""
    try:
        if EXPORT_HISTORY_FILE.exists():
            history = json.loads(EXPORT_HISTORY_FILE.read_text(encoding="utf-8"))
            return history[:limit]
        return []
    except Exception as e:
        logger.warning(f"读取导出历史失败: {e}")
        return []

PDF_STYLES = {
    "default": """
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

p { margin-bottom: 1em; }

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

pre code { background: transparent; padding: 0; }

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

ul, ol { padding-left: 2em; margin-bottom: 1em; }
li { margin-bottom: 0.5em; }

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

th { background: #f5f5f5; font-weight: 700; }

a { color: #4a90e2; text-decoration: none; }
a:hover { text-decoration: underline; }

hr {
    border: none;
    border-top: 1px solid #e0e0e0;
    margin: 2em 0;
}
""",

    "simple": """
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap');

body {
    font-family: 'Noto Sans SC', sans-serif;
    line-height: 1.6;
    max-width: 700px;
    margin: 0 auto;
    padding: 30px 20px;
    color: #2c3e50;
}

h1, h2, h3, h4, h5, h6 {
    color: #2c3e50;
    margin-top: 1.2em;
    margin-bottom: 0.5em;
    font-weight: 600;
}

h1 { font-size: 24px; }
h2 { font-size: 20px; }
h3 { font-size: 18px; }
h4 { font-size: 16px; }

p { margin-bottom: 0.8em; }

code {
    background: #ecf0f1;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Monaco', monospace;
    font-size: 0.85em;
}

pre {
    background: #ecf0f1;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
}

pre code { background: transparent; padding: 0; }

blockquote {
    border-left: 3px solid #95a5a6;
    padding-left: 15px;
    color: #7f8c8d;
    margin: 1em 0;
}

ul, ol { padding-left: 1.5em; }
li { margin-bottom: 0.3em; }

table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
}

th, td {
    border: 1px solid #bdc3c7;
    padding: 8px;
    text-align: left;
}

th { background: #ecf0f1; }

a { color: #3498db; text-decoration: none; }
hr { border: none; border-top: 1px solid #ecf0f1; margin: 1.5em 0; }
""",

    "print": """
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&display=swap');

body {
    font-family: 'Noto Serif SC', 'SimSun', serif;
    line-height: 1.8;
    max-width: 700px;
    margin: 0 auto;
    padding: 30px;
    color: #000;
}

h1, h2, h3, h4, h5, h6 {
    color: #000;
    margin-top: 1.5em;
    margin-bottom: 0.8em;
    font-weight: 700;
    text-align: center;
}

h1 { font-size: 22px; border-bottom: 1px solid #000; padding-bottom: 8px; }
h2 { font-size: 18px; }
h3 { font-size: 16px; }

p { margin-bottom: 0.8em; text-align: justify; }

code {
    background: #eee;
    padding: 1px 4px;
    border-radius: 2px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
}

pre {
    background: #f5f5f5;
    padding: 10px;
    border: 1px solid #ddd;
    overflow-x: auto;
}

pre code { background: transparent; padding: 0; }

blockquote {
    border-left: 2px solid #000;
    padding-left: 15px;
    color: #444;
    margin: 1em 0;
}

ul, ol { padding-left: 1.8em; }
li { margin-bottom: 0.4em; }

table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
}

th, td {
    border: 1px solid #000;
    padding: 8px;
    text-align: left;
}

th { background: #f0f0f0; }

a { color: #000; text-decoration: underline; }
hr { border: none; border-top: 1px solid #000; margin: 1.5em 0; }
""",

    "academic": """
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Times+New+Roman&display=swap');

body {
    font-family: 'Noto Serif SC', 'Times New Roman', serif;
    line-height: 1.6;
    max-width: 650px;
    margin: 0 auto;
    padding: 50px 40px;
    color: #222;
}

h1, h2, h3, h4, h5, h6 {
    color: #111;
    margin-top: 1.8em;
    margin-bottom: 0.6em;
    font-weight: 700;
}

h1 {
    font-size: 20px;
    text-align: center;
    border-bottom: none;
    margin-bottom: 1.5em;
}

h2 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
h3 { font-size: 14px; }
h4 { font-size: 13px; }

p { margin-bottom: 0.6em; text-indent: 2em; }
p:first-of-type { text-indent: 0; }

code {
    background: #f8f8f8;
    padding: 2px 5px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
}

pre {
    background: #f8f8f8;
    padding: 12px;
    border-left: 3px solid #333;
    overflow-x: auto;
}

pre code { background: transparent; padding: 0; }

blockquote {
    border-left: 3px solid #333;
    padding-left: 15px;
    color: #555;
    margin: 1em 0;
    font-style: italic;
}

ul, ol { padding-left: 2em; }
li { margin-bottom: 0.3em; }

table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 0.9em;
}

th, td {
    border: 1px solid #333;
    padding: 6px 10px;
    text-align: left;
}

th { background: #e8e8e8; }

a { color: #055; text-decoration: underline; }
hr { border: none; border-top: 1px solid #333; margin: 2em 0; }
"""
}


def _build_pdf_response(pdf_content: bytes, title: str | None, task_id: str, style: str = "default") -> Response:
    """构建 PDF 响应，处理文件名编码"""
    if title:
        safe_title = re.sub(r'[\\/*?:"<>|]', '', title).strip()[:150]
        if not safe_title:
            safe_title = f"note_{task_id[:8]}"
        filename = f"{safe_title}.pdf"
        filename_encoded = quote(filename.encode('utf-8'))
    else:
        filename = f"note_{task_id}.pdf"
        filename_encoded = filename

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}",
            "X-PDF-Style": style
        }
    )


@router.get("/pdf/{task_id}")
async def export_pdf(
    task_id: str,
    style: StyleType = Query(default="default", description="PDF 样式主题")
):
    """
    导出笔记为 PDF（带缓存和样式选择）

    缓存策略：比较 PDF 缓存文件与 Markdown 文件的修改时间，
    如果 PDF 较新则直接返回缓存，否则重新生成。

    Args:
        task_id: 任务 ID
        style: 样式主题 (default/simple/print/academic)

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
            raise HTTPException(status_code=400, detail="笔记内容为空")

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

        # PDF 缓存机制（包含样式后缀）
        pdf_cache_file = NOTE_OUTPUT_DIR / f"{task_id}_{style}.pdf"
        if pdf_cache_file.exists():
            md_mtime = markdown_file.stat().st_mtime
            pdf_mtime = pdf_cache_file.stat().st_mtime
            if pdf_mtime >= md_mtime:
                logger.info(f"返回缓存的 PDF (task_id={task_id}, style={style})")
                pdf_content = pdf_cache_file.read_bytes()
                _add_export_history(task_id, style, title)
                return _build_pdf_response(pdf_content, title, task_id, style)

        # 生成 PDF 并缓存
        try:
            from markdown_pdf import MarkdownPdf, Section

            # 清理 markdown 内容
            clean_md = markdown_content.replace('\r\n', '\n')
            clean_md = re.sub(r'\[([^\]]+)\]\(#([^\)]+)\)', r'\1', clean_md)

            # 获取样式
            css_styles = PDF_STYLES.get(style, PDF_STYLES["default"])

            # 创建 PDF
            md_pdf = MarkdownPdf()
            md_pdf.add_section(Section(clean_md), user_css=css_styles)

            # 生成 PDF 到内存
            pdf_buffer = io.BytesIO()
            md_pdf.save(pdf_buffer)
            pdf_content = pdf_buffer.getvalue()

            # 保存到缓存
            try:
                pdf_cache_file.write_bytes(pdf_content)
                logger.info(f"PDF 已缓存 (task_id={task_id}, style={style})")
            except Exception as e:
                logger.warning(f"PDF 缓存写入失败 (task_id={task_id}): {e}")

        except ImportError:
            logger.error("markdown_pdf 包未安装")
            raise HTTPException(status_code=500, detail="PDF 导出功能未正确配置")
        except Exception as e:
            logger.error(f"PDF 转换失败 (task_id={task_id}): {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"PDF 生成失败：{str(e)}")

        logger.info(f"PDF 导出成功 (task_id={task_id}, style={style})")
        _add_export_history(task_id, style, title)
        return _build_pdf_response(pdf_content, title, task_id, style)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF 导出异常 (task_id={task_id}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"导出失败：{str(e)}")


@router.get("/styles")
async def list_styles():
    """获取可用的 PDF 样式列表"""
    return {
        "styles": [
            {"id": "default", "name": "默认样式", "description": "适合屏幕阅读，色彩丰富"},
            {"id": "simple", "name": "简洁样式", "description": "极简设计，清爽干净"},
            {"id": "print", "name": "打印样式", "description": "适合打印，黑白配色，衬线字体"},
            {"id": "academic", "name": "学术样式", "description": "适合学术论文，首行缩进，正式排版"}
        ]
    }


@router.post("/batch")
async def batch_export_pdf(
    task_ids: list[str] = Body(..., embed=True),
    style: StyleType = Query(default="default", description="PDF 样式主题")
):
    """
    批量导出笔记为 PDF 打包下载

    Args:
        task_ids: 任务 ID 列表
        style: 样式主题

    Returns:
        ZIP 文件流，包含所有 PDF
    """
    import zipfile
    from datetime import datetime

    if not task_ids:
        raise HTTPException(status_code=400, detail="任务 ID 列表不能为空")

    if len(task_ids) > 50:
        raise HTTPException(status_code=400, detail="单次最多导出 50 个笔记")

    # 创建内存中的 ZIP 文件
    zip_buffer = io.BytesIO()
    generated_count = 0
    failed_tasks = []

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for task_id in task_ids:
            try:
                markdown_file = NOTE_OUTPUT_DIR / f"{task_id}_markdown.md"

                if not markdown_file.exists():
                    failed_tasks.append({"task_id": task_id, "reason": "笔记不存在"})
                    continue

                # 读取标题用于文件名
                title = f"note_{task_id[:8]}"
                audio_file = NOTE_OUTPUT_DIR / f"{task_id}_audio.json"
                if audio_file.exists():
                    try:
                        import json
                        audio_meta = json.loads(audio_file.read_text(encoding="utf-8"))
                        raw_title = audio_meta.get("title", "").strip()
                        if raw_title:
                            safe_title = re.sub(r'[\\/*?:"<>|]', '', raw_title)[:50]
                            title = safe_title if safe_title else title
                    except:
                        pass

                # 检查缓存
                pdf_cache_file = NOTE_OUTPUT_DIR / f"{task_id}_{style}.pdf"
                pdf_content = None

                if pdf_cache_file.exists():
                    md_mtime = markdown_file.stat().st_mtime
                    pdf_mtime = pdf_cache_file.stat().st_mtime
                    if pdf_mtime >= md_mtime:
                        pdf_content = pdf_cache_file.read_bytes()

                # 生成 PDF
                if pdf_content is None:
                    markdown_content = markdown_file.read_text(encoding="utf-8")
                    if not markdown_content.strip():
                        failed_tasks.append({"task_id": task_id, "reason": "内容为空"})
                        continue

                    from markdown_pdf import MarkdownPdf, Section
                    clean_md = markdown_content.replace('\r\n', '\n')
                    clean_md = re.sub(r'\[([^\]]+)\]\(#([^\)]+)\)', r'\1', clean_md)

                    css_styles = PDF_STYLES.get(style, PDF_STYLES["default"])
                    md_pdf = MarkdownPdf()
                    md_pdf.add_section(Section(clean_md), user_css=css_styles)

                    pdf_buffer = io.BytesIO()
                    md_pdf.save(pdf_buffer)
                    pdf_content = pdf_buffer.getvalue()

                    # 保存缓存
                    try:
                        pdf_cache_file.write_bytes(pdf_content)
                    except:
                        pass

                # 添加到 ZIP
                zip_filename = f"{title}.pdf"
                zip_file.writestr(zip_filename, pdf_content)
                generated_count += 1

            except Exception as e:
                logger.warning(f"批量导出失败 (task_id={task_id}): {e}")
                failed_tasks.append({"task_id": task_id, "reason": str(e)})

    zip_buffer.seek(0)

    logger.info(f"批量导出完成: 成功 {generated_count}/{len(task_ids)}, 失败 {len(failed_tasks)}")

    return Response(
        content=zip_buffer.getvalue(),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''notes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
            "X-Generated-Count": str(generated_count),
            "X-Failed-Count": str(len(failed_tasks))
        }
    )


@router.get("/history")
async def get_export_history(limit: int = Query(default=50, ge=1, le=200)):
    """获取导出历史记录"""
    history = _get_export_history(limit)
    return {
        "total": len(history),
        "history": history
    }


@router.get("/history/{task_id}")
async def get_task_history(task_id: str):
    """获取指定任务的导出历史"""
    history = _get_export_history(1000)
    task_history = [h for h in history if h.get("task_id") == task_id]
    return {
        "task_id": task_id,
        "count": len(task_history),
        "history": task_history
    }


@router.get("/redownload/{task_id}")
async def redownload_pdf(
    task_id: str,
    style: StyleType = Query(default="default", description="PDF 样式主题")
):
    """重新下载历史 PDF（优先使用缓存）"""
    pdf_cache_file = NOTE_OUTPUT_DIR / f"{task_id}_{style}.pdf"
    if not pdf_cache_file.exists():
        raise HTTPException(status_code=404, detail="PDF 缓存不存在，请先导出一次")

    return FileResponse(
        path=pdf_cache_file,
        media_type="application/pdf",
        filename=f"{task_id}.pdf",
        headers={"X-PDF-Style": style}
    )


# ==================== 图文导出 API ====================

@router.get("/image/templates")
async def list_image_templates():
    """获取可用的图文模板列表"""
    from app.utils.image_export import get_available_templates

    templates = get_available_templates()
    return {
        "templates": templates,
        "total": len(templates)
    }


@router.get("/image/history/{task_id}")
async def get_image_history(task_id: str):
    """获取指定任务的图文导出历史"""
    history = _get_export_history(1000)
    image_history = [h for h in history if h.get("style", "").startswith("image_")]
    task_history = [h for h in image_history if h.get("task_id") == task_id]
    return {
        "task_id": task_id,
        "count": len(task_history),
        "history": task_history
    }


@router.get("/image/{task_id}")
async def export_image(
    task_id: str,
    template: ImageTemplate = Query(default="xiaohongshu", description="图文模板"),
    width: int = Query(default=1080, ge=400, le=1920, description="图片宽度"),
    format: ImageFormat = Query(default="png", description="图片格式")
):
    """
    导出笔记为图文（多张图片打包为 ZIP）

    Args:
        task_id: 任务 ID
        template: 模板类型 (xiaohongshu/simple/academic)
        width: 图片宽度 (400-1920)
        format: 图片格式 (png/jpg)

    Returns:
        ZIP 文件流（包含多张图片）
    """
    try:
        import zipfile
        from app.utils.image_export import export_note_as_image

        # 导出图片（返回多张图片）
        image_bytes_list, title = await export_note_as_image(task_id, template, width, format)

        # 构建基础文件名
        if title:
            safe_title = re.sub(r'[\\/*?:"<>|]', '', title).strip()[:150]
            if not safe_title:
                safe_title = f"note_{task_id[:8]}"
            base_filename = safe_title
        else:
            base_filename = f"note_{task_id}"

        # 如果只有一张图片，直接返回图片
        if len(image_bytes_list) == 1:
            filename = f"{base_filename}.{format}"
            filename_encoded = quote(filename.encode('utf-8'))
            
            logger.info(f"图文导出成功 (task_id={task_id}, 1张图片)")
            
            return Response(
                content=image_bytes_list[0],
                media_type=f"image/{format}",
                headers={
                    "Content-Disposition": f"attachment; filename*=UTF-8''{filename_encoded}",
                    "X-Image-Template": template,
                    "X-Image-Width": str(width),
                    "X-Image-Count": "1"
                }
            )

        # 多张图片，打包为 ZIP
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for idx, image_bytes in enumerate(image_bytes_list, start=1):
                image_filename = f"{base_filename}_{idx}.{format}"
                zip_file.writestr(image_filename, image_bytes)

        zip_buffer.seek(0)
        zip_filename = f"{base_filename}.zip"
        zip_filename_encoded = quote(zip_filename.encode('utf-8'))

        # 记录导出历史
        _add_export_history(task_id, f"image_{template}", title)

        logger.info(f"图文导出成功 (task_id={task_id}, {len(image_bytes_list)}张图片)")

        return Response(
            content=zip_buffer.getvalue(),
            media_type="application/zip",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{zip_filename_encoded}",
                "X-Image-Template": template,
                "X-Image-Width": str(width),
                "X-Image-Count": str(len(image_bytes_list))
            }
        )

    except FileNotFoundError as e:
        logger.warning(f"图文导出失败：{str(e)}")
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        logger.warning(f"图文导出失败：{str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"图文导出异常 (task_id={task_id}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"图文生成失败：{str(e)}")
