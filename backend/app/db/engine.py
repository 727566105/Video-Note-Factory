import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# 使用绝对路径，避免 CWD 依赖
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()
default_db_path = PROJECT_ROOT / "data" / "video_note.db"

# 自动迁移旧数据库（相对路径 → 绝对路径）
legacy_db = Path("video_note.db")
if legacy_db.exists() and not default_db_path.exists():
    (PROJECT_ROOT / "data").mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy2(legacy_db, default_db_path)

# 默认 SQLite，如果想换 PostgreSQL 或 MySQL，可以直接改 .env
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{default_db_path}")

# SQLite 需要特定连接参数，其他数据库不需要
engine_args = {}
if DATABASE_URL.startswith("sqlite"):
    # check_same_thread=False: 允许多线程共享连接（FastAPI + 后台线程）
    # timeout=30: 写锁等待超时从默认 5 秒提高到 30 秒，减少高并发下 "database is locked" 错误
    engine_args["connect_args"] = {"check_same_thread": False, "timeout": 30}

engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true",
    # pool_pre_ping: 连接使用前先 ping 一下，避免拿到已断开的连接
    # pool_recycle: 连接回收周期（秒），防止长时间运行的连接被数据库端关闭
    pool_pre_ping=True,
    **engine_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_engine():
    return engine


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()