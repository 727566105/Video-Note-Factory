# app/routers/note.py
import json
import os
import uuid
import hashlib
import ipaddress
import socket
import shutil
import threading
import httpx
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from datetime import datetime
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Request, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator

from app.db.video_task_dao import get_task_by_video, get_all_tasks, delete_task_by_id, insert_video_task, find_completed_task_by_video, clone_task_to_user, get_task_by_task_id, update_task_metadata
from app.enmus.exception import NoteErrorEnum
from app.enmus.note_enums import DownloadQuality
from app.exceptions.note import NoteError
from app.services.note import NoteGenerator, logger
from app.services.task_queue import task_queue
from app.services.cache_cleaner import clean_expired_cache, get_cache_stats, CACHE_TTL_DAYS
from app.utils.response import ResponseWrapper as R
from app.utils.url_parser import extract_video_id
from app.validators.video_url_validator import is_supported_video_url
from app.auth.dependencies import get_current_user, require_admin
from app.enmus.task_status_enums import TaskStatus

# 使用统一的路径管理工具
from app.utils.path_helper import (
    get_note_folder,
    find_note_file,
    get_note_file_path_v2,
    get_video_folder,
    VIDEO_DIR,
)

router = APIRouter()


class RecordRequest(BaseModel):
    video_id: Optional[str] = None
    platform: Optional[str] = None
    task_id: Optional[str] = None


class VideoRequest(BaseModel):
    video_url: str
    platform: str
    quality: DownloadQuality
    screenshot: Optional[bool] = False
    link: Optional[bool] = False
    model_name: str
    provider_id: str
    task_id: Optional[str] = None
    format: Optional[list] = []
    style: str = None
    extras: Optional[str]=None
    video_understanding: Optional[bool] = False
    video_interval: Optional[int] = 0
    grid_size: Optional[list] = []
    output_language: Optional[str] = None
    smart_mode: Optional[bool] = False  # 是否启用智能优选

    @field_validator("video_url")
    def validate_supported_url(cls, v):
        url = str(v)
        parsed = urlparse(url)
        if parsed.scheme in ("http", "https"):
            # 是网络链接，继续用原有平台校验
            if not is_supported_video_url(url):
                raise NoteError(code=NoteErrorEnum.PLATFORM_NOT_SUPPORTED.code,
                                message=NoteErrorEnum.PLATFORM_NOT_SUPPORTED.message)

        return v


UPLOAD_DIR = "uploads"

# 文件上传安全配置
ALLOWED_EXTENSIONS = {
    # 图片类型
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "svg",
    # 视频类型
    "mp4", "avi", "mov", "mkv", "webm", "flv", "wmv",
    # 音频类型
    "mp3", "wav", "aac", "ogg", "flac", "m4a", "wma",
}
MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024  # 2GB


def sanitize_filename(filename: str) -> str:
    """
    安全处理文件名，防止路径遍历攻击
    - 移除路径分隔符
    - 使用 UUID 生成唯一文件名
    """
    # 获取原始扩展名
    ext = ""
    if "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in ALLOWED_EXTENSIONS:
            ext = f".{ext}"
        else:
            ext = ""

    # 使用 UUID 生成安全的唯一文件名
    safe_name = f"{uuid.uuid4().hex}{ext}"
    return safe_name


def save_note_to_file(task_id: str, note):
    """
    保存笔记到文件，使用三级目录结构

    :param task_id: 任务 ID
    :param note: NoteResult 对象
    """
    # 获取标题和博主信息
    title = None
    author_id = None
    author_name = None
    video_id = None
    platform = ""

    # 优先从 audio_meta 获取（视频类型）
    if note.audio_meta and hasattr(note.audio_meta, 'title'):
        title = note.audio_meta.title
        video_id = note.audio_meta.video_id
        platform = getattr(note.audio_meta, 'platform', '')
        author_id = getattr(note.audio_meta, 'author_id', None)
        author_name = getattr(note.audio_meta, 'author_name', None)
        # 如果字段没有，再从 raw_info 获取
        if not author_name and note.audio_meta.raw_info:
            owner = note.audio_meta.raw_info.get("owner", {})
            author_name = owner.get("name", "") if owner else ""
            if not author_name:
                author_name = note.audio_meta.raw_info.get("uploader", "")
            if not author_name:
                author_name = note.audio_meta.raw_info.get("channel", "")
    # 图文类型：从 note 直接属性获取
    elif hasattr(note, 'title') and note.title:
        title = note.title
        video_id = getattr(note, 'video_id', None)
        platform = getattr(note, 'platform', '')
        author_id = getattr(note, 'author_id', None)
        author_name = getattr(note, 'author_name', None)

    # 使用三级路径保存
    result_path = get_note_file_path_v2(
        task_id, author_id, author_name, video_id, title, "note", platform
    )

    # 检查是否存在旧版本
    existing_versions = []
    existing_transcript = None
    existing_audio_meta = None
    if result_path.exists():
        try:
            with open(result_path, "r", encoding="utf-8") as f:
                old_data = json.load(f)
                # 读取旧版本的 versions 数组
                existing_versions = old_data.get("versions", [])
                existing_transcript = old_data.get("transcript")
                existing_audio_meta = old_data.get("audio_meta")
        except Exception as e:
            logger.warning(f"读取旧版本失败: {e}")

    # 将当前 markdown 添加为新版本
    from app.models.notes_model import NoteVersion
    # 使用实际使用的模型名称（智能优选模式下）
    actual_model_name = note.used_model_name if hasattr(note, 'used_model_name') and note.used_model_name else note.model_name
    new_version = NoteVersion(
        ver_id=f"{task_id}-{uuid.uuid4()}",
        content=note.markdown,
        style=note.style,
        model_name=actual_model_name,
        created_at=datetime.now().isoformat()
    )

    # 合并版本（新版本在前）
    all_versions = [asdict(new_version)] + existing_versions

    # 构建保存数据 - 使用现有的 transcript 和 audio_meta（如果存在）
    save_data = {
        "markdown": note.markdown,
        "content_type": note.content_type if hasattr(note, 'content_type') else "video",
        "transcript": existing_transcript or (asdict(note.transcript) if note.transcript else {}),
        "audio_meta": existing_audio_meta or (asdict(note.audio_meta) if note.audio_meta else {}),
        "model_name": actual_model_name or '未知模型',
        "style": note.style or 'detailed',
        "versions": all_versions,
    }

    # 图文笔记额外信息
    if title:
        save_data["title"] = title
    if author_id:
        save_data["author_id"] = author_id
    if author_name:
        save_data["author_name"] = author_name

    # 智能优选信息（如果有）
    if hasattr(note, 'smart_switched') and note.smart_switched:
        save_data["smart_switched"] = note.smart_switched
        save_data["used_model_name"] = note.used_model_name or note.model_name
        save_data["used_provider_name"] = note.used_provider_name

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)


