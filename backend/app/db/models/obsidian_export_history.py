from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.db.engine import Base


class ObsidianExportHistory(Base):
    __tablename__ = "obsidian_export_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String, nullable=False)
    export_mode = Column(String)  # "local" or "api"
    file_path = Column(String)
    status = Column(String, nullable=False)
    error_message = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
