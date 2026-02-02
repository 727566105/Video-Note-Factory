from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.db.engine import Base


class BackupHistory(Base):
    """备份历史表"""
    __tablename__ = "backup_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String, nullable=False)              # manual / auto
    status = Column(String, nullable=False)            # success / failed
    file_size = Column(Integer)                         # 备份文件大小（字节）
    file_count = Column(Integer)                        # 备份文件数量
    error_message = Column(Text)                        # 错误信息
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<BackupHistory(id={self.id}, type={self.type}, status={self.status})>"