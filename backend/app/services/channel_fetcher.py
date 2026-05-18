"""频道数据获取服务 — yt-dlp 获取视频列表 + RSSHub 获取图文动态"""
import os
import json
import re
import tempfile
import time
from typing import Optional
from datetime import datetime

import feedparser
import requests

from app.utils.logger import get_logger
from app.services.bilibili_wbi import sign_wbi_params

logger = get_logger(__name__)

RSSHUB_BASE_URL = os.getenv("RSSHUB_BASE_URL", "https://rsshub.app")


def _get_cookie_manager():
    from app.services.cookie_manager import CookieConfigManager
    return CookieConfigManager()


def _fix_image_url(url: str) -> str:
    """修复图片 URL：补全协议，确保 https"""
    if not url:
        return url
    if url.startswith("//"):
        return "https:" + url
    if url.startswith("http://"):
        return "https://" + url[7:]
    return url


# 平台 URL 匹配规则
PLATFORM_PATTERNS = {
    "bilibili": [
        r"bilibili\.com",
        r"b23\.tv",
    ],
    "youtube": [
        r"youtube\.com",
        r"youtu\.be",
    ],
    "douyin": [
        r"douyin\.com",
        r"v\.douyin\.com",
    ],
}

# 平台对应的 RSSHub 路径模板
RSSHUB_TEMPLATES = {
    "bilibili": {
        "videos": "/bilibili/user/video/{mid}",
        "dynamic": "/bilibili/user/dynamic/{mid}",
    },
    "youtube": {
        "videos": "/youtube/channel/{channelId}",
    },
    "douyin": {
        "videos": "/douyin/user/{sec_uid}",
    },
}


def _make_platform_cookiefile(domain: str, cookie_str: str) -> str:
    """将浏览器格式 cookie 转为 Netscape 格式临时文件"""
    cf = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    # Netscape cookie 文件必须以注释行开头
    cf.write("# Netscape HTTP Cookie File\n")
    for item in cookie_str.split(';'):
        item = item.strip()
        if '=' in item:
            name, value = item.split('=', 1)
            cf.write(f".{domain}\tTRUE\t/\tTRUE\t0\t{name.strip()}\t{value.strip()}\n")
    cf.close()
    return cf.name


def _make_bilibili_cookiefile(cookie_str: str) -> str:
    """将浏览器格式 cookie 转为 Netscape 格式临时文件（B站专用）"""
    return _make_platform_cookiefile("bilibili.com", cookie_str)


def identify_platform(url: str) -> Optional[dict]:
    """从 URL 识别平台和提取 platform_id。
    支持频道URL和视频URL。
    返回: {"platform", "platform_id", "channel_url", ...} 或 None
    """
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    # B站
    if any(re.search(p, url) for p in PLATFORM_PATTERNS["bilibili"]):
        mid = _extract_bilibili_mid(url)
        if mid:
            return {
                "platform": "bilibili",
                "platform_id": mid,
                "channel_url": f"https://space.bilibili.com/{mid}",
            }
        return _resolve_bilibili_from_video(url)

    # YouTube
    if any(re.search(p, url) for p in PLATFORM_PATTERNS["youtube"]):
        channel_id = _extract_youtube_channel(url)
        if channel_id:
            return {
                "platform": "youtube",
                "platform_id": channel_id,
                "channel_url": f"https://www.youtube.com/channel/{channel_id}",
            }

    # 抖音
    if any(re.search(p, url) for p in PLATFORM_PATTERNS["douyin"]):
        uid = _extract_douyin_uid(url)
        if uid:
            return {
                "platform": "douyin",
                "platform_id": uid,
                "channel_url": f"https://www.douyin.com/user/{uid}",
            }

    return None


def _extract_bilibili_mid(url: str) -> Optional[str]:
    match = re.search(r"space\.bilibili\.com/(\d+)", url)
    return match.group(1) if match else None


def _resolve_bilibili_from_video(url: str) -> Optional[dict]:
    """从B站视频URL解析出频道信息"""
    try:
        import yt_dlp
        ydl_opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
        cfm = _get_cookie_manager()
        cookie_str = cfm.get("bilibili")
        if cookie_str:
            ydl_opts["cookiefile"] = _make_bilibili_cookiefile(cookie_str)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            if info:
                uploader_id = info.get("uploader_id") or info.get("channel_id")
                uploader = info.get("uploader") or info.get("channel")
                if uploader_id:
                    return {
                        "platform": "bilibili",
                        "platform_id": str(uploader_id),
                        "channel_url": f"https://space.bilibili.com/{uploader_id}",
                        "channel_name": uploader,
                    }
    except Exception as e:
        logger.error(f"从B站视频URL解析频道失败: {e}")
    return None