def _save_queued_task_params(task_id: str, data: VideoRequest, user_id: int = None):
    """保存排队任务的参数到 _pending 目录"""
    pending_dir = VIDEO_DIR / "_pending" / task_id
    pending_dir.mkdir(parents=True, exist_ok=True)
    queue_path = pending_dir / "queue.json"
    params = {
        "video_url": data.video_url,
        "platform": data.platform,
        "quality": data.quality.value if isinstance(data.quality, DownloadQuality) else data.quality,
        "link": data.link,
        "screenshot": data.screenshot,
        "model_name": data.model_name,
        "provider_id": data.provider_id,
        "_format": data.format,
        "style": data.style,
        "extras": data.extras,
        "video_understanding": data.video_understanding,
        "video_interval": data.video_interval,
        "grid_size": data.grid_size,
        "output_language": data.output_language,
        "smart_mode": data.smart_mode,
        "user_id": user_id,
    }
    queue_path.parent.mkdir(parents=True, exist_ok=True)
    with open(queue_path, "w", encoding="utf-8") as f:
        json.dump(params, f, ensure_ascii=False)


def _cleanup_pending(task_id: str):
    """清理 _pending 目录中的任务残留"""
    _pending = VIDEO_DIR / "_pending" / task_id
    if _pending.exists():
        shutil.rmtree(_pending, ignore_errors=True)
        logger.info(f"已清理 _pending 目录: {_pending}")


def _start_queued_task(task_id: str):
    """从 _pending 目录读取参数并启动排队任务"""
    queue_path = VIDEO_DIR / "_pending" / task_id / "queue.json"
    if not queue_path.exists():
        logger.error(f"排队任务参数文件不存在: {task_id}")
        _cleanup_pending(task_id)
        return
    try:
        with open(queue_path, "r", encoding="utf-8") as f:
            params = json.load(f)
        queue_path.unlink()  # 删除队列文件
        if "quality" in params and isinstance(params["quality"], str):
            params["quality"] = DownloadQuality(params["quality"])
        thread = threading.Thread(target=run_note_task, args=(task_id,), kwargs=params, daemon=True)
        thread.start()
        logger.info(f"排队任务 {task_id} 已在新线程中启动")
    except Exception as e:
        logger.error(f"启动排队任务失败: {task_id}, 错误: {e}")
        task_queue.release(task_id)
        _cleanup_pending(task_id)


def run_note_task(task_id: str, video_url: str, platform: str, quality: DownloadQuality,
                  link: bool = False, screenshot: bool = False, model_name: str = None, provider_id: str = None,
                  _format: list = None, style: str = None, extras: str = None, video_understanding: bool = False,
                  video_interval=0, grid_size=[], output_language: str = None,
                  smart_mode: bool = False, user_id: int = None
                  ):
    try:
        # 智能模式不需要验证 model_name/provider_id
        if not smart_mode and (not model_name or not provider_id):
            NoteGenerator()._update_status(task_id, TaskStatus.FAILED, message="请选择模型和提供者")
            logger.warning(f"任务 {task_id} 缺少模型配置，跳过执行")
            return

        note = NoteGenerator().generate(
            video_url=video_url,
            platform=platform,
            quality=quality,
            task_id=task_id,
            model_name=model_name,
            provider_id=provider_id,
            link=link,
            _format=_format,
            style=style,
            extras=extras,
            screenshot=screenshot,
            video_understanding=video_understanding,
            video_interval=video_interval,
            grid_size=grid_size,
            output_language=output_language,
            smart_mode=smart_mode,
            user_id=user_id,
        )
        logger.info(f"Note generated: {task_id}")
        if not note or not note.markdown:
            logger.warning(f"任务 {task_id} 执行失败，跳过保存")
            return
        save_note_to_file(task_id, note)
    finally:
        # 清理 _pending 残留（无论成功还是失败）
        _cleanup_pending(task_id)
        # 释放执行槽位，触发下一个排队任务
        next_task_id = task_queue.release(task_id)
        if next_task_id:
            _start_queued_task(next_task_id)



