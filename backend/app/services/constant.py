from app.downloaders.bilibili_downloader import BilibiliDownloader
from app.downloaders.cctv_downloader import CCTVDownloader
from app.downloaders.douyin_downloader import DouyinDownloader
from app.downloaders.kuaishou_downloader import KuaiShouDownloader
from app.downloaders.local_downloader import LocalDownloader
from app.downloaders.local_audio_downloader import LocalAudioDownloader
from app.downloaders.xiaohongshu_downloader import XiaohongshuDownloader
from app.downloaders.youtube_downloader import YoutubeDownloader

SUPPORT_PLATFORM_MAP = {
    'youtube': YoutubeDownloader,
    'bilibili': BilibiliDownloader,
    'cctv': CCTVDownloader,
    'tiktok': DouyinDownloader,
    'kuaishou': KuaiShouDownloader,
    'douyin': DouyinDownloader,
    'xiaohongshu': XiaohongshuDownloader,
    'local': LocalDownloader,
    'local_audio': LocalAudioDownloader
}

# 频道 URL 映射（用于根据平台 ID 生成频道 URL）
CHANNEL_URL_MAP = {
    "bilibili": "https://space.bilibili.com/{platform_id}",
    "youtube": "https://www.youtube.com/channel/{platform_id}",
    "douyin": "https://www.douyin.com/user/{platform_id}",
    "xiaohongshu": "https://www.xiaohongshu.com/user/profile/{platform_id}",
}

# 平台目录映射（四级目录结构 video/{platform}/{author}/{video})
PLATFORM_DIR_MAP = {
    "bilibili": "bilibili",
    "youtube": "youtube",
    "cctv": "cctv",
    "douyin": "douyin",
    "tiktok": "douyin",
    "kuaishou": "kuaishou",
    "xiaohongshu": "xiaohongshu",
    "local": "local",
    "local_audio": "local",
}


def get_platform_dir(platform: str) -> str:
    """根据平台标识获取目录名，未知平台返回 '_other'"""
    return PLATFORM_DIR_MAP.get(platform.lower(), "_other")