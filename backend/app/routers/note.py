# app/routers/note.py
import json
import os
import uuid
import hashlib
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
from datetime import datetime

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from pydantic import BaseModel, validator, field_validator
from dataclasses import asdict

from app.db.video_task_dao import get_task_by_video, get_all_tasks, delete_task_by_id
from app.enmus.exception import NoteErrorEnum
from app.enmus.note_enums import DownloadQuality
from app.exceptions.note import NoteError
from app.services.note import NoteGenerator, logger
from app.utils.response import ResponseWrapper as R
from app.utils.url_parser import extract_video_id
from app.validators.video_url_validator import is_supported_video_url
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
import httpx
from app.enmus.task_status_enums import TaskStatus

# from app.services.downloader import download_raw_audio
# from app.services.whisperer import transcribe_audio

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


NOTE_OUTPUT_DIR = os.getenv("NOTE_OUTPUT_DIR", "note_results")
UPLOAD_DIR = "uploads"


def save_note_to_file(task_id: str, note):
    os.makedirs(NOTE_OUTPUT_DIR, exist_ok=True)
    result_path = os.path.join(NOTE_OUTPUT_DIR, f"{task_id}.json")

    # 检查是否存在旧版本
    existing_versions = []
    existing_transcript = None
    existing_audio_meta = None
    if os.path.exists(result_path):
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
    new_version = NoteVersion(
        ver_id=f"{task_id}-{uuid.uuid4()}",
        content=note.markdown,
        style=note.style,
        model_name=note.model_name,
        created_at=datetime.now().isoformat()
    )

    # 合并版本（新版本在前）
    all_versions = [asdict(new_version)] + existing_versions

    # 构建保存数据 - 使用现有的 transcript 和 audio_meta（如果存在）
    save_data = {
        "markdown": note.markdown,  # 保持兼容性
        "transcript": existing_transcript or asdict(note.transcript) if note.transcript else {},
        "audio_meta": existing_audio_meta or asdict(note.audio_meta) if note.audio_meta else {},
        "model_name": note.model_name,
        "style": note.style,
        "versions": all_versions  # 新增版本数组
    }

    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(save_data, f, ensure_ascii=False, indent=2)


def run_note_task(task_id: str, video_url: str, platform: str, quality: DownloadQuality,
                  link: bool = False, screenshot: bool = False, model_name: str = None, provider_id: str = None,
                  _format: list = None, style: str = None, extras: str = None, video_understanding: bool = False,
                  video_interval=0, grid_size=[]
                  ):

    if not model_name or not provider_id:
        raise HTTPException(status_code=400, detail="请选择模型和提供者")

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
        screenshot=screenshot
        , video_understanding=video_understanding,
        video_interval=video_interval,
        grid_size=grid_size
    )
    logger.info(f"Note generated: {task_id}")
    if not note or not note.markdown:
        logger.warning(f"任务 {task_id} 执行失败，跳过保存")
        return
    save_note_to_file(task_id, note)



