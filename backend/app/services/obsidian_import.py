import os
import re
import json
import shutil
import uuid
import zipfile
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from datetime import datetime

import yaml

from app.db.obsidian_dao import (
    create_import,
    update_import_status,
    batch_insert_notes,
    insert_attachment,
    get_all_notes_by_import,
    update_note_links,
    find_note_by_title,
)
from app.utils.logger import get_logger

logger = get_logger(__name__)

# 配置
NOTE_OUTPUT_DIR = Path(os.getenv("NOTE_OUTPUT_DIR", "note_results"))
ATTACHMENT_DIR = NOTE_OUTPUT_DIR / "obsidian_attachments"
MAX_ZIP_SIZE = 500 * 1024 * 1024  # 500MB

# 附件类型映射
ATTACHMENT_TYPES = {
    "image": {"jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "ico"},
    "pdf": {"pdf"},
    "audio": {"mp3", "wav", "ogg", "flac", "m4a", "aac"},
    "video": {"mp4", "webm", "mov", "avi"},
}

# 忽略的目录和文件
IGNORE_DIRS = {".obsidian", ".trash", ".git", "__MACOSX"}
IGNORE_EXTENSIONS = {".json", ".css", ".js", ".html"}


class ObsidianImporter:
    """Obsidian 笔记库导入器"""

    def __init__(self):
        self.temp_dir = None
        self.import_id = None
        self.file_mapping: Dict[str, str] = {}  # {文件名: 相对路径}
        self.note_id_mapping: Dict[str, int] = {}  # {文件名: note_id}

    def import_zip(self, zip_path: str, import_name: str) -> int:
        """
        主入口：导入 ZIP 文件
        返回 import_id
        """
        # 1. 创建导入记录
        import_record = create_import(import_name)
        self.import_id = import_record.id

        # 2. 创建临时目录
        self.temp_dir = Path(f"/tmp/obsidian_import_{uuid.uuid4().hex}")
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        try:
            # 3. 解压 ZIP
            update_import_status(self.import_id, "parsing", 5)
            md_files, attachment_files = self._extract_zip(zip_path)

            if not md_files:
                update_import_status(self.import_id, "failed", 0, "ZIP 中没有找到 .md 文件")
                return self.import_id

            # 4. 预扫描建立映射
            update_import_status(self.import_id, "parsing", 10)
            self._prescan(md_files)

            # 5. 解析所有 .md 文件
            update_import_status(self.import_id, "importing", 15)
            notes_data = self._parse_all(md_files, len(md_files))

            # 6. 批量插入笔记
            notes = batch_insert_notes(notes_data)
            for note in notes:
                # 用 title (不含扩展名) 作为 key
                self.note_id_mapping[note.title] = note.id

            # 7. 转换链接
            update_import_status(self.import_id, "importing", 80)
            self._resolve_links()

            # 8. 处理附件
            update_import_status(self.import_id, "importing", 90)
            self._copy_attachments(attachment_files)

            # 9. 完成
            update_import_status(self.import_id, "completed", 100)

        except Exception as e:
            logger.error(f"导入失败: {e}")
            update_import_status(self.import_id, "failed", 0, str(e))
        finally:
            # 10. 清理临时目录
            if self.temp_dir and self.temp_dir.exists():
                shutil.rmtree(self.temp_dir)

        return self.import_id

    def _extract_zip(self, zip_path: str) -> Tuple[List[Path], List[Path]]:
        """
        解压 ZIP，返回 (md_files, attachment_files)
        """
        md_files = []
        attachment_files = []

        with zipfile.ZipFile(zip_path, 'r') as zf:
            # 安全检查
            total_size = sum(info.file_size for info in zf.infolist())
            if total_size > MAX_ZIP_SIZE:
                raise ValueError(f"ZIP 文件过大 ({total_size / 1024 / 1024:.1f}MB)，最大限制 500MB")

            for info in zf.infolist():
                # 忽略目录和隐藏文件
                if info.is_dir() or info.filename.startswith('.') or '/.' in info.filename:
                    continue

                # 忽略特定目录
                parts = Path(info.filename).parts
                if any(part in IGNORE_DIRS for part in parts):
                    continue

                # 解压到临时目录
                zf.extract(info, self.temp_dir)
                extracted_path = self.temp_dir / info.filename

                ext = extracted_path.suffix.lower()
                if ext == ".md":
                    md_files.append(extracted_path)
                elif ext not in IGNORE_EXTENSIONS and ext != "":
                    attachment_files.append(extracted_path)

        logger.info(f"解压完成: {len(md_files)} 个 .md 文件, {len(attachment_files)} 个附件")
        return md_files, attachment_files

    def _prescan(self, md_files: List[Path]):
        """
        预扫描：建立文件名映射表
        """
        for md_file in md_files:
            # 获取相对路径（去掉临时目录前缀）
            relative_path = str(md_file.relative_to(self.temp_dir))
            # 用文件名（不含扩展名）作为 key
            stem = md_file.stem
            self.file_mapping[stem] = relative_path

        logger.info(f"预扫描完成: {len(self.file_mapping)} 个文件映射")

    def _parse_all(self, md_files: List[Path], total: int) -> List[dict]:
        """
        解析所有 .md 文件
        """
        notes_data = []
        for i, md_file in enumerate(md_files):
            try:
                data = self._parse_md(md_file)
                data["import_id"] = self.import_id
                notes_data.append(data)

                # 更新进度
                progress = 15 + int((i + 1) / total * 60)
                update_import_status(self.import_id, "importing", progress)

            except Exception as e:
                logger.warning(f"解析失败: {md_file}, {e}")
                # 失败的文件也尝试导入（用原始内容）
                relative_path = str(md_file.relative_to(self.temp_dir))
                notes_data.append({
                    "import_id": self.import_id,
                    "title": md_file.stem,
                    "file_path": relative_path,
                    "content": md_file.read_text(encoding="utf-8", errors="ignore"),
                    "raw_content": md_file.read_text(encoding="utf-8", errors="ignore"),
                    "yaml_meta": {},
                    "tags": "",
                    "links": "",
                    "broken_links": ""
                })

        return notes_data

    def _parse_md(self, md_file: Path) -> dict:
        """
        解析单个 .md 文件
        """
        # 尝试多种编码
        content = None
        for encoding in ["utf-8", "gbk", "latin-1"]:
            try:
                content = md_file.read_text(encoding=encoding)
                break
            except UnicodeDecodeError:
                continue

        if content is None:
            content = md_file.read_text(encoding="utf-8", errors="ignore")

        relative_path = str(md_file.relative_to(self.temp_dir))
        raw_content = content

        # 分离 YAML front matter
        yaml_meta = {}
        body = content
        yaml_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        if yaml_match:
            yaml_text = yaml_match.group(1)
            try:
                yaml_meta = yaml.safe_load(yaml_text) or {}
            except yaml.YAMLError:
                logger.warning(f"YAML 解析失败: {md_file}")
                yaml_meta = {}
            body = content[yaml_match.end():]

        # 标题：优先 YAML title，其次文件名
        title = yaml_meta.get("title") or md_file.stem

        # 同名冲突检查
        existing = find_note_by_title(self.import_id, title)
        if existing:
            # 重命名
            suffix = f"_imported_{datetime.now().strftime('%H%M%S')}"
            title = f"{title}{suffix}"
            logger.info(f"同名冲突，重命名: {md_file.stem} -> {title}")

        # 提取 #标签
        tags = re.findall(r"(?<!\w)#(\w[\w-]*)", body)
        tags_str = ",".join(tags) if tags else ""

        # 提取 [[链接]]
        links = re.findall(r"\[\[([^\]]+)\]\]", body)
        links_str = ",".join(links) if links else ""

        # 提取 ![[附件]]
        attachments = re.findall(r"!\[\[([^\]]+)\]\]", body)

        # 构建返回数据
        return {
            "title": title,
            "file_path": relative_path,
            "content": body,  # 先保留原始，后面会转换链接
            "raw_content": raw_content,
            "yaml_meta": yaml_meta,
            "tags": tags_str,
            "links": "",  # 后面填充
            "broken_links": "",
            "_raw_links": links,  # 临时存储，用于后续转换
            "_attachments": attachments
        }

    def _resolve_links(self):
        """
        第二遍扫描：转换 [[链接]] 为内部 note_id
        """
        notes = get_all_notes_by_import(self.import_id)
        for note in notes:
            content = note.content
            raw_links = re.findall(r"\[\[([^\]]+)\]\]", content)

            resolved_links = []
            broken_links = []

            for link_name in raw_links:
                # 尝试匹配
                target_id = self.note_id_mapping.get(link_name)
                if target_id:
                    resolved_links.append(str(target_id))
                    # 替换内容中的链接
                    content = content.replace(f"[[{link_name}]]", f"[[note:{target_id}|{link_name}]]")
                else:
                    broken_links.append(link_name)

            # 更新笔记
            update_note_links(note.id, ",".join(resolved_links), ",".join(broken_links))

    def _copy_attachments(self, attachment_files: List[Path]):
        """
        处理附件：复制到指定目录，更新笔记中的路径
        """
        if not attachment_files:
            return

        # 创建附件目录
        attachment_output = ATTACHMENT_DIR / str(self.import_id)
        attachment_output.mkdir(parents=True, exist_ok=True)

        notes = get_all_notes_by_import(self.import_id)
        note_map = {note.file_path: note for note in notes}

        for attachment in attachment_files:
            original_path = str(attachment.relative_to(self.temp_dir))

            # 确定文件类型
            ext = attachment.suffix.lower()
            file_type = "other"
            for type_name, extensions in ATTACHMENT_TYPES.items():
                if ext.lstrip(".") in extensions:
                    file_type = type_name
                    break

            # 复制文件
            stored_name = attachment.name
            stored_path = attachment_output / stored_name
            shutil.copy2(attachment, stored_path)

            file_size = attachment.stat().st_size

            # 插入附件记录
            insert_attachment({
                "import_id": self.import_id,
                "original_path": original_path,
                "stored_path": str(stored_path.relative_to(NOTE_OUTPUT_DIR)),
                "file_type": file_type,
                "file_size": file_size
            })

            # 更新笔记中引用该附件的路径（简单匹配文件名）
            for note in notes:
                if f"![[{attachment.name}]]" in note.content:
                    new_ref = f"![{attachment.name}](/{stored_path.relative_to(NOTE_OUTPUT_DIR)})"
                    note.content = note.content.replace(f"![[{attachment.name}]]", new_ref)


def get_progress(import_id: int) -> dict:
    """
    获取导入进度
    """
    from app.db.obsidian_dao import get_import_by_id
    import_record = get_import_by_id(import_id)
    if not import_record:
        return {"error": "导入记录不存在"}

    return {
        "import_id": import_record.id,
        "status": import_record.status,
        "progress": import_record.progress,
        "error_message": import_record.error_message
    }