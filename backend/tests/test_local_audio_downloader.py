"""LocalAudioDownloader 本地音频下载器测试。

覆盖回归场景：上传 WAV 等本地音频后「解析识别」失败。
根因：LocalAudioDownloader 未实现基类抽象方法 download_video，
实例化抛 TypeError，且 NoteErrorEnum 缺 DOWNLOADER_ERROR 成员，
except 分支再抛 AttributeError 掩盖真实错误。
"""
import pytest

from app.downloaders.local_audio_downloader import LocalAudioDownloader
from app.enmus.exception import NoteErrorEnum


def test_local_audio_downloader_instantiable():
    """LocalAudioDownloader 必须能正常实例化（补齐抽象方法后）"""
    downloader = LocalAudioDownloader()
    assert isinstance(downloader, LocalAudioDownloader)


def test_download_video_returns_none_for_audio():
    """本地音频无视频文件，download_video 应返回 None（调用方有 None 判断）"""
    downloader = LocalAudioDownloader()
    assert downloader.download_video("/uploads/example.wav", "/tmp/output") is None


def test_note_error_enum_has_downloader_error():
    """NoteErrorEnum 必须含 DOWNLOADER_ERROR 成员（_get_downloader except 分支依赖）"""
    member = NoteErrorEnum.DOWNLOADER_ERROR
    assert member.code == 300103
    assert member.message
