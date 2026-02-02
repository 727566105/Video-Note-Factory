"""
图文导出工具模块
使用 Playwright 将 Markdown 内容渲染为精美图片
"""
import re
import json
import asyncio
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from app.utils.logger import get_logger
from app.utils.response import ResponseWrapper as R

logger = get_logger(__name__)

# 笔记输出目录
NOTE_OUTPUT_DIR = Path(__file__).parent.parent.parent / "note_results"

# 图片格式类型
ImageFormat = Literal["png", "jpg", "jpeg"]
ImageTemplate = Literal["xiaohongshu", "simple", "academic"]

# 图文模板配置
IMAGE_TEMPLATES = {
    "xiaohongshu": {
        "width": 1080,
        "padding": 60,
        "background": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        "font": "'Noto Sans SC', sans-serif",
        "accent_color": "#FF6B9D",
        "layout": "card",
        "css": """
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

@page {
    size: A4;
    margin: 0;
}

body {
    font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.8;
    background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
    margin: 0;
    padding: 60px;
    color: #2d3436;
}

.container {
    background: #ffffff;
    border-radius: 30px;
    padding: 70px;
    box-shadow: 0 30px 80px rgba(252, 182, 159, 0.4);
    position: relative;
    overflow: hidden;
}

.container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 8px;
    background: linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3);
}

h1, h2, h3, h4, h5, h6 {
    color: #2d3436;
    margin-top: 2em;
    margin-bottom: 1em;
    font-weight: 700;
    letter-spacing: -0.02em;
    page-break-after: avoid;
    break-after: avoid;
}

h1 {
    font-size: 48px;
    font-weight: 900;
    text-align: center;
    background: linear-gradient(135deg, #ff6b6b 0%, #feca57 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-top: 0;
    margin-bottom: 50px;
    line-height: 1.3;
    padding-bottom: 20px;
    border-bottom: 3px solid #ffe5e5;
}

h2 { 
    font-size: 36px;
    color: #ff6b6b;
    padding-left: 25px;
    border-left: 6px solid #ff6b6b;
    margin-top: 2.5em;
}

h3 { 
    font-size: 28px;
    color: #636e72;
}

h4 { 
    font-size: 24px;
    color: #636e72;
}

p { 
    margin-bottom: 1.4em;
    font-size: 19px;
    color: #2d3436;
    line-height: 2;
    orphans: 3;
    widows: 3;
    page-break-inside: avoid;
    break-inside: avoid;
}

code {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    color: #ffffff;
    padding: 5px 12px;
    border-radius: 8px;
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-size: 0.9em;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
}

pre {
    background: linear-gradient(135deg, #2d3436 0%, #000000 100%);
    padding: 30px;
    border-radius: 20px;
    overflow-x: auto;
    line-height: 1.7;
    margin: 2em 0;
    box-shadow: 0 15px 40px rgba(0,0,0,0.3);
    page-break-inside: avoid;
    break-inside: avoid;
}

pre code { 
    background: transparent;
    padding: 0;
    color: #feca57;
    font-weight: 400;
    box-shadow: none;
}

blockquote {
    border-left: 6px solid #ff6b6b;
    padding: 25px 30px;
    margin: 2.5em 0;
    background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
    border-radius: 15px;
    font-style: italic;
    color: #636e72;
    box-shadow: 0 8px 20px rgba(255, 107, 107, 0.15);
    page-break-inside: avoid;
    break-inside: avoid;
}
    color: #4a5568;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    page-break-inside: avoid;
    break-inside: avoid;
}

ul, ol { 
    padding-left: 2em;
    margin-bottom: 1.5em;
}

li { 
    margin-bottom: 1em;
    color: #2d3436;
    font-size: 19px;
    line-height: 1.9;
}

ul li::marker {
    color: #ff6b6b;
    font-size: 1.3em;
}

ol li::marker {
    color: #ff6b6b;
    font-weight: 700;
}

table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    margin: 2.5em 0;
    border-radius: 15px;
    overflow: hidden;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    page-break-inside: avoid;
    break-inside: avoid;
}

th, td {
    padding: 18px 24px;
    text-align: left;
    border-bottom: 1px solid #ffe5e5;
}

th { 
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
    font-weight: 700;
    color: #ffffff;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

td {
    background: #ffffff;
    color: #2d3436;
    font-size: 18px;
}

tr:nth-child(even) td {
    background: #fff5f5;
}

tr:last-child td {
    border-bottom: none;
}

a { 
    color: #ff6b6b;
    text-decoration: none;
    font-weight: 600;
    border-bottom: 2px solid transparent;
    transition: all 0.3s;
}

a:hover { 
    border-bottom-color: #ff6b6b;
}

hr {
    border: none;
    height: 3px;
    background: linear-gradient(90deg, transparent, #ffe5e5, transparent);
    margin: 3.5em 0;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 3em auto;
    border-radius: 20px;
    box-shadow: 0 20px 50px rgba(0,0,0,0.15);
    page-break-inside: avoid;
    break-inside: avoid;
}

.footer {
    text-align: center;
    color: #b2bec3;
    font-size: 15px;
    margin-top: 70px;
    padding-top: 35px;
    border-top: 2px solid #ffe5e5;
    font-weight: 500;
}

strong {
    color: #2d3436;
    font-weight: 700;
}

em {
    color: #ff6b6b;
    font-style: italic;
}
"""
    },

    "simple": {
        "width": 1080,
        "padding": 80,
        "background": "#f8f9fa",
        "font": "'Noto Sans SC', sans-serif",
        "accent_color": "#0066cc",
        "layout": "minimal",
        "css": """
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

@page {
    size: A4;
    margin: 0;
}

body {
    font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
    line-height: 1.8;
    background: #f8f9fa;
    margin: 0;
    padding: 70px 80px;
    color: #1a1a1a;
}

h1, h2, h3, h4, h5, h6 {
    color: #1a1a1a;
    margin-top: 2em;
    margin-bottom: 1em;
    font-weight: 600;
    letter-spacing: -0.01em;
    page-break-after: avoid;
    break-after: avoid;
}

h1 {
    font-size: 48px;
    font-weight: 700;
    text-align: center;
    margin-top: 0;
    margin-bottom: 50px;
    line-height: 1.2;
    color: #000;
}

h2 { 
    font-size: 36px;
    font-weight: 600;
    margin-top: 2.5em;
}

h3 { font-size: 28px; font-weight: 600; }
h4 { font-size: 22px; font-weight: 500; }

p { 
    margin-bottom: 1.3em;
    font-size: 19px;
    color: #333;
    line-height: 1.9;
    orphans: 3;
    widows: 3;
    page-break-inside: avoid;
    break-inside: avoid;
}

code {
    background: #000;
    color: #0ff;
    padding: 4px 10px;
    border-radius: 5px;
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-size: 0.88em;
    font-weight: 500;
}

pre {
    background: #1a1a1a;
    padding: 28px;
    border-radius: 12px;
    overflow-x: auto;
    line-height: 1.6;
    margin: 2em 0;
    page-break-inside: avoid;
    break-inside: avoid;
}

pre code { 
    background: transparent;
    padding: 0;
    color: #0ff;
}

blockquote {
    border-left: 4px solid #0066cc;
    padding: 20px 30px;
    margin: 2em 0;
    background: #fff;
    border-radius: 8px;
    font-size: 18px;
    color: #555;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    page-break-inside: avoid;
    break-inside: avoid;
}

ul, ol { 
    padding-left: 2em;
    margin-bottom: 1.5em;
    page-break-inside: avoid;
    break-inside: avoid;
}

li { 
    margin-bottom: 0.8em;
    color: #333;
    font-size: 19px;
    line-height: 1.8;
}

ul li::marker {
    color: #0066cc;
}

table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    margin: 2em 0;
    border-radius: 10px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    page-break-inside: avoid;
    break-inside: avoid;
}

th, td {
    padding: 18px 24px;
    text-align: left;
    border-bottom: 1px solid #e9ecef;
}

th { 
    background: #000;
    font-weight: 600;
    color: #fff;
    font-size: 15px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
}

td {
    background: #fff;
    color: #333;
    font-size: 17px;
}

tr:last-child td {
    border-bottom: none;
}

a { 
    color: #0066cc;
    text-decoration: none;
    font-weight: 500;
    border-bottom: 1px solid transparent;
}

a:hover { 
    border-bottom-color: #0066cc;
}

hr {
    border: none;
    height: 1px;
    background: #dee2e6;
    margin: 3em 0;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 2.5em auto;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    page-break-inside: avoid;
    break-inside: avoid;
}

.footer {
    text-align: center;
    color: #999;
    font-size: 14px;
    margin-top: 70px;
    padding-top: 30px;
    border-top: 1px solid #dee2e6;
    font-weight: 400;
}

strong {
    color: #000;
    font-weight: 700;
}

em {
    color: #0066cc;
    font-style: italic;
}
"""
    },

    "academic": {
        "width": 1080,
        "padding": 100,
        "background": "#fafafa",
        "font": "'Noto Serif SC', serif",
        "accent_color": "#1e3a8a",
        "layout": "formal",
        "css": """
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

@page {
    size: A4;
    margin: 0;
}

body {
    font-family: 'Noto Serif SC', Georgia, 'Times New Roman', serif;
    line-height: 1.9;
    background: #fafafa;
    margin: 0;
    padding: 90px 100px;
    color: #1a1a1a;
}

h1, h2, h3, h4, h5, h6 {
    color: #0a0a0a;
    margin-top: 2.2em;
    margin-bottom: 1em;
    font-weight: 700;
    letter-spacing: -0.01em;
    page-break-after: avoid;
    break-after: avoid;
}

h1 {
    font-size: 40px;
    text-align: center;
    font-weight: 700;
    margin-top: 0;
    margin-bottom: 50px;
    line-height: 1.3;
    color: #1e3a8a;
    border-bottom: 3px solid #1e3a8a;
    padding-bottom: 20px;
}

h2 {
    font-size: 30px;
    border-bottom: 2px solid #cbd5e1;
    padding-bottom: 12px;
    margin-top: 2.5em;
    color: #1e3a8a;
}

h3 { font-size: 24px; color: #334155; }
h4 { font-size: 20px; color: #475569; }

p {
    margin-bottom: 1.2em;
    text-align: justify;
    font-size: 18px;
    color: #1a1a1a;
    line-height: 2;
    orphans: 3;
    widows: 3;
    page-break-inside: avoid;
    break-inside: avoid;
}

code {
    background: #1e3a8a;
    color: #fbbf24;
    padding: 4px 10px;
    border-radius: 4px;
    font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
    font-size: 0.88em;
    font-weight: 500;
}

pre {
    background: #1e293b;
    padding: 24px;
    border-radius: 8px;
    border-left: 5px solid #1e3a8a;
    page-break-inside: avoid;
    break-inside: avoid;
    overflow-x: auto;
    line-height: 1.7;
    margin: 2em 0;
}

pre code { 
    background: transparent;
    padding: 0;
    color: #fbbf24;
}

blockquote {
    border-left: 5px solid #1e3a8a;
    padding: 20px 30px;
    margin: 2em 0;
    background: #f1f5f9;
    font-style: italic;
    color: #334155;
    border-radius: 4px;
    font-size: 17px;
    page-break-inside: avoid;
    break-inside: avoid;
}

ul, ol { 
    padding-left: 2.5em;
    margin-bottom: 1.5em;
    page-break-inside: avoid;
    break-inside: avoid;
}

li { 
    margin-bottom: 0.7em;
    color: #1a1a1a;
    font-size: 18px;
    line-height: 1.9;
}

ul li::marker {
    color: #1e3a8a;
}

table {
    border-collapse: collapse;
    width: 100%;
    margin: 2em 0;
    font-size: 16px;
    border: 2px solid #1e3a8a;
    page-break-inside: avoid;
    break-inside: avoid;
}

th, td {
    border: 1px solid #cbd5e1;
    padding: 14px 20px;
    text-align: left;
}

th { 
    background: #1e3a8a;
    font-weight: 700;
    color: #ffffff;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 14px;
}

td {
    background: #ffffff;
    color: #1a1a1a;
}

tr:nth-child(even) td {
    background: #f8fafc;
}

a { 
    color: #1e3a8a;
    text-decoration: none;
    border-bottom: 1px solid #1e3a8a;
    font-weight: 500;
}

hr {
    border: none;
    border-top: 2px solid #cbd5e1;
    margin: 3em 0;
}

img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 2em auto;
    border: 2px solid #cbd5e1;
    border-radius: 4px;
    page-break-inside: avoid;
    break-inside: avoid;
}

.footer {
    text-align: center;
    color: #64748b;
    font-size: 13px;
    margin-top: 70px;
    padding-top: 30px;
    border-top: 2px solid #cbd5e1;
    font-style: italic;
    font-weight: 500;
}

strong {
    color: #0a0a0a;
    font-weight: 700;
}

em {
    color: #1e3a8a;
    font-style: italic;
}
"""
    }
}


