"""
路径管理工具模块
统一管理项目中所有数据存储路径，确保路径一致性

读写约定（核心，勿违反）：
- 读取场景用 find_note_file()：只查找不创建目录（兼容四级→三级→_pending→扁平多级回退）。
- 写入场景用 get_note_file_path_v2()：写入前必须 parent.mkdir(parents=True, exist_ok=True)。
- 有 author_id 走四级目录 video/{platform}/{author}/{video}/；无 author_id 走 data/video/_pending/{task_id}/，
  不再回退旧版 data/notes/（旧数据由 migrate_to_platform_structure 启动时迁移）。
"""
import json
import os
import re
import shutil
import time
import logging
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()

# 项目根目录（backend 的父目录）
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()

# 从环境变量读取配置，默认值相对于项目根目录
DATA_DIR = PROJECT_ROOT / os.getenv("DATA_DIR", "data")
NOTE_OUTPUT_DIR = PROJECT_ROOT / os.getenv("NOTE_OUTPUT_DIR", "data/notes")
EXPORT_DIR = PROJECT_ROOT / os.getenv("EXPORT_DIR", "data/exports")

def _get_platform_dir(platform: str) -> str:
    """延迟导入避免循环依赖"""
    from app.services.constant import get_platform_dir
    return get_platform_dir(platform)

VIDEO_DIR = DATA_DIR / "video"

# 静态文件目录（保持在 backend 下，因为需要被 FastAPI 服务）
IMAGE_OUTPUT_DIR = PROJECT_ROOT / "backend" / os.getenv("OUT_DIR", "static/screenshots")  # deprecated: 截图将迁移到视频目录 screenshots/
IMAGE_BASE_URL = os.getenv("IMAGE_BASE_URL", "/static/screenshots")  # deprecated: 截图将迁移到视频目录 screenshots/


def sanitize_folder_name(name: str, max_length: int = 100) -> str:
    """
    将标题转换为安全的文件夹名称
    
    :param name: 原始标题
    :param max_length: 最大长度
    :return: 安全的文件夹名称
    """
    if not name:
        return "untitled"
    
    # 移除或替换不安全的字符
    # 保留中文、英文、数字、空格、连字符、下划线
    safe_name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', name)
    
    # 替换多个空格为单个空格
    safe_name = re.sub(r'\s+', ' ', safe_name)
    
    # 去除首尾空格
    safe_name = safe_name.strip()
    
    # 如果为空，使用默认名称
    if not safe_name:
        return "untitled"
    
    # 限制长度（考虑中文字符）
    if len(safe_name) > max_length:
        safe_name = safe_name[:max_length].rstrip()
    
    return safe_name


def sanitize_path_name(name: str, max_length: int = 200) -> str:
    """严格过滤文件/目录名，用于三级层级目录命名。
    max_length 按 UTF-8 字节数计算（文件系统按字节限制单文件名 255）。
    默认 200 字节，预留 video_id/author_id 前缀 + 分隔符空间，确保
    完整目录名 {id}_{name} 总字节数 < 255。
    """
    if not name:
        return "untitled"
    name = re.sub(r'[\x00-\x1f]', '', name)
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    name = name.replace(' ', '_')
    name = re.sub(r'_+', '_', name)
    name = name.strip('_')
    if not name:
        return "untitled"
    encoded = name.encode('utf-8')
    if len(encoded) > max_length:
        # 按字节安全截断：留 3 字节给 "..."，回退到能成功 decode 的最长前缀
        limit = max_length - 3
        cut_bytes = encoded[:limit]
        # 逐步回退尾部字节，直到落在完整 UTF-8 字符边界（能成功 decode）
        while cut_bytes:
            try:
                cut_bytes.decode('utf-8')
                break
            except UnicodeDecodeError:
                cut_bytes = cut_bytes[:-1]
        name = cut_bytes.decode('utf-8').rstrip('_') + '...'
    return name


def get_author_folder_name(author_id: str, author_name: str, platform: str = "") -> str:
    """生成博主目录名: {author_id}_{author_name}"""
    if not author_id and not author_name:
        return "local"
    if not author_id:
        return f"unknown_{platform}" if platform else "unknown"
    if not author_name:
        return sanitize_path_name(str(author_id))
    return f"{sanitize_path_name(str(author_id))}_{sanitize_path_name(author_name)}"


def get_video_folder_name(video_id: str, title: str) -> str:
    """生成视频目录名: {video_id}_{title}"""
    if not video_id:
        return sanitize_path_name(title or "untitled")
    if not title:
        return sanitize_path_name(str(video_id))
    return f"{sanitize_path_name(str(video_id))}_{sanitize_path_name(title)}"


