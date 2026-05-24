from dataclasses import dataclass, field
from typing import Optional, List


@dataclass
class AudioDownloadResult:
    file_path: str               # 本地音频路径
    title: str                   # 视频标题
    duration: float              # 视频时长（秒）
    cover_url: Optional[str]     # 视频封面图
    platform: str                # 平台，如 "bilibili"
    video_id: str                # 唯一视频ID
    raw_info: dict               # yt-dlp 的原始 info 字典
    video_path: Optional[str] = None  #  新增字段：可选视频文件路径
    description: Optional[str] = None  # 视频描述
    author_id: Optional[str] = None
    author_name: Optional[str] = None  # 博主名称
    content_type: str = "video"  # "video" | "article" | "live_photo"
    images: Optional[List[str]] = None  # 本地图片路径列表（用于图集）


@dataclass
class VideoInfoResult:
    """视频元数据（不下载文件，仅获取信息）"""
    title: str
    duration: float
    cover_url: Optional[str]
    platform: str
    video_id: str
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    description: Optional[str] = None
    raw_info: dict = field(default_factory=dict)
    content_type: str = "video"  # "video" | "article" | "live_photo"

