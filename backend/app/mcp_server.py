"""VideoNote MCP Server

对外提供 MCP（Model Context Protocol）能力，允许 MCP 客户端（Claude / Cursor / 小龙虾等）
通过 API Key 鉴权后调用 VideoNote 的核心功能：导入视频生成笔记、查询状态、管理订阅等。

传输协议：Streamable HTTP（默认端点 /mcp）
鉴权方式：Authorization: Bearer <api_key>，API Key 在设置页生成

安全设计：
- API Key 哈希存储（SHA-256），明文仅生成时返回一次
- contextvars 实现请求级用户隔离（无全局共享状态竞态）
- URL 协议白名单 + 平台校验（防注入）
- 统一异常兜底（tool 内部错误不暴露 traceback）
- 参数校验（limit 上限、枚举值、UUID 格式）
"""
import os
import re
import json
import uuid
import hashlib
import contextvars
import threading
import functools
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from urllib.parse import urlparse
import anyio
from starlette.responses import JSONResponse
from starlette.types import Receive, Scope, Send

from mcp.server.fastmcp import FastMCP, Context
from mcp.server.transport_security import TransportSecuritySettings

from app.db.user_dao import get_user_by_api_key
from app.utils.logger import get_logger

logger = get_logger(__name__)

# ──────────────────────────────────────────────
# 鉴权：contextvars 请求级隔离（无全局竞态）
# ──────────────────────────────────────────────

_mcp_user: contextvars.ContextVar[dict | None] = contextvars.ContextVar(
    "mcp_user", default=None
)


@asynccontextmanager
async def mcp_lifespan(server):
    """FastMCP lifespan：返回空 dict（用户信息走 contextvars，不存这里）"""
    yield {}


mcp = FastMCP(
    "VideoNote",
    lifespan=mcp_lifespan,
    # 禁用 DNS rebinding 保护（默认只允许 127.0.0.1/localhost），
    # 否则局域网 IP 或域名访问时 POST /mcp 返回 421 "Invalid Host header"。
    # VideoNote 已有 ASGI 中间件做 API Key 鉴权，不需要 SDK 层的 Host 白名单。
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=False,
    ),
)

# 缓存 streamable_http_app，避免每次请求重建
_mcp_starlette_app = None


def _get_mcp_app():
    """懒加载并缓存 MCP ASGI app"""
    global _mcp_starlette_app
    if _mcp_starlette_app is None:
        _mcp_starlette_app = mcp.streamable_http_app()
    return _mcp_starlette_app


# 请求体大小上限（10MB，MCP 请求通常很小）
_MAX_REQUEST_BODY = 10 * 1024 * 1024


async def mcp_auth_middleware(scope: Scope, receive: Receive, send: Send):
    """ASGI 中间件：拦截 /mcp 请求，验证 API Key 并注入 user 到 contextvars

    注意：本中间件挂载在 / (catch-all)，但鉴权和请求体限制只对 /mcp 和
    /.well-known/ 路径生效，不影响 /api 等业务路由（整机包上传等大文件走 /api）。
    """
    mcp_app = _get_mcp_app()

    if scope["type"] != "http":
        await mcp_app(scope, receive, send)
        return

    path = scope.get("path", "")

    # OAuth 发现探测（RFC 9728）：QwenPaw 等客户端会先 GET /.well-known/oauth-protected-resource
    # 静态 Bearer Token 鉴权不需要 OAuth，这里直接返回 404 告诉客户端"无 OAuth metadata"。
    # 注意：不能返回 401，否则客户端会误以为需要走 OAuth 授权流程导致报错。
    if path.startswith("/.well-known/"):
        resp = JSONResponse(
            status_code=404,
            content={"error": "本服务使用静态 Bearer Token 鉴权，不支持 OAuth"},
        )
        await resp(scope, receive, send)
        return

    # 非 /mcp 路径（如 /api/...）直接透传，不做 MCP 鉴权和请求体限制
    if not path.startswith("/mcp"):
        await mcp_app(scope, receive, send)
        return

    # 以下逻辑仅对 /mcp 请求生效

    # 请求体大小限制（MCP 请求通常很小，整机包等大文件走 /api 不受此限）
    headers = dict(scope.get("headers", []))
    content_length = headers.get(b"content-length", b"").decode()
    if content_length and int(content_length) > _MAX_REQUEST_BODY:
        resp = JSONResponse(status_code=413, content={"error": "请求体过大"})
        await resp(scope, receive, send)
        return

    # 解析 API Key
    auth_header = headers.get(b"authorization", b"").decode("utf-8")
    token = auth_header.strip()
    # 容错：去掉所有 Bearer 前缀（兼容客户端自动加 Bearer 导致的 Bearer Bearer）
    while token.startswith("Bearer "):
        token = token[7:].strip()

    user = get_user_by_api_key(token)
    if not user:
        # 返回标准 WWW-Authenticate: Bearer（不带 resource_metadata 参数），
        # 明确告知客户端本服务使用静态 Bearer Token 鉴权，不走 OAuth。
        # 这样 QwenPaw 等客户端不会尝试 RFC 9728 OAuth 自动发现。
        resp = JSONResponse(
            status_code=401,
            content={"error": "无效或缺失的 API Key，请在 VideoNote 设置页生成 API Key"},
            headers={"WWW-Authenticate": "Bearer"},
        )
        await resp(scope, receive, send)
        return

    # 设置 contextvar（仅在此请求的 asyncio task 内有效，请求结束自动清除）
    user_info = {"user_id": user.id, "username": user.username, "role": user.role}
    cv_token = _mcp_user.set(user_info)
    try:
        await mcp_app(scope, receive, send)
    finally:
        _mcp_user.reset(cv_token)