@router.post('/delete_task')
def delete_task(data: RecordRequest):
    try:
        # 优先使用 task_id 删除（更精确）
        if data.task_id:
            # 删除数据库记录
            delete_task_by_id(data.task_id)
            # 删除笔记相关文件
            result_file = os.path.join(NOTE_OUTPUT_DIR, f"{data.task_id}.json")
            status_file = os.path.join(NOTE_OUTPUT_DIR, f"{data.task_id}.status.json")
            audio_cache = os.path.join(NOTE_OUTPUT_DIR, f"{data.task_id}_audio.json")
            transcript_cache = os.path.join(NOTE_OUTPUT_DIR, f"{data.task_id}_transcript.json")
            md_cache = os.path.join(NOTE_OUTPUT_DIR, f"{data.task_id}.md")

            for file_path in [result_file, status_file, audio_cache, transcript_cache, md_cache]:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"已删除文件: {file_path}")
        else:
            # 兼容旧逻辑：通过 video_id + platform 删除
            delete_task_by_video(data.video_id, data.platform)

        return R.success(msg='删除成功')
    except Exception as e:
        logger.error(f"删除任务失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    file_location = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_location, "wb+") as f:
        f.write(await file.read())

    # 假设你静态目录挂载了 /uploads
    return R.success({"url": f"/uploads/{file.filename}"})


@router.post("/generate_note")
def generate_note(data: VideoRequest, background_tasks: BackgroundTasks):
    try:

        video_id = extract_video_id(data.video_url, data.platform)
        # if not video_id:
        #     raise HTTPException(status_code=400, detail="无法提取视频 ID")
        # existing = get_task_by_video(video_id, data.platform)
        # if existing:
        #     return R.error(
        #         msg='笔记已生成，请勿重复发起',
        #
        #     )
        if data.task_id:
            # 如果传了task_id，说明是重试！
            task_id = data.task_id
            # 更新之前的状态
            NoteGenerator()._update_status(task_id, TaskStatus.PENDING)
            logger.info(f"重试模式，复用已有 task_id={task_id}")
        else:
            # 正常新建任务
            task_id = str(uuid.uuid4())

        background_tasks.add_task(run_note_task, task_id, data.video_url, data.platform, data.quality, data.link,
                                  data.screenshot, data.model_name, data.provider_id, data.format, data.style,
                                  data.extras, data.video_understanding, data.video_interval, data.grid_size)
        return R.success({"task_id": task_id})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/task_status/{task_id}")
def get_task_status(task_id: str):
    status_path = os.path.join(NOTE_OUTPUT_DIR, f"{task_id}.status.json")
    result_path = os.path.join(NOTE_OUTPUT_DIR, f"{task_id}.json")

    # 优先读状态文件
    if os.path.exists(status_path):
        with open(status_path, "r", encoding="utf-8") as f:
            status_content = json.load(f)

        status = status_content.get("status")
        message = status_content.get("message", "")

        if status == TaskStatus.SUCCESS.value:
            # 成功状态的话，继续读取最终笔记内容
            if os.path.exists(result_path):
                with open(result_path, "r", encoding="utf-8") as rf:
                    result_content = json.load(rf)
                return R.success({
                    "status": status,
                    "result": result_content,
                    "message": message,
                    "task_id": task_id
                })
            else:
                # 理论上不会出现，保险处理
                return R.success({
                    "status": TaskStatus.PENDING.value,
                    "message": "任务完成，但结果文件未找到",
                    "task_id": task_id
                })

        if status == TaskStatus.FAILED.value:
            return R.error(message or "任务失败", code=500)

        # 处理中状态
        return R.success({
            "status": status,
            "message": message,
            "task_id": task_id
        })

    # 没有状态文件，但有结果
    if os.path.exists(result_path):
        with open(result_path, "r", encoding="utf-8") as f:
            result_content = json.load(f)
        return R.success({
            "status": TaskStatus.SUCCESS.value,
            "result": result_content,
            "task_id": task_id
        })

    # 什么都没有，默认PENDING
    return R.success({
        "status": TaskStatus.PENDING.value,
        "message": "任务排队中",
        "task_id": task_id
    })


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

    return base_headers


@router.get("/image_proxy")
async def image_proxy(request: Request, url: str):
    """图片代理接口，支持本地缓存"""
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


@router.get("/tasks")
def get_tasks(limit: int = 100):
    """获取所有历史任务列表"""
    try:
        db_tasks = get_all_tasks(limit)
        result = []

        for task in db_tasks:
            result_path = os.path.join(NOTE_OUTPUT_DIR, f"{task.task_id}.json")
            if os.path.exists(result_path):
                with open(result_path, "r", encoding="utf-8") as f:
                    note_data = json.load(f)
                result.append({
                    "task_id": task.task_id,
                    "video_id": task.video_id,
                    "platform": task.platform,
                    "created_at": task.created_at.isoformat() if task.created_at else None,
                    "note": note_data
                })
            else:
                # 只有数据库记录，没有笔记文件的情况
                result.append({
                    "task_id": task.task_id,
                    "video_id": task.video_id,
                    "platform": task.platform,
                    "created_at": task.created_at.isoformat() if task.created_at else None,
                    "note": None
                })

        return R.success({"tasks": result})
    except Exception as e:
        logger.error(f"Failed to get tasks: {e}")
        return R.error(msg=str(e))