@router.post('/delete_task')
def delete_task(data: RecordRequest, current_user=Depends(get_current_user)) -> dict:
    try:
        # 优先使用 task_id 删除（更精确）
        if data.task_id:
            # 先查询数据库获取 author 信息（删除前查询）
            db_task = get_task_by_task_id(data.task_id)
            # 权限检查：只允许删除自己的任务
            if not db_task or db_task.user_id != current_user.id:
                raise HTTPException(status_code=403, detail="无权删除该任务")
            # 删除数据库记录
            delete_task_by_id(data.task_id)

            # 删除笔记文件夹（兼容四级目录和旧版目录）
            if db_task and db_task.author_id:
                try:
                    video_folder = get_video_folder(
                        db_task.author_id, db_task.author_name,
                        db_task.video_id, db_task.title, db_task.platform
                    )
                    if video_folder.exists():
                        shutil.rmtree(video_folder)
                        logger.info(f"已删除四级目录: {video_folder}")
                        # 如果博主目录为空，也删除
                        author_dir = video_folder.parent
                        if author_dir.exists() and not any(author_dir.iterdir()):
                            shutil.rmtree(author_dir)
                except Exception as e:
                    logger.warning(f"删除四级目录失败: {e}")

            # 旧版目录（兼容旧数据清理）
            note_folder = get_note_folder(data.task_id, None)
            if note_folder.exists():
                shutil.rmtree(note_folder)
                logger.info(f"已删除旧版笔记文件夹: {note_folder}")

            # _pending 临时目录
            _cleanup_pending(data.task_id)

            # 清理队列
            task_queue.remove(data.task_id)
        else:
            # 兼容旧逻辑：通过 video_id + platform 删除
            delete_task_by_video(data.video_id, data.platform)

        return R.success(msg='删除成功')
    except Exception as e:
        logger.error(f"删除任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload(file: UploadFile = File(...), current_user=Depends(get_current_user)) -> dict:
    # 1. 验证文件扩展名
    if file.filename:
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"不支持的文件类型: .{ext}，仅支持图片、视频、音频文件"
            )

    # 2. 读取文件内容并验证大小
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"文件过大: {file_size / 1024 / 1024:.2f}MB，最大允许 100MB"
        )

    if file_size == 0:
        raise HTTPException(status_code=400, detail="文件内容为空")

    # 3. 安全处理文件名
    safe_filename = sanitize_filename(file.filename or "upload")

    # 4. 保存文件
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_location = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_location, "wb") as f:
        f.write(content)

    logger.info(f"文件上传成功: {safe_filename}, 大小: {file_size / 1024:.2f}KB")

    # 返回安全的 URL
    return R.success({"url": f"/uploads/{safe_filename}"})


@router.post("/generate_note")
def generate_note(data: VideoRequest, background_tasks: BackgroundTasks, current_user=Depends(get_current_user)) -> dict:
    try:
        video_id = extract_video_id(data.video_url, data.platform)

        # 本地文件特殊处理：从上传路径提取 video_id
        if not video_id and data.platform in ("local", "local_audio") and data.video_url:
            import os
            filename = os.path.basename(data.video_url)
            video_id, _ = os.path.splitext(filename)  # 使用文件名作为 video_id

        if video_id and not data.task_id:
            # 先检查当前用户是否已生成过该视频的笔记（避免重复提交）
            user_own_task_id = get_task_by_video(video_id, data.platform, current_user.id)
            if user_own_task_id:
                # 查完整信息做兼容查找
                db_task = get_task_by_task_id(user_own_task_id)
                if db_task:
                    note_path = find_note_file(
                        user_own_task_id, db_task.author_id, db_task.author_name,
                        db_task.video_id, db_task.title, "note", db_task.platform
                    )
                else:
                    note_path = find_note_file(user_own_task_id, None, None, None, None, "note", "")
                if note_path and note_path.exists():
                    return R.error("该视频已生成过笔记，请直接查看或点击「重新生成」")

            # 检查是否有其他用户已生成过该视频的笔记（复用）
            existing_task = find_completed_task_by_video(video_id, data.platform)
            if existing_task:
                clone_task_to_user(existing_task.task_id, current_user.id, video_id, data.platform, data.video_url)
                logger.info(f"笔记复用: 用户 {current_user.id} 复用了视频 {video_id} 的笔记 task_id={existing_task.task_id}")
                return R.success({"task_id": existing_task.task_id, "reused": True})

        if data.task_id:
            task_id = data.task_id
            NoteGenerator()._update_status(task_id, TaskStatus.PENDING)
            logger.info(f"重试模式，复用已有 task_id={task_id}")
        else:
            task_id = str(uuid.uuid4())

        # 立即写入数据库，确保其他浏览器能通过 GET /tasks 看到该任务
        insert_video_task(video_id=video_id, platform=data.platform, task_id=task_id, video_url=data.video_url, user_id=current_user.id)

        acquired = task_queue.acquire(task_id)
        if acquired:
            background_tasks.add_task(run_note_task, task_id, data.video_url, data.platform, data.quality, data.link,
                                      data.screenshot, data.model_name, data.provider_id, data.format, data.style,
                                      data.extras, data.video_understanding, data.video_interval, data.grid_size,
                                      data.output_language, data.smart_mode, current_user.id)
        else:
            _save_queued_task_params(task_id, data, current_user.id)

        return R.success({"task_id": task_id})
    except Exception as e:
        logger.error(f"生成笔记失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task_status/{task_id}")