def _get_user(ctx: Context = None) -> dict:
    """从 contextvars 获取当前鉴权用户，并自动按调用者函数名检查限流"""
    user = _mcp_user.get()
    if not user:
        raise ValueError("未授权：请在 MCP 客户端配置有效的 API Key")

    # 限流检查：从调用栈获取 tool 函数名作为限流标识
    import sys as _sys
    tool_name = _sys._getframe(1).f_code.co_name
    from app.mcp_rate_limiter import check_rate_limit, cleanup_stale_entries
    cleanup_stale_entries()  # 惰性清理过期条目
    allowed, retry_after = check_rate_limit(user["user_id"], tool_name)
    if not allowed:
        raise ValueError(f"请求过于频繁，请 {retry_after} 秒后重试")

    return user


# ──────────────────────────────────────────────
# 辅助函数
# ──────────────────────────────────────────────

def _json(data) -> str:
    """统一 JSON 序列化，确保 MCP 传输正确"""
    return json.dumps(data, ensure_ascii=False, default=str)


async def _run_sync(func, *args, **kwargs):
    """将同步 DAO 调用包装到线程池执行，避免阻塞 asyncio event loop。

    用法: tasks = await _run_sync(get_all_tasks, user_id=1, limit=20)
    """
    return await anyio.to_thread.run_sync(functools.partial(func, *args, **kwargs))


def _read_note_file(task_id: str, task, file_type: str, user_id: int = None):
    """读取笔记目录下的文件（status/note）"""
    from app.utils.path_helper import find_note_file
    path = find_note_file(
        task_id,
        task.author_id if task else None,
        task.author_name if task else None,
        task.video_id if task else None,
        task.title if task else None,
        file_type,
        task.platform if task else "",
        user_id=user_id,
    )
    if not path or not path.exists():
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, Exception):
        return None


# 平台检测
_PLATFORM_KEYWORDS = [
    ("bilibili", "bilibili"), ("b23.tv", "bilibili"),
    ("youtube", "youtube"), ("youtu.be", "youtube"),
    ("douyin", "douyin"), ("iesdouyin", "douyin"),
    ("tiktok", "tiktok"),
    ("xiaohongshu", "xiaohongshu"), ("xhslink", "xiaohongshu"),
    ("kuaishou", "kuaishou"), ("v.kuaishou", "kuaishou"),
    ("cctv", "cctv"), ("cntv", "cctv"),
]

# UUID 格式校验
_UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I
)

# 合法下载质量
_VALID_QUALITIES = {"fast", "medium", "slow"}

# 合法导出格式
_VALID_EXPORT_FORMATS = {"pdf", "html", "docx", "epub"}


