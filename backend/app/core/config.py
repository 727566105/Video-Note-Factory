"""
集中配置模块
统一加载 .env，启动时验证必要配置
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 项目根目录（backend 的父目录）
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()

# 按优先级加载 .env
_local_env = PROJECT_ROOT / "backend" / ".env.local"
_root_env = PROJECT_ROOT / ".env"
_backend_env = PROJECT_ROOT / "backend" / ".env"

if _local_env.exists():
    load_dotenv(_local_env, override=True)
elif _root_env.exists():
    load_dotenv(_root_env)
elif _backend_env.exists():
    load_dotenv(_backend_env)
else:
    load_dotenv()

# WebDAV 密钥在使用时检查，不强制启动时验证


class Config:
    """应用配置"""
    # 环境模式
    ENV: str = os.getenv("ENV", "development")

    # 路径（全部绝对路径）
    PROJECT_ROOT: Path = PROJECT_ROOT
    DATA_DIR: Path = PROJECT_ROOT / os.getenv("DATA_DIR", "data")

    # 服务器
    BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8483"))
    BACKEND_HOST: str = os.getenv("BACKEND_HOST", "0.0.0.0")

    @classmethod
    def validate(cls):
        """验证必要配置"""
        pass


# 启动时验证
Config.validate()