def _extract_youtube_channel(url: str) -> Optional[str]:
    """提取YouTube channelId"""
    import yt_dlp

    match = re.search(r"youtube\.com/channel/(UC[\w-]+)", url)
    if match:
        return match.group(1)
    # @handle 格式需要 yt-dlp 解析
    match = re.search(r"youtube\.com/@([\w-]+)", url)
    if match:
        try:
            ydl_opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info and info.get("channel_id"):
                    return info["channel_id"]
        except Exception:
            pass
    # 从视频URL
    match = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", url)
    if match:
        try:
            ydl_opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info and info.get("channel_id"):
                    return info["channel_id"]
        except Exception:
            pass
    return None


def _extract_douyin_uid(url: str) -> Optional[str]:
    match = re.search(r"douyin\.com/user/([A-Za-z0-9_-]+)", url)
    return match.group(1) if match else None


def _parse_duration(length_str) -> int:
    """将 MM:SS 或 HH:MM:SS 格式转为秒数"""
    if not length_str:
        return 0
    if isinstance(length_str, (int, float)):
        return int(length_str)
    parts = str(length_str).split(":")
    try:
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        return int(parts[0])
    except (ValueError, IndexError):
        return 0


def fetch_bilibili_all_videos(mid: str, max_pages: int = 50, page_size: int = 50) -> list[dict]:
    """获取B站博主全部视频列表（分页）

    :param mid: 博主 ID（如 85742625）
    :param max_pages: 最大页数限制（防止无限循环）
    :param page_size: 每页数量（最大 50）
    :return: 视频列表
    """
    results = []
    pn = 1

    while pn <= max_pages:
        try:
            # 构造请求参数
            params = {
                "mid": mid,
                "pn": pn,
                "ps": page_size,
                "order": "pubdate",  # 按发布时间排序
                "platform": "web",
                "web_location": "space_video",
            }

            # WBI 签名
            signed_params = sign_wbi_params(params)

            # 请求 API
            resp = requests.get(
                "https://api.bilibili.com/x/space/wbi/arc/search",
                params=signed_params,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": f"https://space.bilibili.com/{mid}",
                },
                timeout=15,
            )
            data = resp.json()

            if data.get("code") != 0:
                logger.error(f"B站视频列表 API 错误: {data.get('message')}")
                break

            vlist = data.get("data", {}).get("list", {}).get("vlist", [])
            if not vlist:
                logger.info(f"B站博主 {mid} 视频获取完成，共 {len(results)} 条")
                break

            # 解析视频信息
            for v in vlist:
                bvid = v.get("bvid", "")
                results.append({
                    "content_type": "video",
                    "content_id": bvid,
                    "content_url": f"https://www.bilibili.com/video/{bvid}",
                    "title": v.get("title", ""),
                    "cover_url": _fix_image_url(v.get("pic", "")),
                    "duration": _parse_duration(v.get("length", "")),
                    "author": v.get("author", ""),
                    "description": v.get("description", ""),
                    "published_at": datetime.fromtimestamp(v.get("created", 0)) if v.get("created") else None,
                    "raw_info": json.dumps(v, ensure_ascii=False, default=str),
                })

            logger.info(f"B站博主 {mid} 第 {pn} 页获取成功，本页 {len(vlist)} 条")
            pn += 1

            # 请求间隔 10 秒
            time.sleep(10)

        except Exception as e:
            logger.error(f"B站视频列表获取失败 (mid={mid}, pn={pn}): {e}")
            break

    return results


def fetch_videos(channel_url: str, platform: str, limit: int = 20) -> list[dict]:
    """获取频道视频列表"""
    # B站：使用 WBI 签名 API 获取全部视频
    if platform == "bilibili":
        mid = _extract_bilibili_mid(channel_url)
        if not mid:
            logger.error(f"无法提取B站博主 ID: {channel_url}")
            return []
        # max_pages 根据 limit 计算（每页50条）
        max_pages = max(1, (limit // 50) + 1) if limit else 50
        videos = fetch_bilibili_all_videos(mid, max_pages=max_pages)
        # 如果 limit 指定了数量，截取
        if limit and len(videos) > limit:
            videos = videos[:limit]
        return videos

    # 其他平台：使用 yt-dlp
    try:
        import yt_dlp
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "playlistend": limit,
        }
        # 抖音需要 cookie
        if platform == "douyin":
            cfm = _get_cookie_manager()
            cookie_str = cfm.get("douyin")
            if cookie_str:
                ydl_opts["cookiefile"] = _make_platform_cookiefile("douyin.com", cookie_str)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url, download=False)
            if not info or "entries" not in info:
                return []
            results = []
            for entry in info["entries"][:limit]:
                if not entry:
                    continue
                content_id = entry.get("id", "")
                content_url = entry.get("url", "")
                results.append({
                    "content_type": "video",
                    "content_id": content_id,
                    "content_url": content_url,
                    "title": entry.get("title", ""),
                    "duration": entry.get("duration"),
                    "author": entry.get("uploader") or entry.get("channel"),
                    "description": entry.get("description", ""),
                    "raw_info": json.dumps(entry, ensure_ascii=False, default=str),
                })
            return results
    except Exception as e:
        logger.error(f"获取视频列表失败 [{platform}]: {e}")
        return []