def detect_platform(url: str) -> str:
    """根据 URL 关键字检测平台"""
    url_lower = url.lower()
    for keyword, platform in _PLATFORM_KEYWORDS:
        if keyword in url_lower:
            return platform
    return "bilibili"


def _validate_video_url(url: str) -> str | None:
    """校验视频 URL 安全性，返回错误信息或 None"""
    if not url or len(url) > 2000:
        return "URL 为空或过长"
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return f"不支持的 URL 协议: {parsed.scheme}，仅支持 http/https"
    if not parsed.netloc:
        return "URL 缺少域名"
    return None


def _validate_task_id(task_id: str) -> str | None:
    """校验 task_id 格式"""
    if not task_id or not _UUID_PATTERN.match(task_id):
        return "task_id 格式无效"
    return None


def _clamp_limit(limit: int, default: int = 20, max_val: int = 200) -> int:
    """限制 limit 参数范围"""
    if not isinstance(limit, int) or limit < 1:
        return default
    return min(limit, max_val)


# ──────────────────────────────────────────────
# 后台任务：全局线程池（限制并发数，防止多用户同时导入视频创建大量线程）
# ──────────────────────────────────────────────

_background_executor = ThreadPoolExecutor(max_workers=10, thread_name_prefix="vn-bg")


def shutdown_background_executor():
    """应用关闭时优雅关闭线程池（在 main.py lifespan shutdown 调用）"""
    _background_executor.shutdown(wait=True, cancel_futures=False)
    logger.info("MCP 后台线程池已关闭")


def _safe_run_in_thread(target, *args):
    """在线程池中执行后台任务，捕获所有异常。线程池限制并发上限，防止资源耗尽。"""
    def _wrapper():
        try:
            target(*args)
        except Exception as e:
            logger.error(f"MCP 后台任务失败: {e}", exc_info=True)

    _background_executor.submit(_wrapper)


# ──────────────────────────────────────────────
# 模块 A：笔记生成与查询
# ──────────────────────────────────────────────


@mcp.tool()
async def import_video(
    video_url: str,
    quality: str = "medium",
    style: str = "concise",
    smart_mode: bool = True,
    ctx: Context = None,
) -> str:
    """导入视频链接，自动识别平台、下载、转写、AI 生成结构化笔记。

    支持 B站(bilibili.com/b23.tv)、YouTube、抖音、小红书(xhslink.com)、快手、CCTV。
    笔记生成是异步的，调用后返回 task_id，请用 get_task_status 查询进度。

    Args:
        video_url: 视频链接（支持短链接和分享文本中的链接）
        quality: 下载质量 fast/medium/slow，默认 medium
        style: 笔记风格，默认 concise
        smart_mode: 智能优选模型，默认 true

    Returns:
        {"task_id": "...", "status": "pending", "message": "已提交生成"}
    """
    user = _get_user(ctx)

    # URL 安全校验
    err = _validate_video_url(video_url)
    if err:
        return _json({"error": err})

    # 参数校验
    if quality not in _VALID_QUALITIES:
        return _json({"error": f"quality 必须为: {', '.join(_VALID_QUALITIES)}"})
    if style and len(style) > 50:
        return _json({"error": "style 过长"})

    from app.routers.note import run_note_task, _save_queued_task_params
    from app.db.video_task_dao import insert_video_task, get_user_task_for_video
    from app.utils.url_parser import extract_video_id
    from app.services.task_queue import task_queue
    from app.services.note import NoteGenerator
    from app.enmus.task_status_enums import TaskStatus

    platform = detect_platform(video_url)
    video_id = extract_video_id(video_url, platform)

    # 检查当前用户是否已有笔记
    if video_id:
        existing = await _run_sync(get_user_task_for_video, video_id, platform, user["user_id"])
        if existing:
            return _json({
                "task_id": existing.task_id,
                "status": "already_exists",
                "message": "该视频已生成过笔记，请用 view_note 查看或 list_notes 列出",
            })

    task_id = str(uuid.uuid4())
    effective_video_id = video_id or task_id

    await _run_sync(
        insert_video_task,
        video_id=effective_video_id,
        platform=platform,
        task_id=task_id,
        video_url=video_url,
        user_id=user["user_id"],
        note_style=style,
    )

    acquired = task_queue.acquire(task_id)
    if acquired:
        NoteGenerator()._update_status(task_id, TaskStatus.PENDING)
        _safe_run_in_thread(
            run_note_task,
            task_id, video_url, platform, quality, False, False,
            None, None, [], style, None, False, 0, [], None, smart_mode, user["user_id"],
        )
    else:
        # 入队等待 - 用 dict 代替动态类 hack
        from app.routers.note import VideoRequest
        queued_req = VideoRequest(
            video_url=video_url,
            platform=platform,
            quality=quality,
            style=style,
            smart_mode=smart_mode,
        )
        _save_queued_task_params(task_id, queued_req, user["user_id"])

    return _json({"task_id": task_id, "status": "pending", "message": "已提交，正在生成中"})


