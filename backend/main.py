import os
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

# 最先加载 .env（必须在任何 app import 之前）
from dotenv import load_dotenv
_project_root = Path(__file__).parent.parent
_local_env = _project_root / ".env.local"
_root_env = _project_root / ".env"
if _local_env.exists():
    load_dotenv(_local_env, override=True)
elif _root_env.exists():
    load_dotenv(_root_env)
else:
    load_dotenv()

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

    # 自愈重置：清除上次备份/恢复因进程崩溃残留的全局状态
    from app.services.webdav_backup import reset_stale_backup_state
    reset_stale_backup_state()

    # 自动迁移旧数据到四级目录
    from app.utils.path_helper import migrate_to_platform_structure, cleanup_stale_pending
    migrate_to_platform_structure()
    cleanup_stale_pending()

    # 启动定时任务调度器
    from app.tasks.scheduler import start_scheduler
    start_scheduler()

    # 阻塞式预热转写器：确保模型加载完成后才接受用户请求，
    # 防止多用户在预热未完成时并发提交任务导致重复加载模型（OOM 风险）。
    transcriber_type = os.getenv("TRANSCRIBER_TYPE", "fast-whisper")
    logger.info(f"应用启动中，开始预热转写器: {transcriber_type}")
    try:
        await warm_up_transcriber_async(transcriber_type)
    except Exception as e:
        # 预热失败不阻塞服务启动，首次任务会懒加载（已有 _transcriber_lock 保护）
        logger.warning(f"转写器预热失败（服务仍可启动，首次任务将懒加载）: {e}")
    logger.info("转写器预热流程结束，开始接受请求")

    # 启动 MCP Server session manager
    from app.mcp_server import mcp
    mcp_app = mcp.streamable_http_app()
    async with mcp.session_manager.run():
        yield

    # 关闭定时任务调度器
    from app.tasks.scheduler import shutdown_scheduler
    shutdown_scheduler()

    # 关闭 MCP 后台线程池
    from app.mcp_server import shutdown_background_executor
    shutdown_background_executor()

    # 输出预热最终状态
    status = get_warm_up_status()
    logger.info(f"应用关闭，转写器预热状态: {status}")

app = create_app(lifespan=lifespan)

dev_origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://localhost:3015",
    "http://localhost:3016",
    "http://localhost:3017",
    "http://localhost:3018",
    "http://localhost:33015",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3015",
    "http://127.0.0.1:3016",
    "http://127.0.0.1:3017",
    "http://127.0.0.1:3018",
    "http://127.0.0.1:33015",
    "http://127.0.0.1:5173",
]

env_mode = os.getenv("ENV", "development")

# CORS 允许的方法和头（收紧到实际需要的范围）
cors_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
cors_headers = [
    "Authorization",
    "Content-Type",
    "Accept",
    "X-Requested-With",
]

if env_mode == "production":
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "")
    if allowed_origins:
        origins = [o.strip() for o in allowed_origins.split(",") if o.strip()]
        logger.info(f"CORS origins (production): {origins}")
    else:
        # 生产环境未配置 ALLOWED_ORIGINS -> fail-closed，不允许任何跨域
        origins = []
        logger.warning("生产环境未设置 ALLOWED_ORIGINS，CORS 已禁用跨域请求")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=cors_methods,
        allow_headers=cors_headers,
    )
else:
    origins = list(dev_origins)
    extra_origins = os.getenv("ALLOWED_ORIGINS", "")
    if extra_origins:
        origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])
    logger.info(f"CORS origins (dev): {origins}")
    logger.info(f"ENV mode: {env_mode}")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=cors_methods,
        allow_headers=cors_headers,
    )
register_exception_handlers(app)
app.mount(static_path, StaticFiles(directory=static_dir), name="static")
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


if __name__ == "__main__":
    port = int(os.getenv("BACKEND_PORT", 8483))
    # Docker 容器内 nginx 反代到 127.0.0.1，不直接暴露后端端口
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    # 本地开发热重载：设 BACKEND_RELOAD=true 自动监听文件变更重启
    reload = os.getenv("BACKEND_RELOAD", "false").lower() == "true"
    logger.info(f"Starting server on {host}:{port} (reload={reload})")
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=reload,
        reload_dirs=["app"] if reload else None,
    )
