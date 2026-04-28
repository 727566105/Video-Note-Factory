import os
import uuid
import threading
import time
import json
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import StreamingResponse

from app.db.obsidian_dao import (
    create_import,
    get_imports,
    delete_import,
    get_notes,
    get_note_by_id,
    update_import_status,
)
from app.services.obsidian_import import ObsidianImporter, get_progress
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

UPLOAD_DIR = "uploads"
NOTE_OUTPUT_DIR = Path(os.getenv("NOTE_OUTPUT_DIR", "note_results"))
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/obsidian/import")
async def import_obsidian(file: UploadFile = File(...), import_name: Optional[str] = Form(None)):
    """上传 ZIP 文件，创建 Obsidian 导入任务"""
    # 校验文件类型
    if not file.filename.endswith(".zip"):
        return R.error("请上传 ZIP 文件")

    # 保存上传文件
    safe_name = f"{uuid.uuid4().hex}.zip"
    zip_path = os.path.join(UPLOAD_DIR, safe_name)
    content = await file.read()
    with open(zip_path, "wb") as f:
        f.write(content)

    name = import_name or file.filename.replace(".zip", "")

    # 创建导入记录
    import_record = create_import(name)
    import_id = import_record.id

    # 后台线程执行导入
    def run_import():
        try:
            importer = ObsidianImporter()
            importer.import_zip(zip_path, name)
        except Exception as e:
            logger.error(f"导入失败: {e}")
            update_import_status(import_id, "failed", 0, str(e))
        finally:
            # 清理
            try:
                os.remove(zip_path)
            except:
                pass

    thread = threading.Thread(target=run_import, daemon=True)
    thread.start()

    return R.success({"import_id": import_id}, "导入任务已启动")


@router.get("/obsidian/import/{import_id}/progress")
def import_progress(import_id: int):
    """SSE 推送导入进度"""
    def event_generator():
        while True:
            data = get_progress(import_id)
            yield f"data: {json.dumps(data)}\n\n"
            if data.get("status") in ("completed", "failed"):
                break
            time.sleep(1)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/obsidian/imports")
def list_imports():
    """获取导入历史列表"""
    imports = get_imports()
    result = [{
        "id": imp.id,
        "import_name": imp.import_name,
        "file_count": imp.file_count,
        "status": imp.status,
        "progress": imp.progress,
        "error_message": imp.error_message,
        "created_at": imp.created_at.isoformat() if imp.created_at else None
    } for imp in imports]
    return R.success(result)


@router.delete("/obsidian/import/{import_id}")
def remove_import(import_id: int):
    """删除导入批次及所有关联数据"""
    # 删除附件文件
    attachment_dir = NOTE_OUTPUT_DIR / "obsidian_attachments" / str(import_id)
    if attachment_dir.exists():
        shutil.rmtree(attachment_dir)

    success = delete_import(import_id)
    if success:
        return R.success(msg="删除成功")
    return R.error("导入记录不存在")


@router.get("/obsidian/notes")
def list_notes(import_id: Optional[int] = None, keyword: Optional[str] = None, tag: Optional[str] = None):
    """搜索/浏览已导入笔记"""
    notes = get_notes(import_id=import_id, keyword=keyword, tag=tag)
    result = [{
        "id": note.id,
        "import_id": note.import_id,
        "title": note.title,
        "file_path": note.file_path,
        "tags": note.tags,
        "links": note.links,
        "broken_links": note.broken_links,
        "created_at": note.created_at.isoformat() if note.created_at else None
    } for note in notes]
    return R.success(result)


@router.get("/obsidian/notes/{note_id}")
def note_detail(note_id: int):
    """获取笔记详情"""
    note = get_note_by_id(note_id)
    if not note:
        return R.error("笔记不存在")

    # 获取关联笔记
    linked_notes = []
    if note.links:
        for link_id in note.links.split(","):
            if link_id.strip().isdigit():
                linked = get_note_by_id(int(link_id.strip()))
                if linked:
                    linked_notes.append({"id": linked.id, "title": linked.title})

    return R.success({
        "id": note.id,
        "import_id": note.import_id,
        "title": note.title,
        "file_path": note.file_path,
        "content": note.content,
        "raw_content": note.raw_content,
        "yaml_meta": note.yaml_meta,
        "tags": note.tags,
        "links": note.links,
        "broken_links": note.broken_links,
        "linked_notes": linked_notes,
        "created_at": note.created_at.isoformat() if note.created_at else None
    })