@mcp.tool()
async def get_task_status(task_id: str, ctx: Context = None) -> str:
    """查询笔记生成进度和结果。

    返回 status: pending/parsing/downloading/transcribing/summarizing/formatting/saving/success/failed/cancelled
    当 status 为 success 时，result 字段包含笔记 markdown 内容。

    Args:
        task_id: 任务 ID（import_video 返回的 task_id）
    """
    user = _get_user(ctx)
    err = _validate_task_id(task_id)
    if err:
        return _json({"error": err})

    from app.db.video_task_dao import get_task_by_task_id_and_user

    task = await _run_sync(get_task_by_task_id_and_user, task_id, user["user_id"])
    if not task:
        return _json({"error": "无权访问该任务或任务不存在"})

    status_data = _read_note_file(task_id, task, "status")
    if status_data:
        status = status_data.get("status", "unknown")
        message = status_data.get("message", "")

        if status == "success":
            note_data = _read_note_file(task_id, task, "note", user_id=user["user_id"])
            if note_data:
                return _json({
                    "task_id": task_id,
                    "status": "success",
                    "title": note_data.get("title", task.title),
                    "author": note_data.get("author", task.author),
                    "markdown": note_data.get("markdown", ""),
                    "model_name": note_data.get("model_name", ""),
                    "tags": task.tags,
                })
        return _json({"task_id": task_id, "status": status, "message": message})

    return _json({"task_id": task_id, "status": "unknown", "message": "状态文件不存在"})


@mcp.tool()
async def list_notes(limit: int = 20, ctx: Context = None) -> str:
    """列出历史笔记。

    Args:
        limit: 返回数量上限，默认 20，最大 200

    Returns:
        笔记列表，每项含 task_id/title/platform/status/created_at
    """
    user = _get_user(ctx)
    limit = _clamp_limit(limit)

    from app.db.video_task_dao import get_all_tasks

    db_tasks = await _run_sync(get_all_tasks, user_id=user["user_id"], role=user["role"], limit=limit)
    result = []
    for task in db_tasks:
        try:
            status_data = _read_note_file(task.task_id, task, "status")
            status = "unknown"
            if status_data:
                status = status_data.get("status", "unknown")
            else:
                note = _read_note_file(task.task_id, task, "note", user_id=user["user_id"])
                if note:
                    status = "success"

            result.append({
                "task_id": task.task_id,
                "title": task.title,
                "platform": task.platform,
                "video_url": task.video_url,
                "author": task.author,
                "status": status,
                "created_at": task.created_at.isoformat() if task.created_at else None,
            })
        except Exception as e:
            logger.warning(f"MCP list_notes: 跳过 task {task.task_id}: {e}")
    return _json(result)


@mcp.tool()
async def view_note(task_id: str, ctx: Context = None) -> str:
    """查看笔记完整 Markdown 内容。

    Args:
        task_id: 任务 ID
    """
    user = _get_user(ctx)
    err = _validate_task_id(task_id)
    if err:
        return _json({"error": err})

    from app.db.video_task_dao import get_task_by_task_id_and_user

    task = await _run_sync(get_task_by_task_id_and_user, task_id, user["user_id"])
    if not task:
        return _json({"error": "无权访问该任务或任务不存在"})

    note_data = await _run_sync(_read_note_file, task_id, task, "note", user_id=user["user_id"])
    if not note_data:
        return _json({"error": "笔记文件不存在，可能尚未生成完成"})

    return _json({
        "task_id": task_id,
        "title": note_data.get("title", task.title),
        "author": note_data.get("author", task.author),
        "markdown": note_data.get("markdown", ""),
        "model_name": note_data.get("model_name", ""),
        "tags": task.tags,
    })


