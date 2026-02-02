from sqlalchemy import Column, Integer, String, DateTime, func
from app.db.engine import Base


class WebDAVConfig(Base):
    """WebDAV 备份配置表"""
    __tablename__ = "webdav_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String, nullable=False)              # WebDAV 服务器地址
    username = Column(String, nullable=False)         # 用户名
    password = Column(String, nullable=False)         # 密码（加密存储）
    path = Column(String, default='/')               # 备份路径
    auto_backup_enabled = Column(Integer, default=0)  # 是否启用自动备份
    auto_backup_schedule = Column(String, default='0 2 * * *')  # Cron表达式
    last_backup_at = Column(DateTime)                 # 最后备份时间
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<WebDAVConfig(id={self.id}, url={self.url}, username={self.username})>"