def get_author_folder(author_id: str, author_name: str, platform: str = "") -> Path:
    """获取博主级目录: data/video/{platform}/{author_folder_name}/"""
    platform_dir = _get_platform_dir(platform)
    plat_path = VIDEO_DIR / platform_dir

    # 自愈合：查找同平台下已有的 author_id 开头的目录
    if author_id and plat_path.exists():
        author_id_prefix = sanitize_path_name(str(author_id)) + "_"
        try:
            for existing in plat_path.iterdir():
                if not existing.is_dir():
                    continue
                if existing.name == sanitize_path_name(str(author_id)):
                    # 找到纯 author_id 目录，检查是否需要补充名称
                    if author_name:
                        renamed = plat_path / get_author_folder_name(author_id, author_name, platform)
                        if not renamed.exists():
                            existing.rename(renamed)
                            return renamed
                    return existing
                if existing.name.startswith(author_id_prefix):
                    return existing
        except Exception:
            pass

    folder_name = get_author_folder_name(author_id, author_name, platform)
    author_dir = VIDEO_DIR / platform_dir / folder_name
    author_dir.mkdir(parents=True, exist_ok=True)
    return author_dir


def get_video_folder(author_id: str, author_name: str, video_id: str, title: str,
                     platform: str = "") -> Path:
    """获取视频级目录: data/{author_folder_name}/{video_folder_name}/"""
    author_dir = get_author_folder(author_id, author_name, platform)
    video_dir_name = get_video_folder_name(video_id, title)
    video_dir = author_dir / video_dir_name

    # 自愈合：解压落地与运行时计算的截断点可能不同（整段截断 vs title 单独截断），
    # 按 video_id_ 前缀复用已存在的目录，避免新建空目录导致媒体/笔记打不开
    if video_id and not video_dir.exists() and author_dir.exists():
        vid_prefix = sanitize_path_name(str(video_id)) + "_"
        try:
            for existing in author_dir.iterdir():
                if not existing.is_dir():
                    continue
                if existing.name.startswith(vid_prefix):
                    return existing
        except Exception:
            pass

    video_dir.mkdir(parents=True, exist_ok=True)
    return video_dir


def _note_filename(user_id: int | None = None) -> str:
    """生成笔记文件名：有 user_id 时用 note_{user_id}.json，否则用 note.json（兼容）"""
    if user_id is not None:
        return f"note_{user_id}.json"
    return "note.json"


def get_video_file_path(author_id: str, author_name: str, video_id: str, title: str,
                        file_type: str, platform: str = "", user_id: int | None = None) -> Path:
    """在三级目录结构下获取指定类型文件路径

    :param user_id: 用户 ID，note 类型文件使用 note_{user_id}.json
    """
    video_dir = get_video_folder(author_id, author_name, video_id, title, platform)
    if file_type == "note":
        return video_dir / _note_filename(user_id)
    file_map = {
        "audio_cache": "audio.json",
        "transcript": "transcript.json",
        "markdown": "note.md",
        "status": "status.json",
        "queue": "queue.json",
        "metadata": "metadata.json",
    }
    filename = file_map.get(file_type, f"{file_type}.json")
    return video_dir / filename


def get_screenshot_dir(author_id: str, author_name: str, video_id: str, title: str,
                       platform: str = "") -> Path:
    """获取视频目录下的 screenshots/ 子目录"""
    video_dir = get_video_folder(author_id, author_name, video_id, title, platform)
    ss_dir = video_dir / "screenshots"
    ss_dir.mkdir(parents=True, exist_ok=True)
    return ss_dir


def get_screenshot_url_base(author_id: str, video_id: str, platform: str = "") -> str:
    """获取截图的 API URL 前缀"""
    platform_dir = _get_platform_dir(platform)
    return f"/api/video_screenshots/{platform_dir}/{author_id}/{video_id}"


def get_media_in_video_folder(author_id: str, author_name: str, video_id: str, title: str,
                               media_type: str, extension: str, platform: str = "") -> Path:
    """获取视频目录下的媒体文件路径（音频/视频）"""
    video_dir = get_video_folder(author_id, author_name, video_id, title, platform)
    return video_dir / f"{sanitize_path_name(video_id or 'media')}.{extension}"


def get_export_in_video_folder(author_id: str, author_name: str, video_id: str, title: str,
                                export_format: str, platform: str = "") -> Path:
    """获取视频目录下 exports/ 子目录的导出文件路径"""
    video_dir = get_video_folder(author_id, author_name, video_id, title, platform)
    exports_dir = video_dir / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    safe_title = sanitize_path_name(title or "untitled")
    return exports_dir / f"{safe_title}.{export_format}"


def get_export_cache_path(
    author_id: str, author_name: str, video_id: str, title: str,
    task_id: str, style: str, export_format: str = "pdf",
    platform: str = ""
) -> Path:
    """获取四级目录下 exports/ 子目录的缓存文件路径

    格式: data/video/{platform}/{author}/{video}/exports/{task_id}_{style}.{format}
    """
    video_dir = get_video_folder(author_id, author_name, video_id, title, platform)
    exports_dir = video_dir / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    return exports_dir / f"{task_id}_{style}.{export_format}"