@mcp.tool()
async def cancel_task(task_id: str, ctx: Context = None) -> str:
    """取消正在进行的笔记生成任务。

    Args:
        task_id: 任务 ID
    """
    user = _get_user(ctx)
    err = _validate_task_id(task_id)
    if err:
        return _json({"error": err})

    from app.db.video_task_dao import get_task_by_task_id
    from app.services.task_queue import task_queue
    from app.services.note import NoteGenerator
    from app.enmus.task_status_enums import TaskStatus

    task = await _run_sync(get_task_by_task_id, task_id)
    if not task or task.user_id != user["user_id"]:
        return _json({"error": "无权操作该任务或任务不存在"})

    task_queue.cancel(task_id)
    NoteGenerator()._update_status(task_id, TaskStatus.CANCELLED, "用户取消")
    return _json({"task_id": task_id, "status": "cancelled", "message": "任务已取消"})


@mcp.tool()
async def delete_task(task_id: str, ctx: Context = None) -> str:
    """删除一条笔记（物理删除，不可恢复）。

    Args:
        task_id: 任务 ID
    """
    user = _get_user(ctx)
    err = _validate_task_id(task_id)
    if err:
        return _json({"error": err})

    from app.db.video_task_dao import hard_delete_task_by_user
    from app.services.task_queue import task_queue

    deleted_task = await _run_sync(hard_delete_task_by_user, task_id, user["user_id"])
    if not deleted_task:
        return _json({"error": "笔记不存在或无权删除"})

    # 清理本地文件 + 关联数据（复用 note.py 的清理逻辑）
    try:
        from app.routers.note import _cleanup_task_files, _cleanup_task_relations
        await _run_sync(_cleanup_task_files, deleted_task)
        await _run_sync(_cleanup_task_relations, task_id, user["user_id"])
    except Exception as e:
        # 文件/关联数据清理失败不阻断删除（数据库已删）
        import logging
        logging.getLogger(__name__).warning(f"MCP 删除清理失败: {e}")

    task_queue.remove(task_id)
    return _json({"task_id": task_id, "message": "删除成功"})


# ──────────────────────────────────────────────
# 模块 B：笔记导出
# ──────────────────────────────────────────────


@mcp.tool()
async def export_note(task_id: str, format: str = "pdf", ctx: Context = None) -> str:
    """导出笔记为 PDF/HTML/DOCX/EPUB。

    Args:
        task_id: 任务 ID
        format: 导出格式 pdf/html/docx/epub，默认 pdf

    Returns:
        {"download_path": "/api/export/pdf/{task_id}", "format": "pdf"}
    """
    user = _get_user(ctx)
    err = _validate_task_id(task_id)
    if err:
        return _json({"error": err})

    from app.db.video_task_dao import get_task_by_task_id_and_user

    task = await _run_sync(get_task_by_task_id_and_user, task_id, user["user_id"])
    if not task:
        return _json({"error": "笔记不存在或无权访问"})

    fmt = format.lower()
    if fmt not in _VALID_EXPORT_FORMATS:
        return _json({"error": f"不支持的格式，可选: {', '.join(_VALID_EXPORT_FORMATS)}"})

    # 返回相对路径，不泄露内网地址
    return _json({
        "task_id": task_id,
        "title": task.title,
        "format": fmt,
        "download_path": f"/api/export/{fmt}/{task_id}",
        "note": "在浏览器中打开 {你的服务器地址}/api/export/{fmt}/{task_id} 下载，需登录态",
    })


# ──────────────────────────────────────────────
# 模块 C：订阅与 RSS
# ──────────────────────────────────────────────


@mcp.tool()
async def list_subscriptions(ctx: Context = None) -> str:
    """列出已订阅的频道。"""
    user = _get_user(ctx)
    from app.db import subscription_dao

    subs = await _run_sync(subscription_dao.get_user_subscriptions, user["user_id"])
    return _json([
        {
            "id": s.id,
            "channel_name": s.channel_name,
            "platform": s.platform,
            "channel_url": s.channel_url,
            "enabled": bool(s.enabled),
            "last_checked_at": s.last_checked_at.isoformat() if s.last_checked_at else None,
        }
        for s in subs
    ])


