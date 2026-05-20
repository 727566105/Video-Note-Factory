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
    engine_args["connect_args"] = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("SQLALCHEMY_ECHO", "false").lower() == "true",
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