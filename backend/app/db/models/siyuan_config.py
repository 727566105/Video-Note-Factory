from sqlalchemy import Column, Integer, String, DateTime, func
from app.db.engine import Base


class SiyuanConfig(Base):
    """思源笔记配置表"""
    __tablename__ = "siyuan_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    api_url = Column(String, nullable=False)          # 思源笔记 API 地址
    api_token = Column(String, nullable=False)        # 思源笔记 API Token
    default_notebook = Column(String)                 # 默认笔记本 ID
    enabled = Column(Integer, default=1)              # 是否启用
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<SiyuanConfig(id={self.id}, api_url={self.api_url})>"
