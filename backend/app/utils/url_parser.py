import re
from typing import Optional, Tuple
import requests
from urllib.parse import urlparse


def extract_url_from_share_text(text: str) -> Optional[str]:
    """
    从分享文本中智能提取 URL
    
    抖音分享文本示例：
    "6.46 07/17 b@N.jP Eus:/ :3pm https://v.douyin.com/CmDgdxUFsL0/ 复制此链接，打开Dou音搜索，直接观看视频！"
    
    支持的平台：
    - 抖音：v.douyin.com, douyin.com
    - B站：bilibili.com, b23.tv
    - YouTube：youtube.com, youtu.be
    - 快手：kuaishou.com
    
    Args:
        text: 分享文本（可能包含 URL 和其他内容）
        
    Returns:
        提取到的 URL 或 None
    """
    if not text or not text.strip():
        return None
    
    text = text.strip()
    
    url_patterns = [
        r'https?://v\.douyin\.com/[a-zA-Z0-9]+/',
        r'https?://www\.douyin\.com/video/\d+',
        r'https?://douyin\.com/video/\d+',
        r'https?://www\.bilibili\.com/video/[a-zA-Z0-9]+',
        r'https?://bilibili\.com/video/[a-zA-Z0-9]+',
        r'https?://b23\.tv/[a-zA-Z0-9]+',
        r'https?://www\.youtube\.com/watch\?v=[a-zA-Z0-9_-]+',
        r'https?://youtu\.be/[a-zA-Z0-9_-]+',
        r'https?://www\.kuaishou\.com/short-video/[a-zA-Z0-9]+',
        r'https?://kuaishou\.com/short-video/[a-zA-Z0-9]+',
        r'https?://v\.kuaishou\.com/[a-zA-Z0-9]+',
    ]
    
    for pattern in url_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    
    generic_url_pattern = r'https?://[^\s<>"{}|\\^`\[\]]+'
    match = re.search(generic_url_pattern, text)
    if match:
        url = match.group(0)
        if any(domain in url for domain in ['douyin', 'bilibili', 'youtube', 'kuaishou', 'b23.tv', 'youtu.be']):
            return url
    
    return None


def detect_platform_from_url(url: str) -> Optional[str]:
    """
    从 URL 自动检测平台
    
    Args:
        url: 视频链接
        
    Returns:
        平台名称 或 None
    """
    if not url:
        return None
    
    url_lower = url.lower()
    
    if 'douyin' in url_lower or 'v.douyin.com' in url_lower:
        return 'douyin'
    elif 'bilibili' in url_lower or 'b23.tv' in url_lower:
        return 'bilibili'
    elif 'youtube' in url_lower or 'youtu.be' in url_lower:
        return 'youtube'
    elif 'kuaishou' in url_lower:
        return 'kuaishou'
    
    return None


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
                response = requests.head(url, allow_redirects=True, timeout=5)
                url = response.url  # 获取重定向后的真实 URL
            except requests.RequestException:
                pass

        # 匹配 douyin.com/video/1234567890123456789
        match = re.search(r"/video/(\d+)", url)
        return match.group(1) if match else None

    return None


def resolve_bilibili_short_url(short_url: str) -> Optional[str]:
    """
    解析哔哩哔哩短链接以获取真实视频链接

    :param short_url: Bilibili短链接（如"https://b23.tv/xxxxxx"）
    :return: 真实的视频链接或None
    """
    try:
        response = requests.head(short_url, allow_redirects=True)
        return response.url
    except requests.RequestException as e:
        print(f"Error resolving short URL: {e}")
        return None