def _markdown_to_html(markdown_content: str, template: ImageTemplate = "xiaohongshu") -> str:
    """
    将 Markdown 转换为 HTML（使用 markdown 库）

    复用现有的 markdown_pdf 转换逻辑，仅用于获取 HTML
    """
    try:
        import markdown
        from markdown.extensions import fenced_code, tables, nl2br, sane_lists

        # 配置 Markdown 扩展
        md = markdown.Markdown(
            extensions=[
                'fenced_code',
                'tables',
                'nl2br',
                'sane_lists',
                'attr_list',
                'def_list',
                'abbr',
                'footnotes',
            ]
        )

        html_content = md.convert(markdown_content)

        # 清理 HTML：移除锚点链接
        html_content = re.sub(r'<a\s+href="#[^"]*"\s*name="[^"]*"\s*id="[^"]*">([^<]*)</a>', r'\1', html_content)
        html_content = re.sub(r'\s+name="[^"]*"', '', html_content)

        return html_content

    except ImportError:
        logger.error("markdown 包未安装")
        raise ImportError("需要安装 markdown 包")
    except Exception as e:
        logger.error(f"Markdown 转 HTML 失败: {e}")
        raise


def _process_images_in_markdown(markdown_content: str, base_url: str = "") -> str:
    """
    处理 Markdown 中的图片路径，转换为 base64 或完整 URL
    复用 export.py 中的图片处理逻辑
    """
    import base64
    import mimetypes
    import os

    BASE_DIR = Path(__file__).parent.parent.parent
    STATIC_BASE = str(Path(base_url).resolve()) if base_url else str(BASE_DIR)

    def repl_image(match):
        alt_text = match.group(1) if match.group(1) else ""
        img_path = match.group(2).strip()

        # 处理 /static/ 开头的路径 - 转换为 base64
        if img_path.startswith("/static/"):
            relative_path = img_path.lstrip("/")
            abs_path = os.path.join(BASE_DIR, relative_path)
            abs_path = os.path.normpath(os.path.abspath(abs_path))

            if os.path.exists(abs_path):
                try:
                    ext = os.path.splitext(abs_path)[1].lower()
                    mime_map = {
                        '.png': 'image/png',
                        '.jpg': 'image/jpeg',
                        '.jpeg': 'image/jpeg',
                        '.gif': 'image/gif',
                        '.webp': 'image/webp',
                    }
                    mime_type = mime_map.get(ext, 'image/png')

                    with open(abs_path, 'rb') as f:
                        img_data = f.read()
                    base64_data = base64.b64encode(img_data).decode('utf-8')
                    return f'![{alt_text}](data:{mime_type};base64,{base64_data})'
                except Exception as e:
                    logger.warning(f"图片 base64 转换失败 {abs_path}: {e}")

        # HTTP/HTTPS 路径保持不变
        elif img_path.startswith(('http://', 'https://')):
            return match.group(0)

        # 其他路径尝试转换为绝对路径
        return match.group(0)

    pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    return re.sub(pattern, repl_image, markdown_content)