@mcp.tool()
async def add_subscription(channel_url: str, ctx: Context = None) -> str:
    """订阅一个频道，自动识别平台（B站/YouTube/抖音/小红书/快手等）。

    Args:
        channel_url: 频道主页 URL

    Returns:
        {"id": ..., "channel_name": ..., "platform": ..., "status": "success"}
    """
    user = _get_user(ctx)
    err = _validate_video_url(channel_url)
    if err:
        return _json({"error": err})

    from app.services.channel_fetcher import identify_platform
    from app.db import subscription_dao

    info = identify_platform(channel_url)
    if not info:
        return _json({"error": "无法识别平台或频道，请检查 URL"})

    existing = await _run_sync(subscription_dao.get_subscription_by_url, user["user_id"], info["channel_url"])
    if existing:
        return _json({"error": "已订阅该频道", "id": existing.id})

    platform_id = info.get("platform_id")
    reused_sub = None
    if platform_id:
        reused_sub = subscription_dao.find_subscription_by_platform_id(info["platform"], platform_id)

    if reused_sub:
        sub = subscription_dao.add_subscription(
            user_id=user["user_id"],
            channel_url=info["channel_url"],
            platform=info["platform"],
            channel_name=reused_sub.channel_name,
            platform_id=reused_sub.platform_id,
            unique_id=reused_sub.unique_id,
            avatar_url=reused_sub.avatar_url,
        )
    else:
        sub = subscription_dao.add_subscription(
            user_id=user["user_id"],
            channel_url=info["channel_url"],
            platform=info["platform"],
            channel_name=info.get("channel_name", ""),
            platform_id=platform_id,
        )

    return _json({
        "id": sub.id,
        "channel_name": sub.channel_name,
        "platform": sub.platform,
        "status": "success",
        "message": "订阅成功，可调用 refresh_subscription 拉取最新视频",
    })


@mcp.tool()
async def refresh_subscription(subscription_id: int, ctx: Context = None) -> str:
    """手动拉取订阅频道的新视频。

    Args:
        subscription_id: 订阅 ID（list_subscriptions 返回的 id）
    """
    user = _get_user(ctx)
    if not isinstance(subscription_id, int) or subscription_id < 1:
        return _json({"error": "subscription_id 无效"})

    from app.db import subscription_dao
    from app.services.channel_fetcher import fetch_all_for_subscription
    from app.services.fetch_progress import create_progress, update_progress, complete_progress

    subs = await _run_sync(subscription_dao.get_user_subscriptions, user["user_id"])
    sub = next((s for s in subs if s.id == subscription_id), None)
    if not sub:
        return _json({"error": "订阅不存在"})

    progress_id = create_progress(subscription_id)

    def _do_fetch():
        try:
            def _cb(page, fetched):
                update_progress(progress_id, current_page=page, fetched_count=fetched)

            limit = None if sub.platform == "bilibili" else 50
            result = fetch_all_for_subscription(sub, limit=limit, progress_callback=_cb)
            added = len(subscription_dao.upsert_feed_items(result.items)) if result.items else 0
            new_last_content_id = result.items[0].get("content_id") if result.items else None
            if result.error:
                status = subscription_dao.classify_fetch_error(result.error)
                subscription_dao.update_fetch_result(subscription_id, status, added, result.error, new_last_content_id)
            else:
                subscription_dao.update_fetch_result(subscription_id, "success" if added > 0 else "empty", added, None, new_last_content_id)
            db_total = subscription_dao.count_feed_items_by_subscription(subscription_id)
            complete_progress(progress_id, added, db_total)
        except Exception as e:
            complete_progress(progress_id, 0, 0, error=str(e))
            subscription_dao.update_fetch_result(subscription_id, "failed", 0, str(e), None)
            logger.error(f"MCP 刷新订阅 {subscription_id} 失败: {e}", exc_info=True)

    _safe_run_in_thread(_do_fetch)

    return _json({
        "progress_id": progress_id,
        "status": "running",
        "message": "正在后台拉取，稍后可用 get_feed 查看结果",
    })