def get_task_status(task_id: str, current_user=Depends(get_current_user)) -> dict:
    # 从数据库获取 author 信息用于兼容查找
    from app.db.video_task_dao import get_task_by_task_id
    db_task = get_task_by_task_id(task_id)
    # 权限检查：只允许访问自己的任务
    if not db_task or db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问该任务")
    _author_id = db_task.author_id if db_task else None
    _author_name = db_task.author_name if db_task else None
    _video_id = db_task.video_id if db_task else None
    _title = db_task.title if db_task else None
    _platform = db_task.platform if db_task else ""

    status_path = find_note_file(task_id, _author_id, _author_name, _video_id, _title, "status", _platform)
    result_path = find_note_file(task_id, _author_id, _author_name, _video_id, _title, "note", _platform)

    # 优先读状态文件
    if status_path and status_path.exists():
        try:
            with open(status_path, "r", encoding="utf-8") as f:
                status_content = json.load(f)
        except (json.JSONDecodeError, Exception):
            status_content = {}

        status = status_content.get("status")
        message = status_content.get("message", "")

        if status == TaskStatus.SUCCESS.value:
            # 成功状态的话，继续读取最终笔记内容
            if result_path and os.path.exists(result_path):
                try:
                    with open(result_path, "r", encoding="utf-8") as rf:
                        result_content = json.load(rf)
                except (json.JSONDecodeError, Exception):
                    result_content = None
                if result_content:
                    return R.success({
                        "status": status,
                        "result": result_content,
                        "message": message,
                        "task_id": task_id,
                        "tags": db_task.tags if db_task else None,
                    })
            else:
                # 理论上不会出现，保险处理
                return R.success({
                    "status": TaskStatus.PENDING.value,
                    "message": "任务完成，但结果文件未找到",
                    "task_id": task_id,
                    "tags": db_task.tags if db_task else None,
                })

        if status == TaskStatus.FAILED.value:
            return R.success({
                "status": status,
                "message": message or "任务失败",
                "task_id": task_id
            })

        # 处理中状态
        return R.success({
            "status": status,
            "message": message,
            "task_id": task_id
        })

    # 没有状态文件，但有结果
    if result_path and result_path.exists():
        try:
            with open(result_path, "r", encoding="utf-8") as f:
                result_content = json.load(f)
        except (json.JSONDecodeError, Exception):
            result_content = None
        if result_content:
            return R.success({
                "status": TaskStatus.SUCCESS.value,
                "result": result_content,
                "task_id": task_id,
                "tags": db_task.tags if db_task else None,
            })

    # 什么都没有，默认PENDING
    return R.success({
        "status": TaskStatus.PENDING.value,
        "message": "任务排队中",
        "task_id": task_id
    })


# 允许的图片 CDN 域名白名单
ALLOWED_DOMAINS = [
    # Bilibili
    "bilibili.com",
    "hdslb.com",
    # 抖音
    "douyin.com",
    "douyinpic.com",
    "byteimg.com",
    "bytednsdoc.com",
    # 快手
    "kuaishou.com",
    "kspkg.com",
    "ksapisrv.com",
    "yximgs.com",
    # YouTube
    "youtube.com",
    "ytimg.com",
    "ggpht.com",
    # 小红书
    "xiaohongshu.com",
    "xhscdn.com",
    "ci.xiaohongshu.com",
    # 通用 CDN
    "cdn.com",
]


def is_private_ip(ip_str: str) -> bool:
    """检查 IP 是否为内网地址（排除 198.18.0.0/15 基准测试地址）"""
    try:
        ip = ipaddress.ip_address(ip_str)

        # 198.18.0.0/15 是 IANA 为网络基准测试保留的地址，很多 CDN 会使用此范围
        # 不应将其视为内网地址
        if ip.version == 4:
            ip_int = int(ip)
            # 198.18.0.0 - 198.19.255.255 (基准测试地址范围)
            if 198 * 256**3 + 18 * 256**2 <= ip_int <= 198 * 256**3 + 19 * 256**2 + 256**2 - 1:
                return False

        # 检查是否为真正的私有地址、回环地址、链路本地地址等
        return (
            ip.is_loopback or
            ip.is_link_local or
            ip.is_multicast or
            # 只检查真正的私有网络范围，不使用 ip.is_private（它会包含基准测试地址）
            _is_private_network(ip)
        )
    except ValueError:
        return True  # 无效 IP 视为不安全


