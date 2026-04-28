from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.engine import Base


class ObsidianImport(Base):
    """导入批次记录"""
    __tablename__ = "obsidian_imports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_name = Column(String, nullable=False)
    file_count = Column(Integer, default=0)
    status = Column(String, default="pending")
    progress = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    notes = relationship("ObsidianNote", back_populates="import_record", cascade="all, delete-orphan")
    attachments = relationship("ObsidianAttachment", back_populates="import_record", cascade="all, delete-orphan")


class ObsidianNote(Base):
    """导入的笔记"""
    __tablename__ = "obsidian_notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("obsidian_imports.id"), nullable=False)
    title = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    raw_content = Column(Text, nullable=False)
    yaml_meta = Column(Text, nullable=True)
    tags = Column(String, nullable=True)
    links = Column(String, nullable=True)
    broken_links = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    import_record = relationship("ObsidianImport", back_populates="notes")
    note_attachments = relationship("ObsidianAttachment", back_populates="note", cascade="all, delete-orphan")


class ObsidianAttachment(Base):
    """导入的附件"""
    __tablename__ = "obsidian_attachments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    import_id = Column(Integer, ForeignKey("obsidian_imports.id"), nullable=False)
    note_id = Column(Integer, ForeignKey("obsidian_notes.id"), nullable=True)
    original_path = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    file_type = Column(String, default="other")
    file_size = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())

    import_record = relationship("ObsidianImport", back_populates="attachments")
    note = relationship("ObsidianNote", back_populates="note_attachments")