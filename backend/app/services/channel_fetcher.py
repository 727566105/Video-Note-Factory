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
from app.services.douyin_api import fetch_douyin_user_videos

logger = get_logger(__name__)

# B站分页请求间隔（秒，默认 10）
BILIBILI_PAGE_INTERVAL = int(os.getenv("BILIBILI_PAGE_INTERVAL", "10"))


class FetchResult:
    """获取结果封装，携带数据和错误信息。

    video_error 单独记录视频拉取错误，供回溯等功能判断视频是否成功
    （不被图文 RSSHub 抖动连带影响）。未传时默认为 None（视频成功）。
    next_cursor 透传抖音第一页的游标，供历史回溯复用，避免重复拉第一页。
    """

    def __init__(self, items=None, error=None, video_error=None, next_cursor=None):
        self.items = items or []
        self.error = error
        self.video_error = video_error
        self.next_cursor = next_cursor
        self.success = error is None

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
    "xiaohongshu": [
        r"xiaohongshu\.com",
        r"xhslink\.com",
    ],
    "kuaishou": [
        r"kuaishou\.com",
        r"v\.kuaishou\.com",
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
        return _resolve_douyin_from_video(url)

    # 小红书
    if any(re.search(p, url) for p in PLATFORM_PATTERNS["xiaohongshu"]):
        user_id = _extract_xiaohongshu_user_id(url)
        if user_id:
            return {
                "platform": "xiaohongshu",
                "platform_id": user_id,
                "channel_url": f"https://www.xiaohongshu.com/user/profile/{user_id}",
            }
        # 笔记链接：尝试从页面提取 user_id
        return _resolve_xiaohongshu_from_note(url)

    # 快手
    if any(re.search(p, url) for p in PLATFORM_PATTERNS["kuaishou"]):
        ks_uid = _extract_kuaishou_uid(url)
        if ks_uid:
            return {
                "platform": "kuaishou",
                "platform_id": ks_uid,
                "channel_url": f"https://www.kuaishou.com/profile/{ks_uid}",
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
        except Exception as e:
            logger.warning(f"yt-dlp 解析 YouTube @handle URL 失败: {e}")
    # 从视频URL
    match = re.search(r"(?:v=|youtu\.be/)([\w-]{11})", url)
    if match:
        try:
            ydl_opts = {"quiet": True, "no_warnings": True, "extract_flat": True}
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                if info and info.get("channel_id"):
                    return info["channel_id"]
                logger.warning(f"yt-dlp 解析视频 URL 成功但未获取到 channel_id, keys: {list(info.keys()) if info else 'None'}")
        except Exception as e:
            logger.warning(f"yt-dlp 解析 YouTube 视频 URL 失败: {e}")
    return None


def _extract_douyin_uid(url: str) -> Optional[str]:
    # sec_uid 格式包含字母、数字、点号、下划线、短横线
    match = re.search(r"douyin\.com/user/([A-Za-z0-9_.\-]+)", url)
    return match.group(1) if match else None


def _resolve_douyin_from_video(url: str) -> Optional[dict]:
    """从抖音视频 URL 解析出频道信息"""
    try:
        video_id_match = re.search(r"douyin\.com/(?:video|note)/(\d+)", url)
        if not video_id_match:
            return None

        from app.downloaders.douyin_downloader import DouyinDownloader
        downloader = DouyinDownloader()
        video_data = downloader.fetch_video_info(url)
        aweme = video_data.get('aweme_detail') or {}
        if not aweme:
            return None

        author = aweme.get('author') or {}
        sec_uid = author.get('sec_uid', '')
        nickname = author.get('nickname', '')

        if sec_uid:
            return {
                "platform": "douyin",
                "platform_id": sec_uid,
                "channel_url": f"https://www.douyin.com/user/{sec_uid}",
                "channel_name": nickname,
            }
    except Exception as e:
        logger.error(f"从抖音视频URL解析频道失败: {e}")
    return None


def _extract_kuaishou_uid(url: str) -> Optional[str]:
    """从快手 URL 提取用户 ID"""
    # /profile/{userId} 格式
    match = re.search(r'kuaishou\.com/profile/(\w+)', url)
    if match:
        return match.group(1)
    return None


def _extract_xiaohongshu_user_id(url: str) -> Optional[str]:
    """从小红书用户主页 URL 提取 user_id"""
    match = re.search(r"xiaohongshu\.com/user/profile/([a-f0-9]+)", url)
    return match.group(1) if match else None


def _resolve_xiaohongshu_from_note(url: str) -> Optional[dict]:
    """从小红书笔记 URL 解析出频道信息"""
    try:
        # 处理短链接
        if 'xhslink.com' in url:
            resp = requests.head(url, allow_redirects=True, timeout=10)
            url = resp.url

        # 提取 note_id 并访问页面获取 __INITIAL_STATE__
        note_id_match = re.search(r"xiaohongshu\.com/(?:explore|discovery/item)/([a-f0-9]+)", url)
        if not note_id_match:
            return None
        note_id = note_id_match.group(1)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.xiaohongshu.com/",
        }
        try:
            cfm = _get_cookie_manager()
            cookie_str = cfm.get("xiaohongshu")
            if cookie_str:
                headers["Cookie"] = cookie_str
        except Exception:
            pass

        resp = requests.get(f"https://www.xiaohongshu.com/explore/{note_id}", headers=headers, timeout=15)
        if resp.status_code != 200:
            return None

        match = re.search(r'__INITIAL_STATE__\s*=\s*({.+?})\s*</script>', resp.text, re.DOTALL)
        if not match:
            return None

        raw_json = match.group(1).replace('undefined', 'null')
        data = json.loads(raw_json)

        note_map = data.get('note', {}).get('noteDetailMap', {})
        note_data = None
        for key, val in note_map.items():
            note_data = val.get('note', {})
            break

        if not note_data:
            return None

        user = note_data.get('user', {})
        user_id = user.get("userId", "")
        nickname = user.get("nickname", "")

        if user_id:
            return {
                "platform": "xiaohongshu",
                "platform_id": user_id,
                "channel_url": f"https://www.xiaohongshu.com/user/profile/{user_id}",
                "channel_name": nickname,
            }
    except Exception as e:
        logger.error(f"从小红书笔记URL解析频道失败: {e}")
    return None


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


def fetch_bilibili_all_videos(mid: str, max_pages: int = 50, page_size: int = 50,
                              progress_callback=None, page_limit: int = None) -> FetchResult:
    """获取B站博主全部视频列表（分页）

    :param mid: 博主 ID（如 85742625）
    :param max_pages: 最大页数限制（防止无限循环）
    :param page_size: 每页数量（最大 50）
    :param page_limit: 限制获取的页数（None = 不限制，向后兼容）
    :return: FetchResult，包含 items 和 error
    """
    results = []
    first_error = None
    pn = 1
    pages_fetched = 0

    while pn <= max_pages:
        try:
            params = {
                "mid": mid,
                "pn": pn,
                "ps": page_size,
                "order": "pubdate",
                "platform": "web",
                "web_location": "space_video",
            }

            # WBI 签名
            try:
                signed_params = sign_wbi_params(params)
            except Exception as e:
                if first_error is None:
                    first_error = f"WBI签名失败: {e}"
                logger.error(f"WBI签名失败 (mid={mid}): {e}")
                break

            req_headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": f"https://space.bilibili.com/{mid}",
            }
            try:
                cfm = _get_cookie_manager()
                cookie_str = cfm.get("bilibili")
                if cookie_str:
                    req_headers["Cookie"] = cookie_str
            except Exception:
                pass

            # 优先使用 WBI 签名 API
            resp = requests.get(
                "https://api.bilibili.com/x/space/wbi/arc/search",
                params=signed_params,
                headers=req_headers,
                timeout=15,
            )
            data = resp.json()
            api_code = data.get("code")
            api_msg = data.get("message", "未知错误")

            # WBI API 返回错误时降级到旧 API
            if api_code in (-403, -352):
                logger.warning(f"WBI API 返回 {api_code}({api_msg})，降级到旧 API (mid={mid})")
                resp = requests.get(
                    "https://api.bilibili.com/x/space/arc/search",
                    params=params,
                    headers=req_headers,
                    timeout=15,
                )
                data = resp.json()
                api_code = data.get("code")
                api_msg = data.get("message", "未知错误")

            if api_code != 0:
                # 检测 B站 cookie 过期：-101=账号未登录
                if api_code == -101 or any(kw in api_msg for kw in ["未登录", "请先登录", "登录失效"]):
                    error_msg = "B站 Cookie 已过期，请在设置页重新配置"
                else:
                    error_msg = f"B站API错误({api_code}): {api_msg}"
                if first_error is None:
                    first_error = error_msg
                logger.error(f"B站视频列表 API 错误: {api_msg} (code={api_code})")
                break

            vlist = data.get("data", {}).get("list", {}).get("vlist", [])
            if not vlist:
                logger.info(f"B站博主 {mid} 视频获取完成，共 {len(results)} 条")
                break

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
            if progress_callback:
                progress_callback(pn, len(results))
            pages_fetched += 1
            # 分批获取：达到 page_limit 时暂停
            if page_limit and pages_fetched >= page_limit:
                logger.info(f"分批获取：达到 page_limit={page_limit}，暂停")
                break
            pn += 1
            time.sleep(BILIBILI_PAGE_INTERVAL)

        except Exception as e:
            if first_error is None:
                first_error = f"请求失败: {e}"
            logger.error(f"B站视频列表获取失败 (mid={mid}, pn={pn}): {e}")
            break

    return FetchResult(items=results, error=first_error)


