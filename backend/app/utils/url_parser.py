import re
from typing import Optional
import requests
import logging

logger = logging.getLogger(__name__)

_COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

# 抖音口令前缀模式：如 "7.77 Dya:/"、"8.94 RxF:/" 等
_DOUYIN_TOKEN_RE = re.compile(r'\d+\.\d+\s+[A-Za-z]{2,4}[./:]')
# 从文本中提取 URL 的正则
_URL_RE = re.compile(r'https?://[^\s<>"\']+')


def _resolve_short_url(short_url: str, timeout: int = 5) -> Optional[str]:
    """通过 HTTP 重定向解析短链接的真实 URL"""
    try:
        response = requests.head(short_url, allow_redirects=True, timeout=timeout, headers=_COMMON_HEADERS)
        return response.url
    except requests.RequestException as e:
        logger.warning(f"解析短链接失败 {short_url}: {e}")
        return None


def _extract_douyin_url_from_text(text: str) -> Optional[str]:
    """从抖音分享文本中提取 URL（支持口令格式和纯文本中的链接）"""
    # 先尝试提取文本中的 URL
    urls = _URL_RE.findall(text)
    douyin_urls = [u for u in urls if 'douyin' in u.lower() or 'v.douyin' in u.lower()]
    if douyin_urls:
        return douyin_urls[0]

    # 尝试提取包含口令的 URL（口令文本中 URL 可能紧跟在口令后面）
    # 格式如: "7.77 Dya:/ https://v.douyin.com/xxx" 或 "复制打开抖音，看到 https://v.douyin.com/xxx"
    for url in urls:
        if 'v.douyin' in url or 'douyin.com' in url:
            return url

    return None


def extract_video_id(url: str, platform: str) -> Optional[str]:
    """
    从视频链接中提取视频 ID

    :param url: 视频链接或分享文本
    :param platform: 平台名（bilibili / youtube / douyin / xiaohongshu / kuaishou / cctv）
    :return: 提取到的视频 ID 或 None
    """
    if platform == "bilibili":
        if "b23.tv" in url:
            resolved_url = _resolve_short_url(url)
            if resolved_url:
                url = resolved_url

        match = re.search(r"BV([0-9A-Za-z]+)", url)
        return f"BV{match.group(1)}" if match else None

    elif platform == "youtube":
        match = re.search(r"(?:v=|youtu\.be/)([0-9A-Za-z_-]{11})", url)
        return match.group(1) if match else None

    elif platform == "douyin":
        # 检测抖音口令格式（如 "7.77 Dya:/ 复制打开抖音..."）
        actual_url = url
        if _DOUYIN_TOKEN_RE.search(url) and 'http' not in url[:url.find('http') if 'http' in url else len(url)]:
            extracted = _extract_douyin_url_from_text(url)
            if extracted:
                actual_url = extracted

        # 从包含口令的文本中提取 URL
        if 'http' in actual_url and not actual_url.strip().startswith('http'):
            extracted = _extract_douyin_url_from_text(actual_url)
            if extracted:
                actual_url = extracted

        # 解析短链接
        if "v.douyin.com" in actual_url:
            resolved = _resolve_short_url(actual_url)
            if resolved:
                actual_url = resolved

        match = re.search(r"/(?:video|note)/(\d+)", actual_url)
        return match.group(1) if match else None

    elif platform == "xiaohongshu":
        # 处理 xhslink.com 短链接
        if "xhslink.com" in url:
            resolved = _resolve_short_url(url)
            if resolved:
                url = resolved

        # 匹配 xiaohongshu.com/explore/{note_id} 或 /discovery/item/{note_id}
        match = re.search(r"(?:explore|discovery/item)/([a-f0-9]{20,30})", url)
        if match:
            return match.group(1)
        # 匹配 user/profile/{user_id}/{note_id}
        match = re.search(r"/user/profile/[^/]+/([a-f0-9]{20,30})", url)
        return match.group(1) if match else None

    elif platform == "kuaishou":
        # 处理快手短链接
        if "v.kuaishou.com" in url or ("kuaishou.com" in url and "/fw/" in url):
            resolved = _resolve_short_url(url)
            if resolved:
                url = resolved

        # 匹配 kuaishou.com/short-video/{id} 或 /profile/{id}
        match = re.search(r"/short-video/([a-zA-Z0-9_-]+)", url)
        if match:
            return match.group(1)
        match = re.search(r"/profile/([a-zA-Z0-9_-]+)", url)
        return match.group(1) if match else None

    elif platform == "cctv":
        match = re.search(r"VID([A-Za-z0-9]+)", url)
        return f"VID{match.group(1)}" if match else None

    return None


def resolve_bilibili_short_url(short_url: str) -> Optional[str]:
    """解析哔哩哔哩短链接以获取真实视频链接"""
    return _resolve_short_url(short_url)
