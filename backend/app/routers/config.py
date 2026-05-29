from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.utils.response import ResponseWrapper as R

from app.services.cookie_manager import CookieConfigManager
from ffmpeg_helper import ensure_ffmpeg_or_raise
from app.auth.dependencies import get_current_user, require_admin
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()
cookie_manager = CookieConfigManager()

PLATFORM_REQUIRED_FIELDS = {
    "bilibili": ["SESSDATA"],
    "douyin": ["ttwid", "sessionid"],
    "xiaohongshu": ["a1", "web_session"],
    "youtube": [],
    "kuaishou": [],
    "cctv": [],
}


class CookieUpdateRequest(BaseModel):
    platform: str
    cookie: str


class CookieTestRequest(BaseModel):
    platform: str
    cookie: str


@router.post("/test_downloader_cookie")
async def test_downloader_cookie(req: CookieTestRequest, user=Depends(require_admin)):
    """检查 Cookie 可用性：格式校验 + 在线验证"""
    import requests as http_requests

    platform = req.platform
    cookie = req.cookie.strip()

    if not cookie:
        return R.success({"valid": False, "message": "Cookie 为空", "details": ""})

    # 平台不支持在线验证
    required = PLATFORM_REQUIRED_FIELDS.get(platform, [])
    if platform not in PLATFORM_REQUIRED_FIELDS:
        return R.success({"valid": False, "message": f"不支持的平台: {platform}", "details": ""})

    # 格式校验
    if required:
        missing = [f for f in required if f"{f}=" not in cookie and f"{f}:" not in cookie]
        if missing:
            return R.success({
                "valid": False,
                "message": f"缺少必需字段: {', '.join(missing)}",
                "details": f"请确保 Cookie 中包含 {'、'.join(missing)}",
            })

    # 不需要在线验证的平台
    if not required:
        return R.success({"valid": True, "message": "该平台无需 Cookie 即可使用", "details": ""})

    # 在线验证
    try:
        if platform == "bilibili":
            resp = http_requests.get(
                "https://api.bilibili.com/x/web-interface/nav",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://www.bilibili.com/",
                    "Cookie": cookie,
                },
                timeout=10,
            )
            data = resp.json()
            if data.get("code") == 0 and data.get("data", {}).get("isLogin"):
                uname = data["data"].get("uname", "")
                return R.success({
                    "valid": True,
                    "message": "B站 Cookie 有效",
                    "details": f"当前登录用户: {uname}" if uname else "",
                })
            else:
                msg = data.get("message", "")
                return R.success({
                    "valid": False,
                    "message": "B站 Cookie 已过期或无效",
                    "details": f"请重新获取 Cookie ({msg})" if msg else "请重新获取 Cookie",
                })

        elif platform == "douyin":
            from app.downloaders.douyin_helper.abogus import ABogus
            from app.downloaders.douyin_downloader import DouyinConfig, BaseRequestModel
            from urllib.parse import urlencode, quote

            params = BaseRequestModel().model_dump()
            params["sec_user_id"] = ""
            params["max_cursor"] = 0
            params["count"] = 1

            bogus = ABogus()
            a_bogus = quote(bogus.get_value(params), safe='')
            query_str = urlencode(params)
            url = f"https://www.douyin.com/aweme/v1/web/aweme/post/?{query_str}&a_bogus={a_bogus}"

            resp = http_requests.get(url, headers={
                "User-Agent": DouyinConfig.HEADERS["User-Agent"],
                "Referer": "https://www.douyin.com/",
                "Cookie": cookie,
                "Accept": "application/json",
            }, timeout=10)
            data = resp.json()

            status_code = data.get("status_code", -1)
            if status_code == 0:
                return R.success({"valid": True, "message": "抖音 Cookie 有效", "details": ""})
            elif status_code == 8:
                return R.success({"valid": False, "message": "抖音 Cookie 已过期", "details": "请在抖音网页端重新登录并获取 Cookie"})
            else:
                return R.success({
                    "valid": False,
                    "message": f"抖音 Cookie 验证失败 (code={status_code})",
                    "details": data.get("status_msg", "请重新获取 Cookie"),
                })

        elif platform == "xiaohongshu":
            # 小红书在线验证 API 复杂且不稳定，仅做格式校验
            return R.success({
                "valid": True,
                "message": "小红书 Cookie 格式正确",
                "details": "已通过格式验证，在线验证暂不支持",
            })

    except http_requests.Timeout:
        return R.success({"valid": False, "message": "验证请求超时", "details": "网络不稳定，请稍后重试"})
    except Exception as e:
        logger.error(f"Cookie 验证异常: {e}")
        return R.success({"valid": False, "message": f"验证失败: {e}", "details": ""})


@router.get("/get_downloader_cookie/{platform}")
def get_cookie(platform: str, current_user=Depends(require_admin)) -> dict:
    cookie = cookie_manager.get(platform)
    if not cookie:
        return R.success(msg='未找到Cookies')
    return R.success(
        data={"platform": platform, "cookie": cookie}
    )


@router.post("/update_downloader_cookie")
def update_cookie(data: CookieUpdateRequest, current_user=Depends(require_admin)) -> dict:
    cookie_manager.set(data.platform, data.cookie)
    return R.success(

    )

@router.get("/sys_health")
async def sys_health() -> dict:
    try:
        ensure_ffmpeg_or_raise()
        return R.success()
    except EnvironmentError:
        return R.error(msg="系统未安装 ffmpeg 请先进行安装")

@router.get("/sys_check")
async def sys_check() -> dict:
    return R.success()


@router.post("/cleanup_deleted_tasks")
async def cleanup_deleted_tasks(older_than_days: int = 30, current_user=Depends(require_admin)) -> dict:
    """管理员：清理已软删除超过指定天数的任务（真正删除数据库记录 + 文件）"""
    from app.db.video_task_dao import get_deleted_tasks, hard_delete_task
    from app.utils.path_helper import find_note_file, get_video_folder, get_note_folder

    tasks = get_deleted_tasks(older_than_days)
    cleaned = 0
    errors = []

    for task in tasks:
        try:
            # 检查是否还有其他用户引用同一视频
            from app.db.video_task_dao import get_db
            from app.db.models.video_tasks import VideoTask
            db = next(get_db())
            other_refs = db.query(VideoTask).filter(
                VideoTask.video_id == task.video_id,
                VideoTask.platform == task.platform,
                VideoTask.deleted_at.is_(None),
                VideoTask.id != task.id
            ).count()
            db.close()

            # 删除用户的笔记文件（note_{user_id}.json）
            if task.author_id:
                note_path = find_note_file(
                    task.task_id, task.author_id, task.author_name,
                    task.video_id, task.title, "note", task.platform,
                    user_id=task.user_id
                )
                if note_path and note_path.exists():
                    note_path.unlink()
                    import logging
                    logging.getLogger(__name__).info(f"已删除笔记文件: {note_path}")

                # 如果没有其他用户引用，清理整个视频目录
                if other_refs == 0:
                    try:
                        video_folder = get_video_folder(
                            task.author_id, task.author_name,
                            task.video_id, task.title, task.platform
                        )
                        if video_folder.exists():
                            import shutil
                            shutil.rmtree(video_folder)
                    except Exception:
                        pass

            # 硬删除数据库记录
            hard_delete_task(task.task_id)
            cleaned += 1
        except Exception as e:
            errors.append(f"task_id={task.task_id}: {str(e)}")

    result = {"cleaned": cleaned, "total": len(tasks)}
    if errors:
        result["errors"] = errors
    return R.success(result)