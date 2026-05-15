import os
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

# ==================== 最先加载 .env（必须在任何 app import 之前） ====================
from dotenv import load_dotenv

_root_env = Path(__file__).parent.parent / ".env"
if _root_env.exists():
    load_dotenv(_root_env)
else:
    load_dotenv()

# ==================== 统一 NOTE_OUTPUT_DIR 为绝对路径 ====================
# 无论 .env 或 Docker ENV 中配置的是相对路径还是绝对路径，都在此处统一解析为绝对路径
# 并写回 os.environ，确保后续所有模块读取到的都是正确的绝对路径
_project_root = Path(__file__).parent.parent
_note_output_dir = os.getenv("NOTE_OUTPUT_DIR", "").strip()
if not _note_output_dir:
    _note_output_dir = "/app/note_results"
if not Path(_note_output_dir).is_absolute():
    _note_output_dir = str((_project_root / _note_output_dir).resolve())
os.environ["NOTE_OUTPUT_DIR"] = _note_output_dir

import uvicorn
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.db.init_db import init_db
from app.db.provider_dao import seed_default_providers
from app.exceptions.exception_handlers import register_exception_handlers
from app.utils.logger import get_logger
from app import create_app
from app.transcriber.transcriber_provider import warm_up_transcriber_async, get_warm_up_status
from events import register_handler
from ffmpeg_helper import ensure_ffmpeg_or_raise

logger = get_logger(__name__)

# 读取 .env 中的路径
static_path = os.getenv('STATIC', '/static')
out_dir = os.getenv('OUT_DIR', './static/screenshots')

logger.info(f"NOTE_OUTPUT_DIR = {os.environ['NOTE_OUTPUT_DIR']}")
logger.info(f"OUT_DIR = {out_dir}")
logger.info(f"STATIC = {static_path}")

# 自动创建本地目录（static 和 static/screenshots）
static_dir = "static"
uploads_dir = "uploads"
if not os.path.exists(static_dir):
    os.makedirs(static_dir)
if not os.path.exists(uploads_dir):
    os.makedirs(uploads_dir)
    os.makedirs(os.path.join(uploads_dir, "icons"), exist_ok=True)

if not os.path.exists(out_dir):
    os.makedirs(out_dir)

@asynccontextmanager
async def lifespan(app: FastAPI):
    register_handler()
    init_db()
    seed_default_providers()

    # 启动定时任务调度器
    from app.tasks.scheduler import start_scheduler
    start_scheduler()

    # 异步预热转写器（不阻塞应用启动）
    transcriber_type = os.getenv("TRANSCRIBER_TYPE", "fast-whisper")
    logger.info(f"应用启动中，转写器类型: {transcriber_type}")
    asyncio.create_task(warm_up_transcriber_async(transcriber_type))

    yield

    # 关闭定时任务调度器
    from app.tasks.scheduler import shutdown_scheduler
    shutdown_scheduler()

    # 输出预热最终状态
    status = get_warm_up_status()
    logger.info(f"应用关闭，转写器预热状态: {status}")

app = create_app(lifespan=lifespan)
origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://localhost:3015",
    "http://localhost:3018",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3015",
    "http://127.0.0.1:3018",
    "http://127.0.0.1:5173",
]

env_mode = os.getenv("ENV", "development")
if env_mode == "production":
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
    if allowed_origins:
        origins = [o.strip() for o in allowed_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        allow_origin_regex=r"https?://.*|chrome-extension://.*",
    )
register_exception_handlers(app)
app.mount(static_path, StaticFiles(directory=static_dir), name="static")
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


if __name__ == "__main__":
    port = int(os.getenv("BACKEND_PORT", 8483))
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    logger.info(f"Starting server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, reload=False)