def get_export_history_path(
    author_id: str, author_name: str, video_id: str, title: str,
    platform: str = ""
) -> Path:
    """获取四级目录下 exports/ 子目录的导出历史文件路径

    格式: data/video/{platform}/{author}/{video}/exports/export_history.json
    """
    video_dir = get_video_folder(author_id, author_name, video_id, title, platform)
    exports_dir = video_dir / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)
    return exports_dir / "export_history.json"


def get_note_folder(task_id: str, title: str = None) -> Path:
    """
    获取笔记存储文件夹路径
    
    :param task_id: 任务 ID
    :param title: 笔记标题（可选）
    :return: 笔记文件夹路径
    """
    if title:
        # 使用标题作为文件夹名，但添加 task_id 前缀避免重名
        folder_name = f"{task_id[:8]}_{sanitize_folder_name(title)}"
    else:
        # 如果没有标题，使用 task_id
        folder_name = task_id
    
    note_folder = NOTE_OUTPUT_DIR / folder_name
    # 不立即创建目录，让文件写入时按需创建
    return note_folder


def get_note_file_path(task_id: str, title: str = None, file_type: str = "note") -> Path:
    """
    获取笔记相关文件的完整路径（已废弃，仅用于迁移脚本）

    .. deprecated::
        请使用 get_note_file_path_v2 或 VIDEO_DIR/_pending，新任务禁止使用此函数。

    :param task_id: 任务 ID
    :param title: 笔记标题（可选）
    :param file_type: 文件类型 (note, audio, transcript, markdown, status, export)
    :return: 文件完整路径
    """
    import warnings
    warnings.warn(
        "get_note_file_path 已废弃，请使用 get_note_file_path_v2 或 VIDEO_DIR/_pending",
        DeprecationWarning,
        stacklevel=2
    )
    folder = get_note_folder(task_id, title)

    file_map = {
        "note": "note.json",
        "audio": "audio.json",
        "transcript": "transcript.json",
        "markdown": "note.md",
        "status": "status.json",
        "queue": "queue.json",
    }

    filename = file_map.get(file_type, f"{file_type}.json")
    return folder / filename


def get_note_file_path_v2(
    task_id: str,
    author_id: str | None,
    author_name: str | None,
    video_id: str | None,
    title: str | None,
    file_type: str,
    platform: str = "",
    user_id: int | None = None
) -> Path:
    """
    获取笔记文件路径（四级目录结构）

    - 有 author_id 时：四级路径 data/video/{platform}/{author_id}_{author_name}/{video_id}_{title}/
    - 无 author_id 时：临时路径 data/video/_pending/{task_id}/
    - note 类型文件：note_{user_id}.json（多用户隔离）

    :param user_id: 用户 ID，note 类型文件使用 note_{user_id}.json
    """
    if author_id:
        return get_video_file_path(author_id, author_name, video_id, title, file_type, platform, user_id)
    else:
        # 无 author_id 时使用 _pending 临时目录，不回退旧版 data/notes
        pending_dir = VIDEO_DIR / "_pending" / task_id
        if file_type == "note":
            return pending_dir / _note_filename(user_id)
        file_map = {
            "audio_cache": "audio.json",
            "transcript": "transcript.json",
            "markdown": "note.md",
            "status": "status.json",
            "queue": "queue.json",
            "metadata": "metadata.json",
        }
        filename = file_map.get(file_type, f"{file_type}.json")
        return pending_dir / filename