def _fetch_youtube_rss(channel_id: str, limit: int = 15) -> list[dict]:
    """通过 YouTube RSS feed 获取频道最新视频（快速、无需 API key、稳定）

    RSS feed 返回最新 15 条视频，包含 ID/title/发布时间/缩略图。
    """
    import xml.etree.ElementTree as ET

    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    try:
        resp = requests.get(rss_url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            logger.warning(f"YouTube RSS 请求失败: {resp.status_code}")
            return []

        root = ET.fromstring(resp.content)
        ns = {'atom': 'http://www.w3.org/2005/Atom', 'yt': 'http://www.youtube.com/xml/schemas/2015', 'media': 'http://search.yahoo.com/mrss/'}

        items = []
        for entry in root.findall('atom:entry', ns)[:limit]:
            video_id = entry.find('yt:videoId', ns)
            title = entry.find('atom:title', ns)
            published = entry.find('atom:published', ns)
            thumbnail = entry.find('media:group/media:thumbnail', ns)

            if video_id is None:
                continue

            vid = video_id.text
            items.append({
                'content_type': 'video',
                'content_id': vid,
                'content_url': f"https://www.youtube.com/watch?v={vid}",
                'title': title.text if title is not None else '',
                'cover_url': thumbnail.get('url') if thumbnail is not None else None,
                'duration': 0,
                'published_at': published.text if published is not None else None,
            })

        logger.info(f"YouTube RSS 获取到 {len(items)} 条视频")
        return items
    except Exception as e:
        logger.error(f"YouTube RSS 获取异常: {e}")
        return []


def fetch_videos(channel_url: str, platform: str, limit: int | None = 20,
                  progress_callback=None, page_limit: int = None) -> FetchResult:
    """获取频道视频列表

    :param page_limit: 限制获取的页数（仅 B站有效，其他平台暂不支持）
    """
    if platform == "bilibili":
        mid = _extract_bilibili_mid(channel_url)
        if not mid:
            return FetchResult(error=f"无法提取B站博主ID: {channel_url}")
        max_pages = max(1, (limit // 50) + 1) if limit else 50
        # page_limit 优先于 max_pages 计算
        effective_max_pages = min(max_pages, page_limit) if page_limit else max_pages
        result = fetch_bilibili_all_videos(mid, max_pages=effective_max_pages,
                                           progress_callback=progress_callback, page_limit=page_limit)
        if limit and len(result.items) > limit:
            result.items = result.items[:limit]
        return result

    # 抖音：使用原生 API 获取最新视频（定时刷新只拉最新一页用于增量检测；
    # 历史回溯由 subscription_scheduler._backfill_douyin_history 用游标分页逐步完成）
    if platform == "douyin":
        sec_uid = _extract_douyin_uid(channel_url)
        if not sec_uid:
            return FetchResult(error=f"无法从 URL 提取抖音用户 ID: {channel_url}")
        # 定时刷新只从 cursor=0 拉最新约35条，历史回溯另走游标分页
        max_pages = 1
        result = fetch_douyin_user_videos(
            sec_uid=sec_uid,
            max_cursor=0,
            count=35,
            max_pages=max_pages,
            page_limit=page_limit,
            progress_callback=progress_callback,
        )
        if limit and len(result.items) > limit:
            result.items = result.items[:limit]
        # 透传 next_cursor，供历史回溯复用（避免回溯初始化重复拉第一页）
        return FetchResult(items=result.items, error=result.error,
                           next_cursor=str(result.next_cursor) if result.next_cursor else None)

    # 小红书：使用原生 API 分页获取
    if platform == "xiaohongshu":
        user_id = _extract_xiaohongshu_user_id(channel_url)
        if not user_id:
            return FetchResult(error=f"无法从 URL 提取小红书用户 ID: {channel_url}")
        from app.services.xiaohongshu_api import fetch_xiaohongshu_user_notes
        result = fetch_xiaohongshu_user_notes(
            user_id=user_id,
            count=30,
            max_pages=10,
            page_limit=page_limit,
            progress_callback=progress_callback,
        )
        if limit and len(result.items) > limit:
            result.items = result.items[:limit]
        return FetchResult(items=result.items, error=result.error)

    # 快手：使用 GraphQL API 获取用户作品
    if platform == "kuaishou":
        user_id = _extract_kuaishou_uid(channel_url)
        if not user_id:
            return FetchResult(error=f"无法从 URL 提取快手用户 ID: {channel_url}")
        from app.services.kuaishou_api import fetch_kuaishou_user_videos
        try:
            items = fetch_kuaishou_user_videos(user_id, limit=limit or 30)
            return FetchResult(items=items)
        except Exception as e:
            return FetchResult(error=f"快手作品列表获取失败: {e}")

    # YouTube：优先用 RSS feed（快速稳定），失败回退 yt-dlp
    if platform == "youtube":
        channel_id = _extract_youtube_channel(channel_url)
        if channel_id:
            rss_items = _fetch_youtube_rss(channel_id, limit or 15)
            if rss_items:
                return FetchResult(items=rss_items)
            # RSS 失败回退 yt-dlp
            logger.warning("YouTube RSS 获取失败，回退 yt-dlp")

    # 其他平台（YouTube yt-dlp 兜底等）：使用 yt-dlp
    try:
        import yt_dlp
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "playlistend": limit,
        }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_url, download=False)
            if not info or "entries" not in info:
                return FetchResult()
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
            return FetchResult(items=results)
    except Exception as e:
        logger.error(f"获取视频列表失败 [{platform}]: {e}")
        return FetchResult(error=f"获取失败: {e}")


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

    # 抖音：使用抖音 API 获取用户信息
    if platform == "douyin":
        sec_uid = _extract_douyin_uid(channel_url)
        if sec_uid:
            from app.services.douyin_api import _fetch_douyin_user_info
            info = _fetch_douyin_user_info(sec_uid)
            if info:
                return info

    # 小红书：使用小红书 API 获取用户信息
    if platform == "xiaohongshu":
        user_id = _extract_xiaohongshu_user_id(channel_url)
        if user_id:
            from app.services.xiaohongshu_api import fetch_xiaohongshu_user_info
            info = fetch_xiaohongshu_user_info(user_id)
            if info:
                return info

    # 快手：使用快手 API 获取用户信息
    if platform == "kuaishou":
        user_id = _extract_kuaishou_uid(channel_url)
        if user_id:
            from app.services.kuaishou_api import fetch_kuaishou_user_info
            info = fetch_kuaishou_user_info(user_id)
            if info:
                return {
                    "channel_name": info.get("name", ""),
                    "avatar_url": info.get("avatar", ""),
                }

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


def fetch_all_for_subscription(subscription, limit: int = 20, progress_callback=None,
                                page_limit: int = None) -> FetchResult:
    """合并视频+图文，返回统一格式的动态列表

    拉取后自动写入 channel_videos 共享缓存表（仅对有 platform_id 且有视频内容的订阅），
    实现定时刷新与手动刷新路径统一，多用户订阅同一博主时共享缓存。

    :param page_limit: 限制获取的页数（传递给平台获取函数）
    """
    results = []
    errors = []

    effective_limit = limit if limit else 0
    video_result = fetch_videos(subscription.channel_url, subscription.platform,
                                effective_limit or None, progress_callback=progress_callback,
                                page_limit=page_limit)
    # 写入共享缓存表（仅视频内容，图文走 RSSHub 不进 channel_videos）
    if subscription.platform_id and video_result.items:
        try:
            from app.db.channel_video_dao import upsert_channel_videos
            upsert_channel_videos(video_result.items, subscription.platform, subscription.platform_id)
        except Exception as e:
            logger.warning(f"写入 channel_videos 共享缓存失败 [{subscription.platform}]: {e}")
    for v in video_result.items:
        v["user_id"] = subscription.user_id
        v["subscription_id"] = subscription.id
        v["platform"] = subscription.platform
    results.extend(video_result.items)
    if video_result.error:
        errors.append(f"视频: {video_result.error}")

    if subscription.platform_id:
        articles = fetch_articles(subscription.platform, subscription.platform_id, limit)
        for a in articles:
            a["user_id"] = subscription.user_id
            a["subscription_id"] = subscription.id
            a["platform"] = subscription.platform
        results.extend(articles)

    combined_error = "; ".join(errors) if errors else None
    # video_error 单独记录视频拉取错误（不含图文 RSSHub 错误），供回溯判断视频是否成功
    video_error = video_result.error
    # next_cursor 透传抖音第一页游标，供历史回溯复用
    return FetchResult(items=results, error=combined_error, video_error=video_error,
                       next_cursor=video_result.next_cursor)


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