def fetch_articles(platform: str, platform_id: str, limit: int = 20) -> list[dict]:
    """使用 RSSHub 获取图文动态"""
    templates = RSSHUB_TEMPLATES.get(platform, {})
    dynamic_path = templates.get("dynamic")
    if not dynamic_path:
        return []

    rss_url = f"{RSSHUB_BASE_URL}{dynamic_path.format(**{'mid': platform_id, 'channelId': platform_id, 'sec_uid': platform_id})}"
    try:
        feed = feedparser.parse(rss_url)
        if not feed.entries:
            return []
        results = []
        for entry in feed.entries[:limit]:
            images = []
            if hasattr(entry, "media_content"):
                images = [m.get("url", "") for m in entry.media_content if m.get("url")]
            results.append({
                "content_type": "article",
                "content_id": entry.get("id", ""),
                "content_url": entry.get("link", ""),
                "title": entry.get("title", ""),
                "description": entry.get("summary", ""),
                "author": entry.get("author", ""),
                "images": json.dumps(images, ensure_ascii=False) if images else None,
                "published_at": _parse_rss_date(entry.get("published")),
                "raw_info": json.dumps(dict(entry), ensure_ascii=False, default=str),
            })
        return results
    except Exception as e:
        logger.error(f"RSSHub 获取图文动态失败 [{platform}]: {e}")
        return []


def _fetch_bilibili_user_info(mid: str) -> Optional[dict]:
    """调用 B站公开 API 获取用户信息（名称、头像）"""
    try:
        resp = requests.get(
            "https://api.bilibili.com/x/web-interface/card",
            params={"mid": mid},
            headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.bilibili.com"},
            timeout=10,
        )
        data = resp.json()
        if data.get("code") == 0:
            card = data.get("data", {}).get("card", {})
            return {
                "channel_name": card.get("name", ""),
                "avatar_url": _fix_image_url(card.get("face", "")),
            }
    except Exception as e:
        logger.error(f"获取 B站用户信息失败 ({mid}): {e}")
    return None


def parse_channel_info(channel_url: str, platform: str) -> dict:
    """提取频道名称和头像"""
    # B站：直接调用 API，不依赖 yt-dlp
    if platform == "bilibili":
        mid = _extract_bilibili_mid(channel_url)
        if mid:
            info = _fetch_bilibili_user_info(mid)
            if info:
                return info

    # 其他平台：使用 yt-dlp
    try:
        import yt_dlp
        ydl_opts = {"quiet": True, "no_warnings": True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url, download=False)
            return {
                "channel_name": info.get("channel") or info.get("uploader", ""),
                "avatar_url": info.get("avatar") or info.get("thumbnail", ""),
            }
    except Exception as e:
        logger.error(f"获取频道信息失败: {e}")
    return {}


def fetch_all_for_subscription(subscription, limit: int = 20) -> list[dict]:
    """合并视频+图文，返回统一格式的动态列表"""
    results = []
    # yt-dlp 获取视频
    videos = fetch_videos(subscription.channel_url, subscription.platform, limit)
    for v in videos:
        v["user_id"] = subscription.user_id
        v["subscription_id"] = subscription.id
        v["platform"] = subscription.platform
    results.extend(videos)

    # RSSHub 获取图文（如果平台支持）
    if subscription.platform_id:
        articles = fetch_articles(subscription.platform, subscription.platform_id, limit)
        for a in articles:
            a["user_id"] = subscription.user_id
            a["subscription_id"] = subscription.id
            a["platform"] = subscription.platform
        results.extend(articles)

    return results


def _parse_rss_date(date_str: str) -> Optional[str]:
    """解析 RSS 日期字符串为 ISO 格式"""
    if not date_str:
        return None
    try:
        from dateutil.parser import parse as dateutil_parse
        dt = dateutil_parse(date_str)
        return dt.isoformat()
    except Exception:
        return None