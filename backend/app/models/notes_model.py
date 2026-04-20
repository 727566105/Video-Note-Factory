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
    transcript: TranscriptResult                # Whisper 转写结果
    audio_meta: AudioDownloadResult  # 音频下载的元信息（title、duration、封面等）
    model_name: Optional[str] = None  # 使用的模型名称
    style: Optional[str] = None  # 笔记风格
    versions: List[NoteVersion] = field(default_factory=list)  # 版本数组（持久化时使用）
