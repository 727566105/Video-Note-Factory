from dataclasses import dataclass, field
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.audio_model import AudioDownloadResult
from app.models.transcriber_model import TranscriptResult


@dataclass
class NoteVersion:
    ver_id: str
    content: str
    style: Optional[str] = None
    model_name: Optional[str] = None
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class NoteResult:
    markdown: str                  # GPT 总结的 Markdown 内容
    transcript: Optional[TranscriptResult] = None  # Whisper 转写结果（图集为 None）
    audio_meta: Optional[AudioDownloadResult] = None  # 音频下载的元信息（图集为 None）
    model_name: Optional[str] = None  # 使用的模型名称
    style: Optional[str] = None  # 笔记风格
    versions: List[NoteVersion] = field(default_factory=list)  # 版本数组（持久化时使用）
    # 智能优选相关字段
    smart_switched: Optional[bool] = False  # 是否发生过智能切换
    used_model_id: Optional[int] = None  # 实际使用的模型 ID
    used_model_name: Optional[str] = None  # 实际使用的模型名称（用于前端展示）
    used_provider_name: Optional[str] = None  # 实际使用的供应商名称
    # 图集相关字段
    content_type: str = "video"  # "video" | "article" | "live_photo"
    task_id: Optional[str] = None
    title: Optional[str] = None
    author_id: Optional[str] = None
    author_name: Optional[str] = None
    video_id: Optional[str] = None
    platform: Optional[str] = None
    user_id: Optional[int] = None  # 多用户隔离：笔记所属用户 ID
