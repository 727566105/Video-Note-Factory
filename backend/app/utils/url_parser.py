import re
from typing import Optional
import requests

_COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}


def extract_video_id(url: str, platform: str) -> Optional[str]:
    """
    从视频链接中提取视频 ID

    :param url: 视频链接
    :param platform: 平台名（bilibili / youtube / douyin）
    :return: 提取到的视频 ID 或 None
    """
    if platform == "bilibili":
        # 如果是短链接，则解析真实链接
        if "b23.tv" in url:
            resolved_url = resolve_bilibili_short_url(url)
            if resolved_url:
                url = resolved_url

        # 匹配 BV号（如 BV1vc411b7Wa）
        match = re.search(r"BV([0-9A-Za-z]+)", url)
        return f"BV{match.group(1)}" if match else None

    elif platform == "youtube":
        # 匹配 v=xxxxx 或 youtu.be/xxxxx，ID 长度通常为 11
        match = re.search(r"(?:v=|youtu\.be/)([0-9A-Za-z_-]{11})", url)
        return match.group(1) if match else None

    elif platform == "douyin":
        # 先检查是否为短链接（v.douyin.com），解析重定向后的真实 URL
        if "v.douyin.com" in url:
            try:
                response = requests.head(url, allow_redirects=True, timeout=5, headers=_COMMON_HEADERS)
                url = response.url
            except requests.RequestException:
                pass

        # 匹配 douyin.com/video/1234567890123456789 或 douyin.com/note/1234567890123456789（图文笔记）
        match = re.search(r"/(?:video|note)/(\d+)", url)
        return match.group(1) if match else None

    elif platform == "xiaohongshu":
        # 匹配 xiaohongshu.com/explore/{note_id} 或 /discovery/item/{note_id}
        match = re.search(r"(?:explore|discovery/item)/([a-f0-9]{20,30})", url)
        if match:
            return match.group(1)
        # 匹配 user/profile/{user_id}/{note_id}
        match = re.search(r"/user/profile/[^/]+/([a-f0-9]{20,30})", url)
        return match.group(1) if match else None

    elif platform == "cctv":
        # 匹配 tv.cctv.com/{YYYY}/{MM}/{DD}/VID{random}.shtml
        match = re.search(r"VID([A-Za-z0-9]+)", url)
        return f"VID{match.group(1)}" if match else None

    return None


def resolve_bilibili_short_url(short_url: str) -> Optional[str]:
    """
    解析哔哩哔哩短链接以获取真实视频链接

    :param short_url: Bilibili短链接（如"https://b23.tv/xxxxxx"）
    :return: 真实的视频链接或None
    """
    try:
        response = requests.head(short_url, allow_redirects=True, headers=_COMMON_HEADERS)
        return response.url
    except requests.RequestException as e:
        print(f"Error resolving short URL: {e}")
        return None
