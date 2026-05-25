from pydantic import AnyUrl, validator, BaseModel, field_validator
import re
from urllib.parse import urlparse

SUPPORTED_PLATFORMS = {
    "bilibili": r"(https?://)?(www\.)?bilibili\.com/video/[a-zA-Z0-9]+",
    "youtube": r"(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w\-]+",
    "douyin": r"(https?://)?(www\.|v\.)?douyin\.com",
    "kuaishou": r"(https?://)?(www\.)?kuaishou\.com",
    "xiaohongshu": r"(https?://)?(www\.)?xiaohongshu\.com",
}


def is_supported_video_url(url: str) -> bool:
    parsed = urlparse(url)

    # 检查是否为Bilibili的短链接
    if parsed.netloc == "b23.tv":
        return True

    # 检查是否为小红书短链接
    if parsed.netloc == "xhslink.com" or parsed.netloc.endswith(".xhslink.com"):
        return True

    for name, pattern in SUPPORTED_PLATFORMS.items():
        if re.match(pattern, url):
            return True
    return False


class VideoRequest(BaseModel):
    url: AnyUrl
    platform: str

    @field_validator("url")
    def validate_video_url(cls, v):
        if not is_supported_video_url(str(v)):
            raise ValueError("暂不支持该视频平台或链接格式无效")
        return v
