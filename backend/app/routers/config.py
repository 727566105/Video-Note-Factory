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
    "youtube": ["VISITOR_INFO1_LIVE"],
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
    from app.services.cookie_manager import CookieConfigManager

    platform = req.platform
    cookie = req.cookie.strip()

    if not cookie:
        return R.success({"valid": False, "message": "Cookie 为空", "details": ""})

    # 检测非法字符（非 latin-1 编码的字符会导致 HTTP header 异常）
    try:
        cookie.encode('latin-1')
    except UnicodeEncodeError:
        return R.success({
            "valid": False,
            "message": "Cookie 包含非法字符（中文或特殊符号）",
            "details": "请检查是否复制了完整的 Cookie 字符串，而非页面内容",
        })

    # 转换 Netscape 格式为浏览器格式（格式校验前必须转换）
    converted = CookieConfigManager.convert_netscape_to_browser_cookie(cookie)
    if converted:
        cookie = converted

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
            return R.success({
                "valid": True,
                "message": "小红书 Cookie 格式正确",
                "details": "已通过格式验证，在线验证暂不支持",
            })

        elif platform == "youtube":
            resp = http_requests.get(
                "https://www.youtube.com/feed/trending",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://www.youtube.com/",
                    "Cookie": cookie,
                },
                timeout=10,
            )
            if resp.status_code == 200 and "youtube" in resp.text.lower():
                return R.success({
                    "valid": True,
                    "message": "YouTube Cookie 有效",
                    "details": "已通过在线验证",
                })
            else:
                return R.success({
                    "valid": False,
                    "message": "YouTube Cookie 无效或已过期",
                    "details": "请重新获取 Cookie",
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
    try:
        cookie_manager.set(data.platform, data.cookie)
        return R.success()
    except ValueError as e:
        return R.error(msg=str(e))


@router.get("/note_options")
def get_note_options(current_user=Depends(get_current_user)) -> dict:
    """返回笔记风格和格式选项，供前端/插件动态拉取。
    直接复用 prompt_builder 的常量，后端改了插件自动同步。"""
    from app.gpt.prompt_builder import note_styles, note_formats
    return R.success(data={
        "styles": note_styles,
        "formats": note_formats,
    })


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