def _is_private_network(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """检查是否为真正的私有网络地址（不包括基准测试地址）"""
    if ip.version == 4:
        ip_int = int(ip)
        # 10.0.0.0/8
        if 10 * 256**3 <= ip_int < 11 * 256**3:
            return True
        # 172.16.0.0/12
        if 172 * 256**3 + 16 * 256**2 <= ip_int < 172 * 256**3 + 32 * 256**2:
            return True
        # 192.168.0.0/16
        if 192 * 256**3 + 168 * 256**2 <= ip_int < 192 * 256**3 + 169 * 256**2:
            return True
        return False
    else:
        # IPv6 私有地址
        return ip.is_private


def is_safe_url(url: str) -> tuple[bool, str]:
    """
    检查 URL 是否安全（防止 SSRF 攻击）
    返回: (is_safe, error_message)
    """
    try:
        parsed = urlparse(url)

        # 1. 只允许 http 和 https 协议
        if parsed.scheme not in ("http", "https"):
            return False, "只允许 HTTP/HTTPS 协议"

        # 2. 检查域名是否在白名单中
        hostname = parsed.hostname
        if not hostname:
            return False, "URL 缺少主机名"

        hostname_lower = hostname.lower()

        # 检查是否为 localhost 或类似域名
        blocked_hostnames = ["localhost", "local", "localhost.localdomain", "ip6-localhost"]
        if hostname_lower in blocked_hostnames or hostname_lower.endswith(".local"):
            return False, "禁止访问本地域名"

        # 检查域名是否在白名单中（支持子域名匹配）
        domain_allowed = False
        for allowed_domain in ALLOWED_DOMAINS:
            if hostname_lower == allowed_domain or hostname_lower.endswith(f".{allowed_domain}"):
                domain_allowed = True
                break

        if not domain_allowed:
            return False, f"域名 {hostname} 不在允许的白名单中"

        # 3. 解析 IP 地址并检查是否为内网地址
        try:
            # 尝试解析域名获取 IP
            ip_str = socket.gethostbyname(hostname)
            if is_private_ip(ip_str):
                return False, f"禁止访问内网地址: {ip_str}"
        except socket.gaierror:
            # DNS 解析失败，可能是无效域名
            return False, f"无法解析域名: {hostname}"

        return True, ""

    except Exception as e:
        return False, f"URL 解析失败: {str(e)}"


def get_referer_by_url(url: str) -> str:
    """根据图片 URL 判断平台并返回对应 Referer"""
    url_lower = url.lower()
    if "bilibili" in url_lower or "hdslb.com" in url_lower:
        return "https://www.bilibili.com/"
    elif "douyin" in url_lower or "byteimg.com" in url_lower or "douyinpic.com" in url_lower:
        return "https://www.douyin.com/"
    elif "kuaishou" in url_lower or "kspkg.com" in url_lower or "ksapisrv.com" in url_lower:
        return "https://www.kuaishou.com/"
    elif "youtube" in url_lower or "ytimg.com" in url_lower or "ggpht.com" in url_lower:
        return "https://www.youtube.com/"
    elif "xiaohongshu" in url_lower or "xhscdn" in url_lower:
        return "https://www.xiaohongshu.com/"
    return ""


def get_platform_from_url(url: str) -> str:
    """根据图片 URL 判断平台名称"""
    url_lower = url.lower()
    if "bilibili" in url_lower or "hdslb.com" in url_lower:
        return "bilibili"
    elif "douyin" in url_lower or "byteimg.com" in url_lower or "douyinpic.com" in url_lower:
        return "douyin"
    elif "kuaishou" in url_lower or "kspkg.com" in url_lower or "ksapisrv.com" in url_lower:
        return "kuaishou"
    elif "youtube" in url_lower or "ytimg.com" in url_lower or "ggpht.com" in url_lower:
        return "youtube"
    elif "xiaohongshu" in url_lower or "xhscdn" in url_lower:
        return "xiaohongshu"
    return "other"


def get_cover_cache_path(url: str, platform: str) -> Path:
    """根据 URL 生成缓存文件路径"""
    # 使用 MD5 哈希避免文件名冲突
    url_hash = hashlib.md5(url.encode()).hexdigest()[:16]
    # 尝试从 URL 获取扩展名
    ext = "jpg"
    url_path = url.split("?")[0]  # 去除查询参数
    if "." in url_path:
        possible_ext = url_path.split(".")[-1].lower()
        if possible_ext in ["jpg", "jpeg", "png", "webp", "gif"]:
            ext = possible_ext
    return Path("static/covers") / platform / f"{url_hash}.{ext}"


def get_image_headers(url: str, request: Request) -> dict:
    """根据平台返回对应的请求头"""
    url_lower = url.lower()
    base_headers = {
        "User-Agent": request.headers.get("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }

    # 抖音需要更完整的请求头
    if "douyin" in url_lower or "byteimg.com" in url_lower or "douyinpic.com" in url_lower:
        base_headers.update({
            "Referer": "https://www.douyin.com/",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Sec-Fetch-Dest": "image",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
        })
    elif "bilibili" in url_lower or "hdslb.com" in url_lower:
        base_headers["Referer"] = "https://www.bilibili.com/"
    elif "kuaishou" in url_lower or "kspkg.com" in url_lower:
        base_headers["Referer"] = "https://www.kuaishou.com/"
    elif "youtube" in url_lower or "ytimg.com" in url_lower:
        base_headers["Referer"] = "https://www.youtube.com/"
    elif "xiaohongshu" in url_lower or "xhscdn" in url_lower:
        base_headers["Referer"] = "https://www.xiaohongshu.com/"

    return base_headers


@router.get("/image_proxy")
async def image_proxy(request: Request, url: str) -> dict:
    """图片代理接口，支持本地缓存"""
    # 0. 本地封面 API 路径直接重定向
    if url.startswith("/api/video_cover/"):
        # 解析路径: /api/video_cover/{platform}/{author_id}/{video_id}
        from app.utils.path_helper import VIDEO_DIR, _get_platform_dir
        parts = url.split("/")
        if len(parts) >= 5:
            platform = parts[3]
            author_id = parts[4]
            video_id = parts[5]
            platform_dir = _get_platform_dir(platform)
            plat_path = VIDEO_DIR / platform_dir
            if plat_path.exists():
                for author_folder in plat_path.iterdir():
                    if author_folder.is_dir() and author_folder.name.startswith(author_id):
                        for video_folder in author_folder.iterdir():
                            if video_folder.is_dir() and video_folder.name.startswith(video_id):
                                cover_path = video_folder / "cover.jpg"
                                if cover_path.exists():
                                    return FileResponse(
                                        str(cover_path),
                                        media_type="image/jpeg",
                                        headers={"Cache-Control": "public, max-age=31536000"}
                                    )
        raise HTTPException(status_code=404, detail="Cover not found")

    # 1. SSRF 安全检查
    is_safe, error_msg = is_safe_url(url)
    if not is_safe:
        logger.warning(f"SSRF 攻击尝试被拦截: {url[:50]}... 原因: {error_msg}")
        raise HTTPException(status_code=400, detail=f"不安全的 URL: {error_msg}")

    # 1. 判断平台和缓存路径
    platform = get_platform_from_url(url)
    cache_path = get_cover_cache_path(url, platform)
    placeholder_path = Path("static/placeholder.png")

    # 2. 检查本地缓存
    if cache_path.exists():
        logger.info(f"图片从缓存加载: {cache_path}")
        return FileResponse(
            cache_path,
            media_type=f"image/{cache_path.suffix[1:]}",
            headers={"Cache-Control": "public, max-age=31536000"}  # 缓存一年
        )

    # 3. 远程获取图片
    headers = get_image_headers(url, request)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers, follow_redirects=True)

            if resp.status_code != 200:
                logger.warning(f"图片获取失败: {url[:50]}... 状态码: {resp.status_code}")
                if placeholder_path.exists():
                    return FileResponse(placeholder_path, media_type="image/png")
                raise HTTPException(status_code=resp.status_code, detail="图片获取失败")

            # 4. 保存到本地缓存
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(resp.content)
            logger.info(f"图片已缓存: {cache_path}")

            # 5. 返回图片
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return FileResponse(
                cache_path,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=31536000"}  # 缓存一年
            )
    except Exception as e:
        logger.error(f"图片代理异常: {url[:50]}... 错误: {e}")
        if placeholder_path.exists():
            return FileResponse(placeholder_path, media_type="image/png")
        raise HTTPException(status_code=500, detail=str(e))


class CheckAvailabilityRequest(BaseModel):
    video_url: str
    platform: str


@router.post("/check_note_availability")
def check_note_availability(data: CheckAvailabilityRequest, current_user=Depends(get_current_user)) -> dict:
    """预检视频笔记可用性"""
    try:
        video_id = extract_video_id(data.video_url, data.platform)
        if not video_id:
            return R.success({"available": False})

        existing = find_completed_task_by_video(video_id, data.platform)
        if not existing:
            return R.success({"available": False})

        # 检查当前用户是否已拥有该 task
        from app.db.video_task_dao import get_task_by_video
        own_task = get_task_by_video(video_id, data.platform, current_user.id)

        result = {
            "available": True,
            "task_id": existing.task_id,
            "can_view": bool(own_task),
            "title": existing.title,
            "author": existing.author,
        }
        return R.success(result)
    except Exception as e:
        logger.error(f"预检笔记可用性失败: {e}")
        return R.success({"available": False})


@router.get("/quick_view/{task_id}")
def quick_view_note(task_id: str, current_user=Depends(get_current_user)) -> dict:
    """快速预览笔记内容（不 clone）"""
    # 先查数据库获取标题
    from app.db.video_task_dao import get_task_by_task_id
    task = get_task_by_task_id(task_id)
    # 权限检查：只允许访问自己的任务
    if not task or task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问该任务")

    result_path = find_note_file(
        task_id, task.author_id if task else None, task.author_name if task else None,
        task.video_id if task else None, task.title if task else None, "note",
        task.platform if task else ""
    )
    if not result_path or not result_path.exists():
        raise HTTPException(status_code=404, detail="笔记文件不存在")

    try:
        with open(result_path, "r", encoding="utf-8") as f:
            note_data = json.load(f)

        return R.success({
            "task_id": task_id,
            "title": task.title if task else None,
            "author": task.author if task else None,
            "markdown": note_data.get("markdown", ""),
            "model_name": note_data.get("model_name", ""),
        })
    except Exception as e:
        logger.error(f"快速查看笔记失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks")
def get_tasks(limit: int = 100, current_user=Depends(get_current_user)) -> dict:
    """获取所有历史任务列表"""
    try:
        db_tasks = get_all_tasks(user_id=current_user.id, role=current_user.role, limit=limit)
        result = []

        for task in db_tasks:
            task_id = task.task_id
            task_title = task.title

            # 使用兼容查找（支持三级路径 + 旧版路径）
            status_path = find_note_file(
                task_id, task.author_id, task.author_name,
                task.video_id, task_title, "status", task.platform
            )
            result_path = find_note_file(
                task_id, task.author_id, task.author_name,
                task.video_id, task_title, "note", task.platform
            )

            # 读取状态文件，获取任务进度
            status = "PENDING"
            message = ""
            if status_path and status_path.exists():
                try:
                    with open(status_path, "r", encoding="utf-8") as f:
                        status_data = json.load(f)
                        status = status_data.get("status", "PENDING")
                        message = status_data.get("message", "")
                except (json.JSONDecodeError, Exception):
                    status = "UNKNOWN"
                    message = "状态文件损坏"
            elif result_path and result_path.exists():
                # 无状态文件但有结果文件，说明已完成
                status = "SUCCESS"
            elif task_title:
                # 有标题（下载成功）但没有笔记文件，说明生成中断
                status = "FAILED"
                message = "笔记生成中断"

            # 读取笔记内容（如果存在）
            note_data = None
            if result_path and result_path.exists():
                with open(result_path, "r", encoding="utf-8") as f:
                    note_data = json.load(f)

            result.append({
                "task_id": task_id,
                "video_id": task.video_id,
                "platform": task.platform,
                "video_url": task.video_url,
                "created_at": task.created_at.isoformat() if task.created_at else None,
                "status": status,
                "message": message,
                "note": note_data,
                "content_type": note_data.get("content_type", "video") if note_data else "video",
                # 元数据直接从数据库读取
                "title": task.title,
                "cover_url": task.cover_url,
                "duration": task.duration,
                "author": task.author,
                "author_id": task.author_id,
                "author_name": task.author_name,
                "tags": task.tags,
            })

        return R.success({"tasks": result})
    except Exception as e:
        logger.error(f"Failed to get tasks: {e}")
        return R.error(msg=str(e))


@router.put("/notes/{task_id}/tags")
def update_note_tags(task_id: str, body: dict, current_user=Depends(get_current_user)) -> dict:
    """更新笔记标签"""
    import json as json_mod
    from app.db.video_task_dao import update_task_metadata, get_task_by_task_id
    # 权限检查：只允许修改自己的任务标签
    db_task = get_task_by_task_id(task_id)
    if not db_task or db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改该任务")
    try:
        platform_tags = body.get("platform_tags", [])
        ai_tags = body.get("ai_tags", [])
        manual_tags = body.get("manual_tags", [])
        tags_json = json_mod.dumps({
            "platform_tags": platform_tags,
            "ai_tags": ai_tags,
            "manual_tags": manual_tags,
        })
        update_task_metadata(task_id=task_id, tags=tags_json)
        return R.success(msg="标签更新成功")
    except Exception as e:
        logger.error(f"Failed to update tags: {e}")
        return R.error(msg=str(e))


@router.post("/tasks/repair")
def repair_tasks(current_user=Depends(require_admin)) -> dict:
    """扫描四级目录，修复数据库中缺失的元数据"""
    from app.utils.path_helper import _get_platform_dir, VIDEO_DIR

    video_base = VIDEO_DIR
    if not video_base.exists():
        return R.success({"repaired": 0})

    repaired = 0
    for platform_dir in video_base.iterdir():
        if not platform_dir.is_dir() or platform_dir.name.startswith("_"):
            continue
        platform = platform_dir.name

        for author_dir in platform_dir.iterdir():
            if not author_dir.is_dir() or author_dir.name.startswith("_"):
                continue
            author_parts = author_dir.name.split("_", 1)
            author_id = author_parts[0]
            author_name = author_parts[1] if len(author_parts) > 1 else ""

            for vd in author_dir.iterdir():
                if not vd.is_dir():
                    continue
                video_parts = vd.name.split("_", 1)
                video_id = video_parts[0]
                title = video_parts[1] if len(video_parts) > 1 else ""

                task = get_task_by_video(video_id, platform)
                if task and task.title is None:
                    update_task_metadata(
                        task.task_id,
                        title=title,
                        author_id=author_id,
                        author_name=author_name,
                    )
                    repaired += 1

    return R.success({"repaired": repaired})


# ==================== 缓存管理接口 ====================

@router.get("/cache/stats")
def cache_statistics(current_user=Depends(get_current_user)) -> dict:
    """
    获取缓存统计信息

    返回缓存文件的总数、总大小、过期文件数等统计信息
    """
    try:
        stats = get_cache_stats()
        return R.success({
            "total_files": stats["total_files"],
            "total_size_bytes": stats["total_size_bytes"],
            "total_size_mb": stats["total_size_mb"],
            "expired_files": stats["expired_files"],
            "expired_size_bytes": stats["expired_size_bytes"],
            "expired_size_mb": stats["expired_size_mb"],
            "ttl_days": stats["ttl_days"]
        })
    except Exception as e:
        logger.error(f"获取缓存统计失败: {e}")
        return R.error(msg=str(e))


@router.post("/cache/clean")
def trigger_cache_clean(dry_run: bool = False, ttl_days: Optional[int] = None, current_user=Depends(require_admin)) -> dict:
    """
    手动触发缓存清理

    :param dry_run: 是否为模拟运行（只统计不删除），默认 False
    :param ttl_days: 自定义 TTL 天数，不传则使用默认配置
    :return: 清理结果统计
    """
    try:
        actual_ttl = ttl_days if ttl_days is not None else CACHE_TTL_DAYS

        logger.info(f"手动触发缓存清理 (dry_run={dry_run}, ttl_days={actual_ttl})")

        deleted_count, freed_bytes, deleted_files = clean_expired_cache(
            ttl_days=actual_ttl,
            dry_run=dry_run
        )

        result = {
            "dry_run": dry_run,
            "ttl_days": actual_ttl,
            "deleted_count": deleted_count,
            "freed_bytes": freed_bytes,
            "freed_mb": round(freed_bytes / 1024 / 1024, 2),
        }

        # 如果删除文件数较多，只返回摘要
        if len(deleted_files) <= 50:
            result["deleted_files"] = deleted_files

        return R.success(result)
    except Exception as e:
        logger.error(f"缓存清理失败: {e}")
        return R.error(msg=str(e))


# ==================== 任务队列配置接口 ====================

class QueueConfigRequest(BaseModel):
    max_concurrent: int

    @field_validator("max_concurrent")
    def validate_max_concurrent(cls, v):
        if v < 1 or v > 10:
            raise ValueError("最大并发数必须在 1-10 之间")
        return v


@router.get("/task_queue/status")
def get_queue_status(current_user=Depends(get_current_user)) -> dict:
    """获取当前任务队列状态"""
    return R.success(task_queue.get_status())


@router.post("/task_queue/config")
def update_queue_config(data: QueueConfigRequest, current_user=Depends(require_admin)) -> dict:
    """更新任务队列配置"""
    try:
        task_queue.update_max_concurrent(data.max_concurrent)
        return R.success(task_queue.get_status())
    except Exception as e:
        logger.error(f"更新队列配置失败: {e}")
        return R.error(msg=str(e))


# 注册队列管理器的任务启动回调（必须在 _start_queued_task 定义之后）
task_queue.register_start_callback(_start_queued_task)


# ==================== 音频下载接口 ====================

@router.get("/screenshot/{task_id}")
def get_screenshot(task_id: str, t: float = 0) -> dict:
    """根据 task_id 和时间戳生成/返回视频截图（无需认证，图片不敏感）"""
    from app.utils.video_helper import generate_screenshot
    from app.db.video_task_dao import get_task_by_task_id
    from app.utils.path_helper import sanitize_path_name

    # 从数据库获取任务信息
    db_task = get_task_by_task_id(task_id)

    video_path = None

    # 在三级目录查找
    if db_task and db_task.author_id:
        video_folder = get_video_folder(
            db_task.author_id,
            db_task.author_name,
            db_task.video_id,
            db_task.title,
            db_task.platform,
        )
        for ext in ["mp4", "mkv", "webm"]:
            candidate = video_folder / f"{sanitize_path_name(db_task.video_id or 'video')}.{ext}"
            if candidate.exists():
                video_path = str(candidate)
                break

    if not video_path:
        raise HTTPException(status_code=404, detail="视频文件不存在")

    # 截图缓存路径
    timestamp_key = str(int(t)).zfill(6)
    screenshot_dir = os.path.join("static", "screenshots", task_id)
    os.makedirs(screenshot_dir, exist_ok=True)
    screenshot_path = os.path.join(screenshot_dir, f"t{timestamp_key}.jpg")

    # 已有缓存直接返回
    if os.path.exists(screenshot_path):
        return FileResponse(screenshot_path, media_type="image/jpeg")

    # 生成截图
    try:
        generate_screenshot(video_path, screenshot_dir, int(t), int(t))
        # 重命名为规范路径
        generated = [f for f in os.listdir(screenshot_dir) if f.startswith("screenshot_")]
        if generated:
            src = os.path.join(screenshot_dir, generated[0])
            os.rename(src, screenshot_path)

        if os.path.exists(screenshot_path):
            return FileResponse(screenshot_path, media_type="image/jpeg")
        raise HTTPException(status_code=500, detail="截图生成失败")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audio/{task_id}")
def download_audio(task_id: str, current_user=Depends(get_current_user)) -> dict:
    """下载任务对应的音频文件"""
    # 从数据库获取 author 信息用于兼容查找
    db_task = get_task_by_task_id(task_id)
    # 权限检查：只允许下载自己的任务音频
    if not db_task or db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权下载该任务音频")
    audio_path = find_note_file(
        task_id, db_task.author_id if db_task else None, db_task.author_name if db_task else None,
        db_task.video_id if db_task else None, db_task.title if db_task else None, "audio",
        db_task.platform if db_task else ""
    )
    if not audio_path or not audio_path.exists():
        raise HTTPException(status_code=404, detail="音频元数据不存在")

    try:
        with open(audio_path, "r", encoding="utf-8") as f:
            audio_meta = json.load(f)
        file_path = audio_meta.get("file_path")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="音频文件不存在")

        # 获取文件名
        filename = os.path.basename(file_path)
        title = audio_meta.get("title", "音频")
        # 清理标题中的特殊字符，用作下载文件名
        safe_title = "".join(c for c in title if c.isalnum() or c in " -_").strip()
        ext = os.path.splitext(filename)[1] or ".mp3"
        download_name = f"{safe_title}{ext}"

        return FileResponse(
            file_path,
            media_type="audio/mpeg",
            filename=download_name
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载音频失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))