def find_note_file(
    task_id: str,
    author_id: str | None,
    author_name: str | None,
    video_id: str | None,
    title: str | None,
    file_type: str,
    platform: str = "",
    user_id: int | None = None
) -> Path | None:
    """
    查找笔记文件（按优先级在多种路径中查找）

    查找优先级：
    1. 四级路径 data/video/{platform}/{author_id}_{author_name}/{video_id}_{title}/
       - note 类型：优先找 note_{user_id}.json，其次 note.json（兼容）
    2. 三级路径 data/{author_id}_{author_name}/{video_id}_{title}/
    3. 临时路径 data/video/_pending/{task_id}/
    4. 旧版路径 data/notes/{task_id}/{file_type}.json（兼容已有数据）

    :param user_id: 用户 ID，note 类型文件优先查找 note_{user_id}.json
    """
    file_map = {
        "note": _note_filename(user_id),
        "audio": "audio.json",
        "transcript": "transcript.json",
        "markdown": "note.md",
        "status": "status.json",
        "queue": "queue.json",
        "metadata": "metadata.json",
    }
    filename = file_map.get(file_type, f"{file_type}.json")

    if author_id:
        author_folder = get_author_folder_name(author_id, author_name, platform)
        video_folder = get_video_folder_name(video_id, title)

        # 1. 四级路径
        platform_dir_name = _get_platform_dir(platform)
        four_level_base = VIDEO_DIR / platform_dir_name / author_folder / video_folder
        four_level_path = four_level_base / filename
        if four_level_path.exists():
            return four_level_path

        # 1.1 note 类型：找不到 note_{user_id}.json 时，找 note.json（兼容）
        if file_type == "note" and user_id is not None:
            legacy_note_path = four_level_base / "note.json"
            if legacy_note_path.exists():
                return legacy_note_path

        # 1.2 自愈合：精确目录不存在时，按前缀扫描已有目录
        # 两层自愈合：
        #   a) author 目录名不一致（author_name 变更/截断差异）-> 按 author_id_ 前缀扫描
        #   b) video 目录名不一致（title 截断点差异）-> 按 video_id_ 前缀扫描
        if video_id or author_id:
            vid_prefix = sanitize_path_name(str(video_id)) + "_" if video_id else ""
            author_id_prefix = sanitize_path_name(str(author_id)) + "_" if author_id else ""
            exact_author_dir = VIDEO_DIR / platform_dir_name / author_folder

            # 收集候选 author 目录：精确目录 + 同前缀目录
            candidate_author_dirs = []
            if exact_author_dir.exists():
                candidate_author_dirs.append(exact_author_dir)
            if author_id_prefix:
                plat_base = VIDEO_DIR / platform_dir_name
                if plat_base.exists():
                    try:
                        for existing in plat_base.iterdir():
                            if (existing.is_dir()
                                    and existing.name.startswith(author_id_prefix)
                                    and existing not in candidate_author_dirs):
                                candidate_author_dirs.append(existing)
                    except Exception:
                        pass

            for author_dir in candidate_author_dirs:
                try:
                    for existing in author_dir.iterdir():
                        if not existing.is_dir():
                            continue
                        # 有 video_id 时按前缀匹配，无 video_id 时匹配所有子目录
                        if vid_prefix and not existing.name.startswith(vid_prefix):
                            continue
                        candidate = existing / filename
                        if candidate.exists():
                            return candidate
                        if file_type == "note" and user_id is not None:
                            legacy_candidate = existing / "note.json"
                            if legacy_candidate.exists():
                                return legacy_candidate
                except Exception:
                    pass

        # 2. 三级路径（向后兼容）
        three_level_path = DATA_DIR / author_folder / video_folder / filename
        if three_level_path.exists():
            return three_level_path

        # 2.1 note 类型：三级路径同样兼容 note.json
        if file_type == "note" and user_id is not None:
            legacy_three_path = DATA_DIR / author_folder / video_folder / "note.json"
            if legacy_three_path.exists():
                return legacy_three_path

    # 3. 临时路径（无 author_id 时的新写入位置）
    pending_path = VIDEO_DIR / "_pending" / task_id / filename
    if pending_path.exists():
        return pending_path

    # 3.1 临时路径的 note.json 兼容
    if file_type == "note" and user_id is not None:
        legacy_pending = VIDEO_DIR / "_pending" / task_id / "note.json"
        if legacy_pending.exists():
            return legacy_pending

    # 4. 旧版路径（兼容已有数据，仅读取）
    path = NOTE_OUTPUT_DIR / task_id / filename
    if path.exists():
        return path

    # 4.1 旧版路径的 note.json 兼容
    if file_type == "note" and user_id is not None:
        legacy_path = NOTE_OUTPUT_DIR / task_id / "note.json"
        if legacy_path.exists():
            return legacy_path

    # 5. 旧版路径带标题（兼容已有数据，仅读取）
    if title:
        folder_name = f"{task_id[:8]}_{sanitize_folder_name(title)}"
        path = NOTE_OUTPUT_DIR / folder_name / filename
        if path.exists():
            return path

        # 5.1 带标题路径的 note.json 兼容
        if file_type == "note" and user_id is not None:
            legacy_path = NOTE_OUTPUT_DIR / folder_name / "note.json"
            if legacy_path.exists():
                return legacy_path

    # 6. 降级：author_id 为空时，按 video_id 在四级目录中搜索
    if not author_id and video_id and platform:
        platform_dir_name = _get_platform_dir(platform)
        plat_dir = VIDEO_DIR / platform_dir_name
        if plat_dir.exists():
            for author_dir in plat_dir.iterdir():
                if not author_dir.is_dir() or author_dir.name.startswith("_"):
                    continue
                for video_dir in author_dir.iterdir():
                    if video_dir.is_dir() and video_dir.name.startswith(str(video_id)):
                        candidate = video_dir / filename
                        if candidate.exists():
                            return candidate
                        # note 类型兼容
                        if file_type == "note" and user_id is not None:
                            legacy_candidate = video_dir / "note.json"
                            if legacy_candidate.exists():
                                return legacy_candidate

    return None


