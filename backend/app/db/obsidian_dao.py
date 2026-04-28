import json
from typing import List, Optional
from sqlalchemy.orm import Session

from app.db.models.obsidian import ObsidianImport, ObsidianNote, ObsidianAttachment
from app.db.engine import SessionLocal, get_db
from app.utils.logger import get_logger

logger = get_logger(__name__)


def create_import(import_name: str, file_count: int = 0) -> ObsidianImport:
    """创建导入批次"""
    db = SessionLocal()
    try:
        import_record = ObsidianImport(
            import_name=import_name,
            file_count=file_count,
            status="pending",
            progress=0
        )
        db.add(import_record)
        db.commit()
        db.refresh(import_record)
        return import_record
    finally:
        db.close()


def get_import_by_id(import_id: int) -> Optional[ObsidianImport]:
    """获取导入批次"""
    db = SessionLocal()
    try:
        return db.query(ObsidianImport).filter_by(id=import_id).first()
    finally:
        db.close()


def update_import_status(import_id: int, status: str, progress: int = None, error_message: str = None):
    """更新导入状态"""
    db = SessionLocal()
    try:
        import_record = db.query(ObsidianImport).filter_by(id=import_id).first()
        if import_record:
            import_record.status = status
            if progress is not None:
                import_record.progress = progress
            if error_message is not None:
                import_record.error_message = error_message
            db.commit()
    finally:
        db.close()


def get_imports(limit: int = 50) -> List[ObsidianImport]:
    """获取导入历史列表"""
    db = SessionLocal()
    try:
        return db.query(ObsidianImport).order_by(ObsidianImport.created_at.desc()).limit(limit).all()
    finally:
        db.close()


def delete_import(import_id: int) -> bool:
    """删除导入批次及所有关联数据"""
    db = SessionLocal()
    try:
        import_record = db.query(ObsidianImport).filter_by(id=import_id).first()
        if import_record:
            db.delete(import_record)
            db.commit()
            return True
        return False
    except Exception as e:
        logger.error(f"删除导入批次失败: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def batch_insert_notes(notes_data: List[dict]) -> List[ObsidianNote]:
    """批量插入笔记"""
    db = SessionLocal()
    try:
        notes = []
        for data in notes_data:
            note = ObsidianNote(
                import_id=data["import_id"],
                title=data["title"],
                file_path=data["file_path"],
                content=data["content"],
                raw_content=data["raw_content"],
                yaml_meta=json.dumps(data.get("yaml_meta", {})),
                tags=data.get("tags", ""),
                links=data.get("links", ""),
                broken_links=data.get("broken_links", "")
            )
            db.add(note)
            notes.append(note)
        db.commit()
        for note in notes:
            db.refresh(note)
        return notes
    finally:
        db.close()


def insert_attachment(attachment_data: dict) -> ObsidianAttachment:
    """插入附件记录"""
    db = SessionLocal()
    try:
        attachment = ObsidianAttachment(
            import_id=attachment_data["import_id"],
            note_id=attachment_data.get("note_id"),
            original_path=attachment_data["original_path"],
            stored_path=attachment_data["stored_path"],
            file_type=attachment_data.get("file_type", "other"),
            file_size=attachment_data.get("file_size", 0)
        )
        db.add(attachment)
        db.commit()
        db.refresh(attachment)
        return attachment
    finally:
        db.close()


def get_notes(import_id: int = None, keyword: str = None, tag: str = None, limit: int = 100) -> List[ObsidianNote]:
    """搜索笔记"""
    db = SessionLocal()
    try:
        query = db.query(ObsidianNote)
        if import_id:
            query = query.filter_by(import_id=import_id)
        if keyword:
            query = query.filter(
                (ObsidianNote.title.contains(keyword)) |
                (ObsidianNote.content.contains(keyword))
            )
        if tag:
            query = query.filter(ObsidianNote.tags.contains(tag))
        return query.order_by(ObsidianNote.created_at.desc()).limit(limit).all()
    finally:
        db.close()


def get_note_by_id(note_id: int) -> Optional[ObsidianNote]:
    """获取笔记详情"""
    db = SessionLocal()
    try:
        return db.query(ObsidianNote).filter_by(id=note_id).first()
    finally:
        db.close()


def find_note_by_title(import_id: int, title: str) -> Optional[ObsidianNote]:
    """查找同名笔记"""
    db = SessionLocal()
    try:
        return db.query(ObsidianNote).filter_by(import_id=import_id, title=title).first()
    finally:
        db.close()


def update_note_links(note_id: int, links: str, broken_links: str):
    """更新笔记链接"""
    db = SessionLocal()
    try:
        note = db.query(ObsidianNote).filter_by(id=note_id).first()
        if note:
            note.links = links
            note.broken_links = broken_links
            db.commit()
    finally:
        db.close()


def get_all_notes_by_import(import_id: int) -> List[ObsidianNote]:
    """获取某次导入的所有笔记"""
    db = SessionLocal()
    try:
        return db.query(ObsidianNote).filter_by(import_id=import_id).all()
    finally:
        db.close()