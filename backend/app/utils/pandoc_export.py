"""Pandoc 转换工具 — 将 Markdown 转换为 HTML / DOCX / EPUB"""
import subprocess
import shutil
import tempfile
import re
from pathlib import Path

from app.utils.logger import get_logger
from app.utils.path_helper import get_video_folder

logger = get_logger(__name__)

SUPPORTED_FORMATS = ("html", "docx", "epub")


def is_pandoc_available() -> bool:
    return shutil.which("pandoc") is not None


def _resolve_image_paths(
    markdown_content: str,
    video_folder: Path | None,
) -> str:
    """
    将 Markdown 中的 API 图片 URL 转换为本地绝对路径。

    匹配模式：
    - /api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}
    - /api/video_cover/{platform}/{author_id}/{video_id}
    - /api/image_proxy?url=...
    """
    if not video_folder or not video_folder.exists():
        return markdown_content

    # 匹配截图 URL: /api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}
    screenshot_pattern = r'/api/video_screenshots/[^/]+/[^/]+/[^/]+/([^)]+)'
    def replace_screenshot(match):
        filename = match.group(1)
        local_path = video_folder / "screenshots" / filename
        if local_path.exists():
            return str(local_path.absolute())
        logger.warning(f"截图文件不存在: {local_path}")
        return match.group(0)  # 保持原样

    markdown_content = re.sub(screenshot_pattern, replace_screenshot, markdown_content)

    # 匹配封面 URL: /api/video_cover/{platform}/{author_id}/{video_id}
    cover_pattern = r'/api/video_cover/[^/]+/[^/]+/[^/]+'
    def replace_cover(match):
        local_path = video_folder / "cover.jpg"
        if local_path.exists():
            return str(local_path.absolute())
        return match.group(0)

    markdown_content = re.sub(cover_pattern, replace_cover, markdown_content)

    return markdown_content


def export_with_pandoc(
    markdown_content: str,
    output_format: str,
    output_path: Path,
    title: str = "",
    cover_path: Path | None = None,
    video_folder: Path | None = None,
) -> Path:
    """
    用 Pandoc 将 Markdown 转换为目标格式。

    Args:
        markdown_content: Markdown 文本
        output_format: "html" | "docx" | "epub"
        output_path: 输出文件路径
        title: 文档标题
        cover_path: 封面图路径（仅 EPUB 使用）
        video_folder: 视频四级目录路径（用于解析本地图片）

    Returns:
        输出文件路径
    """
    if output_format not in SUPPORTED_FORMATS:
        raise ValueError(f"不支持的格式: {output_format}，支持: {SUPPORTED_FORMATS}")

    if not is_pandoc_available():
        raise RuntimeError("Pandoc 未安装，请先安装: brew install pandoc (macOS) 或 apt install pandoc (Linux)")

    # 将 API 图片 URL 转换为本地绝对路径
    markdown_content = _resolve_image_paths(markdown_content, video_folder)

    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".md", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(markdown_content)
        tmp_md = Path(tmp.name)

    try:
        cmd = _build_command(tmp_md, output_path, output_format, title, cover_path)
        logger.info(f"Pandoc 命令: {' '.join(cmd)}")
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=60
        )
        if result.returncode != 0:
            logger.error(f"Pandoc 错误: {result.stderr}")
            raise RuntimeError(f"Pandoc 转换失败: {result.stderr[:200]}")
        if not output_path.exists():
            raise RuntimeError("Pandoc 转换后输出文件不存在")
        logger.info(f"Pandoc 转换成功: {output_path}")
        return output_path
    finally:
        tmp_md.unlink(missing_ok=True)


def _build_command(
    input_md: Path,
    output_path: Path,
    fmt: str,
    title: str,
    cover_path: Path | None,
) -> list[str]:
    cmd = ["pandoc", str(input_md), "-o", str(output_path)]

    if fmt == "html":
        cmd.extend(["--standalone", "--self-contained"])
        if title:
            cmd.extend(["--metadata", f"title={title}"])
    elif fmt == "docx":
        pass
    elif fmt == "epub":
        if title:
            cmd.extend(["--metadata", f"title={title}"])
        if cover_path and cover_path.exists():
            cmd.extend(["--epub-cover-image", str(cover_path)])

    return cmd