def render_template(markdown_content: str, template: ImageTemplate = "xiaohongshu",
                    title: str = "", platform: str = "", date: str = "") -> str:
    """
    渲染 HTML 模板

    Args:
        markdown_content: Markdown 内容
        template: 模板类型
        title: 笔记标题
        platform: 视频平台
        date: 日期

    Returns:
        完整的 HTML 字符串
    """
    # 获取模板配置
    template_config = IMAGE_TEMPLATES.get(template, IMAGE_TEMPLATES["xiaohongshu"])

    # 处理图片
    processed_md = _process_images_in_markdown(markdown_content)

    # 转换为 HTML
    content_html = _markdown_to_html(processed_md, template)

    # 构建 HTML
    html_template = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title or '笔记'}</title>
    <style>{template_config['css']}</style>
</head>
<body>
    <div class="container">
        {f'<h1>{title}</h1>' if title else ''}
        {f'<div class="meta"><span>{platform}</span><span>{date}</span></div>' if platform or date else ''}
        <div class="content">
            {content_html}
        </div>
        <div class="footer">Generated by Video Note Factory</div>
    </div>
</body>
</html>"""

    return html_template


def html_to_image_sync(html_content: str, width: int = 1080,
                       image_format: ImageFormat = "png") -> list[bytes]:
    """
    使用 WeasyPrint + pdf2image 将 HTML 转换为多张图片（同步版本）

    Args:
        html_content: HTML 内容
        width: 图片宽度
        image_format: 输出格式 (png/jpg)

    Returns:
        图片二进制数据列表（每页一张图片）
    """
    try:
        import io
        from weasyprint import HTML
        from pdf2image import convert_from_bytes

        # 1. 使用 WeasyPrint 将 HTML 导出为 PDF 字节
        html_obj = HTML(string=html_content, base_url="file://")
        pdf_bytes = html_obj.write_pdf()

        # 2. 使用 pdf2image 将 PDF 转换为 PIL 图片（所有页面）
        images = convert_from_bytes(pdf_bytes, dpi=150)
        
        if not images:
            raise Exception("PDF 转换失败，未生成任何图片")

        # 3. 将每页转换为字节数组
        image_bytes_list = []
        output_format = 'PNG' if image_format == 'png' else 'JPEG'
        
        for img in images:
            img_byte_arr = io.BytesIO()
            img.save(img_byte_arr, format=output_format)
            image_bytes_list.append(img_byte_arr.getvalue())
        
        logger.info(f"成功生成 {len(image_bytes_list)} 张图片")
        return image_bytes_list

    except ImportError as e:
        logger.error(f"缺少依赖包: {e}")
        raise ImportError("需要安装 WeasyPrint, Pillow 和 pdf2image: pip install weasyprint Pillow pdf2image")
    except Exception as e:
        logger.error(f"HTML 转图片失败: {e}", exc_info=True)
        raise


async def html_to_image(html_content: str, width: int = 1080,
                        image_format: ImageFormat = "png") -> list[bytes]:
    """
    使用 WeasyPrint 将 HTML 转换为多张图片（异步版本，调用同步函数）

    Args:
        html_content: HTML 内容
        width: 图片宽度
        image_format: 输出格式 (png/jpg)

    Returns:
        图片二进制数据列表（每页一张图片）
    """
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, html_to_image_sync, html_content, width, image_format)


async def export_note_as_image(
    task_id: str,
    template: ImageTemplate = "xiaohongshu",
    width: int = 1080,
    image_format: ImageFormat = "png"
) -> tuple[list[bytes], str | None]:
    """
    导出笔记为多张图片（完整流程）

    Args:
        task_id: 任务 ID
        template: 模板类型
        width: 图片宽度
        image_format: 输出格式

    Returns:
        (图片二进制数据列表, 标题)
    """
    # 检查 Markdown 文件是否存在
    markdown_file = NOTE_OUTPUT_DIR / f"{task_id}_markdown.md"

    if not markdown_file.exists():
        raise FileNotFoundError(f"笔记不存在 (task_id={task_id})")

    # 读取 Markdown 内容
    markdown_content = markdown_file.read_text(encoding="utf-8")

    if not markdown_content.strip():
        raise ValueError("笔记内容为空")

    # 读取笔记元数据（标题、平台、日期）
    title = None
    platform = ""
    date_str = ""

    audio_cache_file = NOTE_OUTPUT_DIR / f"{task_id}_audio.json"
    if audio_cache_file.exists():
        try:
            audio_meta = json.loads(audio_cache_file.read_text(encoding="utf-8"))
            title = audio_meta.get("title", "").strip()
            platform = audio_meta.get("platform", "")
            date_str = audio_meta.get("date", "")

            logger.info(f"读取到元数据 (task_id={task_id}): title={title[:30] if title else 'N/A'}...")
        except Exception as e:
            logger.warning(f"读取元数据失败 (task_id={task_id}): {e}")

    # 渲染 HTML
    html_content = render_template(markdown_content, template, title or "", platform, date_str)

    # 转换为多张图片
    image_bytes_list = await html_to_image(html_content, width, image_format)

    logger.info(f"成功导出 {len(image_bytes_list)} 张图片 (task_id={task_id}, template={template})")

    return image_bytes_list, title


def get_available_templates() -> list[dict]:
    """
    获取可用的图文模板列表
    """
    return [
        {
            "id": "xiaohongshu",
            "name": "温暖橙粉",
            "description": "温暖渐变，柔和配色，适合生活分享",
            "width": 1080,
            "preview": "/templates/xiaohongshu-preview.png"
        },
        {
            "id": "simple",
            "name": "极简黑白",
            "description": "黑白配色，极简设计，专业现代",
            "width": 1080,
            "preview": "/templates/simple-preview.png"
        },
        {
            "id": "academic",
            "name": "学术蓝",
            "description": "深蓝配色，正式排版，适合学术笔记",
            "width": 1080,
            "preview": "/templates/academic-preview.png"
        }
    ]
