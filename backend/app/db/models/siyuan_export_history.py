from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.db.engine import Base


class SiyuanExportHistory(Base):
    """思源笔记导出历史表"""
    __tablename__ = "siyuan_export_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String, nullable=False)          # BiliNote 任务 ID
    siyuan_doc_id = Column(String)                      # 思源笔记文档 ID
    notebook_id = Column(String)                        # 导出的笔记本 ID
    notebook_name = Column(String)                      # 导出的笔记本名称
    doc_path = Column(String)                           # 导出的文档路径
    status = Column(String, nullable=False)               # 导出状态：success/failed
    error_message = Column(Text)                         # 错误信息（失败时）
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<SiyuanExportHistory(id={self.id}, task_id={self.task_id}, status={self.status})>"
