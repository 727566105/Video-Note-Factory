from sqlalchemy import Column, Integer, String, DateTime, func
from app.db.engine import Base


class ObsidianConfig(Base):
    __tablename__ = "obsidian_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    export_mode = Column(String, nullable=False, default="local")  # "local" or "api"
    vault_path = Column(String, nullable=True)  # 本地 Vault 路径（local 模式）
    folder_path = Column(String, nullable=False, default="videoNote/")  # 目标文件夹
    attachments_folder = Column(String, nullable=False, default="attachments/")  # 附件目录
    api_url = Column(String, nullable=True)  # Local REST API 地址（api 模式）
    api_key = Column(String, nullable=True)  # Local REST API 密钥（Fernet 加密）
    enabled = Column(Integer, default=1)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