def move_note_files_to_video_folder(
    task_id: str,
    author_id: str,
    author_name: str,
    video_id: str,
    title: str,
    platform: str = ""
) -> Path:
    """
    将临时目录下的笔记文件迁移到三级目录，同时迁移关联的媒体文件

    :param task_id: 任务 ID
    :param author_id: 博主唯一 ID
    :param author_name: 博主名称
    :param video_id: 视频 ID
    :param title: 笔记标题
    :param platform: 平台标识
    :return: 目标视频目录路径
    """
    # 目标目录
    target_folder = get_video_folder(author_id, author_name, video_id, title, platform)

    # 临时目录
    temp_folder = NOTE_OUTPUT_DIR / task_id
    temp_folder_with_title = NOTE_OUTPUT_DIR / f"{task_id[:8]}_{sanitize_folder_name(title)}" if title else None
    pending_folder = VIDEO_DIR / "_pending" / task_id

    # 迁移文件（含封面 cover.jpg）
    file_types = ["audio.json", "transcript.json", "note.md", "status.json", "note.json", "metadata.json", "cover.jpg"]

    for filename in file_types:
        # 从纯 task_id 目录迁移
        src = temp_folder / filename
        if src.exists():
            dst = target_folder / filename
            if not dst.exists():
                shutil.move(str(src), str(dst))

        # 从带标题目录迁移
        if temp_folder_with_title:
            src = temp_folder_with_title / filename
            if src.exists():
                dst = target_folder / filename
                if not dst.exists():
                    shutil.move(str(src), str(dst))

        # 从 _pending 临时目录迁移
        src = pending_folder / filename
        if src.exists():
            dst = target_folder / filename
            if not dst.exists():
                shutil.move(str(src), str(dst))

    # 迁移图文笔记的图片文件（image_1.jpg, image_2.jpg, ...）
    for source_folder in [temp_folder, temp_folder_with_title, pending_folder]:
        if source_folder and source_folder.exists():
            for img_file in source_folder.glob("image_*.jpg"):
                dst = target_folder / img_file.name
                if not dst.exists():
                    shutil.move(str(img_file), str(dst))

    # 迁移截图目录（screenshots/）
    for source_folder in [temp_folder, temp_folder_with_title, pending_folder]:
        if source_folder and source_folder.exists():
            src_shots = source_folder / "screenshots"
            if src_shots.exists():
                dst_shots = target_folder / "screenshots"
                if not dst_shots.exists():
                    shutil.move(str(src_shots), str(dst_shots))

    # 迁移关联的媒体文件（音频/视频）并更新 audio.json 中的路径
    audio_json_path = target_folder / "audio.json"
    if audio_json_path.exists():
        try:
            audio_data = json.loads(audio_json_path.read_text(encoding="utf-8"))
            _moved = False

            # 迁移音频文件
            old_audio_path = audio_data.get("file_path")
            if old_audio_path and os.path.exists(old_audio_path):
                new_name = f"{sanitize_path_name(video_id or 'audio')}{Path(old_audio_path).suffix}"
                new_audio_path = target_folder / new_name
                if not new_audio_path.exists():
                    shutil.move(old_audio_path, str(new_audio_path))
                    audio_data["file_path"] = str(new_audio_path)
                    _moved = True

            # 迁移视频文件（从 audio.json 的 video_path）
            old_video_path = audio_data.get("video_path")
            if old_video_path and os.path.exists(old_video_path):
                new_name = f"{sanitize_path_name(video_id or 'video')}{Path(old_video_path).suffix}"
                new_video_path = target_folder / new_name
                if not new_video_path.exists():
                    shutil.move(old_video_path, str(new_video_path))
                    audio_data["video_path"] = str(new_video_path)
                    _moved = True

            # 更新 audio.json 中的路径
            if _moved:
                audio_json_path.write_text(json.dumps(audio_data, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            pass

    # 清理空目录
    if temp_folder.exists():
        try:
            shutil.rmtree(temp_folder)
        except Exception:
            pass
    if temp_folder_with_title and temp_folder_with_title.exists():
        try:
            shutil.rmtree(temp_folder_with_title)
        except Exception:
            pass
    if pending_folder.exists():
        try:
            shutil.rmtree(pending_folder)
        except Exception:
            pass

    return target_folder


def get_data_dir() -> str:
    """
    获取数据目录路径（用于下载器）

    :return: 数据目录的字符串路径
    """
    return str(DATA_DIR)


def get_model_dir(subdir: str = None) -> str:
    """
    获取模型目录路径（用于 Whisper 等模型）

    :param subdir: 可选子目录名（如 "whisper", "mlx-whisper"）
    :return: 模型目录的字符串路径
    """
    model_dir = DATA_DIR / "models"
    if subdir:
        model_dir = model_dir / subdir
    model_dir.mkdir(parents=True, exist_ok=True)
    return str(model_dir)


def get_app_dir() -> str:
    """
    获取应用目录路径
    
    :return: 应用目录的字符串路径
    """
    return str(PROJECT_ROOT)


def ensure_directories():
    """
    确保所有必要的目录存在
    """
    directories = [
        DATA_DIR,
        VIDEO_DIR,
    ]

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)

    # 延迟创建平台子目录，避免循环导入
    try:
        from app.services.constant import PLATFORM_DIR_MAP
        for pdir in set(PLATFORM_DIR_MAP.values()):
            (VIDEO_DIR / pdir).mkdir(parents=True, exist_ok=True)
        (VIDEO_DIR / "_other").mkdir(parents=True, exist_ok=True)
    except ImportError:
        pass


# 初始化时创建必要的目录
ensure_directories()


def migrate_to_platform_structure():
    """启动时自动将旧三级目录迁移到四级目录 video/{platform}/{author}/{video}/"""
    import json as json_mod
    from app.utils.logger import get_logger
    migrate_logger = get_logger("migration")

    if not DATA_DIR.exists():
        return

    VIDEO_DIR.mkdir(parents=True, exist_ok=True)

    # 查数据库获取 author_id -> platform 映射
    try:
        from app.db.engine import get_db
        from app.db.models.video_tasks import VideoTask
        db = next(get_db())
        tasks = db.query(
            VideoTask.author_id, VideoTask.platform, VideoTask.video_id
        ).filter(VideoTask.author_id.isnot(None)).all()

        author_platform_map = {}
        video_author_map = {}
        for author_id, platform, video_id in tasks:
            if author_id:
                author_platform_map[author_id] = platform or "unknown"
                if video_id:
                    video_author_map[video_id] = author_id
        db.close()
    except Exception as e:
        migrate_logger.warning(f"迁移：无法查询数据库，跳过迁移: {e}")
        return

    # 扫描 data/ 下的博主目录（匹配 {author_id}_{author_name} 格式）
    for item in DATA_DIR.iterdir():
        if not item.is_dir():
            continue
        if item.name in ("video", "exports", "models", "local", "notes", "cache"):
            continue

        parts = item.name.split("_", 1)
        author_id = parts[0]
        platform = author_platform_map.get(author_id, "_other")
        platform_dir = _get_platform_dir(platform)

        target = VIDEO_DIR / platform_dir / item.name
        if target.exists():
            migrate_logger.info(f"迁移：跳过已存在 {target}")
            continue

        target.parent.mkdir(parents=True, exist_ok=True)

        try:
            shutil.move(str(item), str(target))
            migrate_logger.info(f"迁移：{item.name} -> video/{platform_dir}/{item.name}")
        except Exception as e:
            migrate_logger.error(f"迁移失败 {item.name}: {e}")

    # 迁移截图
    _migrate_screenshots(video_author_map, author_platform_map, migrate_logger)

    # 更新已迁移目录中 audio.json 的 file_path
    _update_audio_paths(migrate_logger)

    # 迁移封面图
    _migrate_covers(migrate_logger)

    migrate_logger.info("四级目录迁移完成")


def _migrate_screenshots(video_author_map, author_platform_map, logger):
    """将 backend/static/screenshots/ 中的截图迁移到对应视频目录"""
    old_screenshot_dir = PROJECT_ROOT / "backend" / "static" / "screenshots"
    if not old_screenshot_dir.exists():
        return

    for ss_file in old_screenshot_dir.iterdir():
        if not ss_file.is_file() or not ss_file.name.endswith(".jpg"):
            continue

        filename = ss_file.name
        found = False

        for platform_dir in VIDEO_DIR.iterdir():
            if not platform_dir.is_dir() or found:
                break
            for author_dir in platform_dir.iterdir():
                if not author_dir.is_dir() or found:
                    break
                for video_dir in author_dir.iterdir():
                    if not video_dir.is_dir() or found:
                        break
                    note_json = video_dir / "note.json"
                    if note_json.exists():
                        try:
                            with open(note_json, "r", encoding="utf-8") as f:
                                content = f.read()
                            if filename in content:
                                ss_target_dir = video_dir / "screenshots"
                                ss_target_dir.mkdir(parents=True, exist_ok=True)
                                target_path = ss_target_dir / filename
                                if not target_path.exists():
                                    shutil.move(str(ss_file), str(target_path))
                                    _update_screenshot_urls(note_json, filename, video_dir)
                                    md_file = video_dir / "note.md"
                                    if md_file.exists():
                                        _update_screenshot_urls_md(md_file, filename, video_dir)
                                    logger.info(f"截图迁移：{filename} -> {video_dir.name}/screenshots/")
                                found = True
                        except Exception:
                            pass

    if old_screenshot_dir.exists() and not any(old_screenshot_dir.iterdir()):
        old_screenshot_dir.rmdir()
        logger.info("已清理空的旧截图目录")


def _update_screenshot_urls(note_json_path, filename, video_dir):
    """更新 note.json 中的截图 URL"""
    import json as json_mod
    with open(note_json_path, "r", encoding="utf-8") as f:
        data = json_mod.load(f)

    old_url = f"/static/screenshots/{filename}"
    parts = video_dir.parts
    video_idx = parts.index("video")
    platform = parts[video_idx + 1]
    author_folder = parts[video_idx + 2]
    author_id = author_folder.split("_", 1)[0]
    video_folder = parts[video_idx + 3]
    video_id = video_folder.split("_", 1)[0]
    new_url = f"/api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}"

    _replace_url_in_dict(data, old_url, new_url)

    with open(note_json_path, "w", encoding="utf-8") as f:
        json_mod.dump(data, f, ensure_ascii=False, indent=2)


def _update_screenshot_urls_md(md_path, filename, video_dir):
    """更新 note.md 中的截图 URL"""
    parts = video_dir.parts
    video_idx = parts.index("video")
    platform = parts[video_idx + 1]
    author_folder = parts[video_idx + 2]
    author_id = author_folder.split("_", 1)[0]
    video_folder = parts[video_idx + 3]
    video_id = video_folder.split("_", 1)[0]
    old_url = f"/static/screenshots/{filename}"
    new_url = f"/api/video_screenshots/{platform}/{author_id}/{video_id}/{filename}"

    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()
    content = content.replace(old_url, new_url)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(content)


def _replace_url_in_dict(obj, old_url, new_url):
    """递归替换 dict/list 中的 URL 字符串"""
    if isinstance(obj, dict):
        for key, value in obj.items():
            if isinstance(value, str):
                obj[key] = value.replace(old_url, new_url)
            else:
                _replace_url_in_dict(value, old_url, new_url)
    elif isinstance(obj, list):
        for i, item in enumerate(obj):
            if isinstance(item, str):
                obj[i] = item.replace(old_url, new_url)
            else:
                _replace_url_in_dict(item, old_url, new_url)


def _update_audio_paths(logger):
    """更新迁移后 audio.json 中的 file_path 和 video_path"""
    import json as json_mod
    if not VIDEO_DIR.exists():
        return

    for platform_dir in VIDEO_DIR.iterdir():
        if not platform_dir.is_dir():
            continue
        for author_dir in platform_dir.iterdir():
            if not author_dir.is_dir():
                continue
            for video_dir in author_dir.iterdir():
                if not video_dir.is_dir():
                    continue
                audio_json = video_dir / "audio.json"
                if not audio_json.exists():
                    continue
                try:
                    with open(audio_json, "r", encoding="utf-8") as f:
                        data = json_mod.load(f)
                    changed = False
                    for key in ("file_path", "video_path"):
                        old_path = data.get(key, "")
                        if old_path and str(DATA_DIR) in old_path and str(VIDEO_DIR) not in old_path:
                            # 替换 data/ -> data/video/{platform}/
                            new_path = old_path.replace(
                                str(DATA_DIR) + "/",
                                str(VIDEO_DIR / platform_dir.name) + "/"
                            )
                            data[key] = new_path
                            changed = True
                    if changed:
                        with open(audio_json, "w", encoding="utf-8") as f:
                            json_mod.dump(data, f, ensure_ascii=False, indent=2)
                        logger.info(f"更新路径: {video_dir.name}/audio.json")
                except Exception as e:
                    logger.warning(f"更新 audio.json 失败 {audio_json}: {e}")


def _migrate_covers(logger):
    """将 static/covers/ 中的封面迁移到对应视频目录"""
    import hashlib
    from app.db.video_task_dao import batch_update_cover_url

    old_cover_dir = PROJECT_ROOT / "static" / "covers"
    if not old_cover_dir.exists():
        return

    # 从数据库构建 URL hash -> video 映射
    try:
        from app.db.engine import get_db
        from app.db.models.video_tasks import VideoTask
        db = next(get_db())
        tasks = db.query(VideoTask).filter(
            VideoTask.cover_url.isnot(None),
            VideoTask.video_id.isnot(None)
        ).all()

        hash_video_map = {}
        for task in tasks:
            cover_url = task.cover_url or ""
            if cover_url.startswith("/api/video_cover"):
                continue
            url_hash = hashlib.md5(cover_url.encode()).hexdigest()[:16]
            hash_video_map[url_hash] = (
                task.video_id,
                task.platform or "unknown",
                task.author_id or ""
            )
        db.close()
    except Exception as e:
        logger.warning(f"封面迁移：无法查询数据库: {e}")
        return

    # 遍历旧封面目录
    for platform_dir in old_cover_dir.iterdir():
        if not platform_dir.is_dir():
            continue
        for cover_file in platform_dir.iterdir():
            if not cover_file.is_file():
                continue
            filename = cover_file.name
            hash_part = filename.split(".")[0]

            if hash_part not in hash_video_map:
                logger.warning(f"封面迁移：未找到匹配视频 {filename}")
                continue

            video_id, platform, author_id = hash_video_map[hash_part]
            platform_subdir = _get_platform_dir(platform)

            # 在 VIDEO_DIR 中查找对应视频目录
            found = False
            plat_path = VIDEO_DIR / platform_subdir
            if plat_path.exists():
                for author_folder in plat_path.iterdir():
                    if not author_folder.is_dir() or found:
                        continue
                    if author_id and not author_folder.name.startswith(author_id):
                        continue
                    for video_folder in author_folder.iterdir():
                        if not video_folder.is_dir() or found:
                            continue
                        if not video_folder.name.startswith(video_id):
                            continue
                        target_path = video_folder / "cover.jpg"
                        if not target_path.exists():
                            shutil.move(str(cover_file), str(target_path))
                            new_cover_url = f"/api/video_cover/{platform_subdir}/{author_id}/{video_id}"
                            batch_update_cover_url(video_id, platform, new_cover_url)
                            logger.info(f"封面迁移：{filename} -> {video_folder.name}/cover.jpg")
                        found = True
                        break

    # 清理空的旧封面目录
    if old_cover_dir.exists() and not any(old_cover_dir.iterdir()):
        shutil.rmtree(old_cover_dir)
        logger.info("已清理空的旧封面目录 static/covers/")


def cleanup_stale_pending(max_age_hours: int = 2):
    """清理 _pending 目录中超过指定时间的残留任务目录。

    线程安全：会检查 task_queue 的运行状态，跳过正在活跃执行的任务
    （避免误删慢任务如长视频转写的中间产物，交给看门狗处理）。
    """
    pending_dir = VIDEO_DIR / "_pending"
    if not pending_dir.exists():
        return

    # 延迟导入避免循环依赖
    try:
        from app.services.task_queue import task_queue
    except ImportError:
        task_queue = None

    now = time.time()
    cleaned = 0
    for task_dir in pending_dir.iterdir():
        if not task_dir.is_dir():
            continue

        task_id = task_dir.name

        # 如果任务正在队列中运行且心跳活跃，跳过（交给看门狗处理卡死情况）
        if task_queue is not None:
            try:
                status = task_queue.get_status()
                if task_id in status.get("running_tasks", []):
                    # 正在运行，检查心跳是否超时
                    stale = task_queue.get_stale_tasks(
                        timeout_seconds=int(os.getenv("WATCHDOG_TASK_TIMEOUT_SECONDS", "900"))
                    )
                    if task_id not in stale:
                        logger.debug(f"跳过活跃任务 _pending 目录: {task_id}")
                        continue
            except Exception:
                pass  # 检查失败时保守处理：继续走原有清理逻辑

        # 检查时间阈值
        if (now - task_dir.stat().st_mtime) <= max_age_hours * 3600:
            # 未超时但检查 status.json：非终态且超过 30 分钟也清理
            status_file = task_dir / "status.json"
            if status_file.exists():
                try:
                    data = json.loads(status_file.read_text(encoding="utf-8"))
                    status_val = data.get("status", "")
                    if status_val in ("SUCCESS", "FAILED"):
                        # 已终态，直接清理
                        pass
                    elif (now - task_dir.stat().st_mtime) > 0.5 * 3600:
                        # 非终态超过 30 分钟，视为中断残留
                        pass
                    else:
                        continue
                except Exception:
                    continue
            else:
                continue
        shutil.rmtree(task_dir)
        logger.info(f"清理过期 _pending 目录: {task_dir.name}")
        cleaned += 1
    if cleaned:
        logger.info(f"共清理 {cleaned} 个过期 _pending 目录")
    # 如果 _pending 目录为空，也删除它
    if pending_dir.exists() and not any(pending_dir.iterdir()):
        pending_dir.rmdir()


if __name__ == "__main__":
    # 测试代码
    print(f"项目根目录: {PROJECT_ROOT}")
    print(f"数据目录: {DATA_DIR}")
    print(f"笔记目录: {NOTE_OUTPUT_DIR}")
    print(f"导出目录: {EXPORT_DIR}")

    # 测试路径生成
    test_task_id = "test-123-456"
    test_title = "这是一个测试标题：包含特殊字符<>?*"

    print(f"\n测试标题: {test_title}")
    print(f"安全文件夹名: {sanitize_folder_name(test_title)}")
    print(f"笔记文件夹: {get_note_folder(test_task_id, test_title)}")
    # 使用新版函数测试（旧函数已废弃）
    print(f"笔记文件（四级目录）: {get_note_file_path_v2(test_task_id, 'author123', '测试博主', 'vid456', test_title, 'note', 'bilibili')}")
    print(f"笔记文件（_pending）: {get_note_file_path_v2(test_task_id, None, None, None, None, 'note', '')}")
    print(f"导出文件: {get_export_file_path(test_task_id, test_title, 'pdf')}")