@mcp.tool()
async def get_feed(limit: int = 20, ctx: Context = None) -> str:
    """获取订阅动态 Feed，发现已订阅频道的新视频。

    Args:
        limit: 返回数量，默认 20，最大 200

    Returns:
        动态列表，每项含 id/title/platform/content_url/author/note_available
    """
    user = _get_user(ctx)
    limit = _clamp_limit(limit)

    from app.db import subscription_dao
    from app.db.video_task_dao import get_task_by_video

    items = await _run_sync(subscription_dao.get_feed_items, user["user_id"], limit, 0, None, "desc")
    result = []
    for f in items:
        available_task_id = f.task_id
        if not available_task_id and f.content_id:
            existing = get_task_by_video(f.content_id, f.platform, user["user_id"])
            if existing:
                available_task_id = existing
        result.append({
            "id": f.id,
            "title": f.title,
            "platform": f.platform,
            "content_type": f.content_type,
            "content_url": f.content_url,
            "author": f.author,
            "duration": f.duration,
            "published_at": f.published_at.isoformat() if f.published_at else None,
            "note_available": bool(available_task_id),
            "available_task_id": available_task_id,
        })
    return _json(result)


@mcp.tool()
async def refresh_feed(ctx: Context = None) -> str:
    """刷新所有已启用订阅的 Feed，拉取最新视频。"""
    user = _get_user(ctx)
    from app.db import subscription_dao
    from app.services.channel_fetcher import fetch_all_for_subscription

    subs = await _run_sync(subscription_dao.get_user_subscriptions, user["user_id"])
    total_added = 0
    errors = []

    def _do_refresh():
        nonlocal total_added, errors
        for sub in subs:
            if sub.enabled != 1:
                logger.debug(f"MCP refresh_feed 跳过已禁用订阅: {sub.channel_name} (id={sub.id})")
                continue
            try:
                result = fetch_all_for_subscription(sub, limit=20)
                added = len(subscription_dao.upsert_feed_items(result.items)) if result.items else 0
                total_added += added
                new_last_content_id = result.items[0].get("content_id") if result.items else None
                if result.error:
                    errors.append(f"{sub.channel_name}: {result.error}")
                    status = subscription_dao.classify_fetch_error(result.error)
                    subscription_dao.update_fetch_result(sub.id, status, added, result.error, new_last_content_id)
                else:
                    subscription_dao.update_fetch_result(sub.id, "success" if added > 0 else "empty", added, None, new_last_content_id)
            except Exception as e:
                errors.append(f"{sub.channel_name}: {str(e)}")
                subscription_dao.update_fetch_result(sub.id, "failed", 0, str(e), None)

    # 在线程中执行避免阻塞 MCP 响应
    _safe_run_in_thread(_do_refresh)

    return _json({
        "status": "running",
        "message": "正在后台刷新所有订阅，稍后可用 get_feed 查看结果",
    })


@mcp.tool()
async def generate_from_feed(feed_item_id: int, ctx: Context = None) -> str:
    """为 Feed 中的图文动态（小红书图文等）生成笔记。

    Args:
        feed_item_id: Feed 动态 ID（get_feed 返回的 id）
    """
    user = _get_user(ctx)
    if not isinstance(feed_item_id, int) or feed_item_id < 1:
        return _json({"error": "feed_item_id 无效"})

    from app.db import subscription_dao
    from app.services.note import NoteGenerator

    item = await _run_sync(subscription_dao.get_feed_item_by_id, feed_item_id, user["user_id"])
    if not item:
        return _json({"error": "动态不存在"})
    if item.content_type != "article":
        return _json({"error": "仅图文内容支持此操作，视频请使用 import_video"})

    images = json.loads(item.images) if item.images else []
    generator = NoteGenerator()
    # generate_article_note 内部调用 LLM，耗时几十秒。
    # 用 _run_sync 放到线程池执行，避免阻塞 asyncio 事件循环（影响其他用户的 MCP 请求）。
    markdown, smart_info = await _run_sync(
        generator.generate_article_note,
        title=item.title,
        author=item.author,
        description=item.description,
        images=images,
        smart_mode=True,
        user_id=user["user_id"],
    )

    result = {"markdown": markdown}
    if smart_info:
        result["used_model"] = f"{smart_info['provider_name']}/{smart_info['model_name']}"
    return _json(result)


# ──────────────────────────────────────────────
# 模块 D：频道与博主浏览
# ──────────────────────────────────────────────


@mcp.tool()
async def list_channel_videos(
    platform: str, platform_id: str, limit: int = 20, ctx: Context = None
) -> str:
    """列出频道下的视频（标注哪些已生成笔记）。

    Args:
        platform: 平台标识 bilibili/youtube/douyin/xiaohongshu/kuaishou
        platform_id: 平台频道 ID
        limit: 返回数量，默认 20
    """
    user = _get_user(ctx)
    limit = _clamp_limit(limit)

    if not platform or len(platform) > 20:
        return _json({"error": "platform 无效"})
    if not platform_id or len(platform_id) > 100:
        return _json({"error": "platform_id 无效"})

    from app.db import subscription_dao
    from app.db.video_task_dao import find_completed_task_by_video
    from app.services.constant import CHANNEL_URL_MAP

    channel_url = CHANNEL_URL_MAP.get(platform, "").format(platform_id=platform_id)
    sub = await _run_sync(subscription_dao.get_subscription_by_url, user["user_id"], channel_url) if channel_url else None

    if sub:
        items = subscription_dao.get_feed_items_by_subscription(sub.id, limit, 0)
    else:
        from app.services.channel_fetcher import fetch_videos
        result = fetch_videos(channel_url, platform, limit)
        return _json([
            {
                "content_id": v.get("content_id"),
                "title": v.get("title"),
                "content_url": v.get("content_url"),
                "author": v.get("author"),
                "duration": v.get("duration"),
            }
            for v in result.items
        ])

    result = []
    for f in items:
        available_task_id = f.task_id
        if not available_task_id and f.content_id:
            existing = find_completed_task_by_video(f.content_id, platform)
            if existing:
                available_task_id = existing.task_id
        result.append({
            "content_id": f.content_id,
            "title": f.title,
            "content_url": f.content_url,
            "author": f.author,
            "duration": f.duration,
            "published_at": f.published_at.isoformat() if f.published_at else None,
            "note_available": bool(available_task_id),
            "available_task_id": available_task_id,
        })
    return _json(result)


@mcp.tool()
async def list_author_videos(author_id: str, limit: int = 50, ctx: Context = None) -> str:
    """列出博主下的视频（已生成笔记的视频）。

    Args:
        author_id: 博主 ID
        limit: 返回数量，默认 50
    """
    user = _get_user(ctx)
    limit = _clamp_limit(limit, default=50, max_val=200)

    if not author_id or len(author_id) > 100:
        return _json({"error": "author_id 无效"})

    from app.db.video_task_dao import get_all_tasks

    db_tasks = await _run_sync(get_all_tasks, user_id=user["user_id"], role=user["role"], limit=500)
    result = []
    for task in db_tasks:
        if task.author_id != author_id:
            continue
        note_data = _read_note_file(task.task_id, task, "note", user_id=user["user_id"])
        status = "success" if note_data else "pending"
        result.append({
            "task_id": task.task_id,
            "title": task.title,
            "platform": task.platform,
            "video_id": task.video_id,
            "video_url": task.video_url,
            "status": status,
        })
        if len(result) >= limit:
            break
    return _json(result)


# ──────────────────────────────────────────────
# 模块 E：合集
# ──────────────────────────────────────────────


@mcp.tool()
async def list_collections(ctx: Context = None) -> str:
    """列出笔记合集。"""
    user = _get_user(ctx)
    from app.db.engine import get_db
    from app.services import collection as collection_svc

    db = next(get_db())
    try:
        result = collection_svc.get_user_collections(db, user["user_id"])
        return _json(result)
    finally:
        db.close()


@mcp.tool()
async def generate_summary(collection_id: str, ctx: Context = None) -> str:
    """AI 生成合集总结。

    Args:
        collection_id: 合集 ID
    """
    user = _get_user(ctx)
    if not collection_id or len(collection_id) > 50:
        return _json({"error": "collection_id 无效"})

    from app.db.engine import get_db
    from app.services import collection as collection_svc

    db = next(get_db())
    try:
        result = collection_svc.generate_collection_summary(
            db, collection_id, user["user_id"], style="minimal"
        )
        if not result:
            return _json({"error": "生成总结失败，请检查合集是否有笔记内容"})
        return _json(result)
    finally:
        db.close()
