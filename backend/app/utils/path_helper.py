"""
路径管理工具模块
统一管理项目中所有数据存储路径，确保路径一致性
"""
import json
import os
import re
import shutil
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# 项目根目录（backend 的父目录）
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()

# 从环境变量读取配置，默认值相对于项目根目录
DATA_DIR = PROJECT_ROOT / os.getenv("DATA_DIR", "data")
NOTE_OUTPUT_DIR = PROJECT_ROOT / os.getenv("NOTE_OUTPUT_DIR", "data/notes")
CACHE_DIR = PROJECT_ROOT / os.getenv("CACHE_DIR", "data/cache")
EXPORT_DIR = PROJECT_ROOT / os.getenv("EXPORT_DIR", "data/exports")

# 静态文件目录（保持在 backend 下，因为需要被 FastAPI 服务）
IMAGE_OUTPUT_DIR = PROJECT_ROOT / "backend" / os.getenv("OUT_DIR", "static/screenshots")
IMAGE_BASE_URL = os.getenv("IMAGE_BASE_URL", "/static/screenshots")


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


def sanitize_path_name(name: str, max_length: int = 80) -> str:
    """严格过滤文件/目录名，用于三级层级目录命名"""
    if not name:
        return "untitled"
    name = re.sub(r'[\x00-\x1f]', '', name)
    name = re.sub(r'[\\/:*?"<>|]', '_', name)
    name = name.replace(' ', '_')
    name = re.sub(r'_+', '_', name)
    name = name.strip('_')
    if not name:
        return "untitled"
    if len(name) > max_length:
        name = name[:max_length].rstrip('_') + '...'
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
    """获取博主级目录: data/{author_folder_name}/"""
    folder_name = get_author_folder_name(author_id, author_name, platform)
    author_dir = DATA_DIR / folder_name
    author_dir.mkdir(parents=True, exist_ok=True)
    return author_dir


def get_video_folder(author_id: str, author_name: str, video_id: str, title: str,
                     platform: str = "") -> Path:
    """获取视频级目录: data/{author_folder_name}/{video_folder_name}/"""
    author_dir = get_author_folder(author_id, author_name, platform)
    video_dir_name = get_video_folder_name(video_id, title)
    video_dir = author_dir / video_dir_name
    video_dir.mkdir(parents=True, exist_ok=True)
    return video_dir


def get_video_file_path(author_id: str, author_name: str, video_id: str, title: str,
                        file_type: str, platform: str = "") -> Path:
    """在三级目录结构下获取指定类型文件路径"""
    video_dir = get_video_folder(author_id, author_name, video_id, title, platform)
    file_map = {
        "note": "note.json",
        "audio_cache": "audio.json",
        "transcript": "transcript.json",
        "markdown": "note.md",
        "status": "status.json",
        "queue": "queue.json",
        "metadata": "metadata.json",
    }
    filename = file_map.get(file_type, f"{file_type}.json")
    return video_dir / filename


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
    note_folder.mkdir(parents=True, exist_ok=True)
    return note_folder


def get_note_file_path(task_id: str, title: str = None, file_type: str = "note") -> Path:
    """
    获取笔记相关文件的完整路径（旧版，保持兼容）

    :param task_id: 任务 ID
    :param title: 笔记标题（可选）
    :param file_type: 文件类型 (note, audio, transcript, markdown, status, export)
    :return: 文件完整路径
    """
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
    platform: str = ""
) -> Path:
    """
    获取笔记文件路径（新版三级路径）

    - 有 author_id 时：三级路径 data/{author_id}_{author_name}/{video_id}_{title}/
    - 无 author_id 时：回退到旧版 data/notes/{task_id}/

    :param task_id: 任务 ID（用于无 author_id 时的回退路径）
    :param author_id: 博主唯一 ID
    :param author_name: 博主名称
    :param video_id: 视频 ID（BV号/抖音ID等）
    :param title: 笔记标题
    :param file_type: 文件类型
    :param platform: 平台标识
    :return: 文件完整路径
    """
    if author_id:
        # 三级路径
        return get_video_file_path(author_id, author_name, video_id, title, file_type, platform)
    else:
        # 回退旧版
        return get_note_file_path(task_id, title, file_type)


def find_note_file(
    task_id: str,
    author_id: str | None,
    author_name: str | None,
    video_id: str | None,
    title: str | None,
    file_type: str,
    platform: str = ""
) -> Path | None:
    """
    兼容查找笔记文件（按优先级在多种路径中查找）

    查找优先级：
    1. 三级路径 data/{author_id}_{author_name}/{video_id}_{title}/{file_type}.json
    2. 扁平路径 data/notes/{task_id}/{file_type}.json
    3. 扁平路径带标题 data/notes/{task_id[:8]}_{title}/{file_type}.json

    :param task_id: 任务 ID
    :param author_id: 博主唯一 ID
    :param author_name: 博主名称
    :param video_id: 视频 ID
    :param title: 笔记标题
    :param file_type: 文件类型
    :param platform: 平台标识
    :return: 找到的文件路径，或 None
    """
    file_map = {
        "note": "note.json",
        "audio": "audio.json",
        "transcript": "transcript.json",
        "markdown": "note.md",
        "status": "status.json",
        "queue": "queue.json",
        "metadata": "metadata.json",
    }
    filename = file_map.get(file_type, f"{file_type}.json")

    # 1. 三级路径（优先）
    if author_id:
        video_folder = get_video_folder(author_id, author_name, video_id, title, platform)
        path = video_folder / filename
        if path.exists():
            return path

    # 2. 扁平路径（纯 task_id）
    path = NOTE_OUTPUT_DIR / task_id / filename
    if path.exists():
        return path

    # 3. 扁平路径（带标题）
    if title:
        folder_name = f"{task_id[:8]}_{sanitize_folder_name(title)}"
        path = NOTE_OUTPUT_DIR / folder_name / filename
        if path.exists():
            return path

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

    # 迁移文件
    file_types = ["audio.json", "transcript.json", "note.md", "status.json", "note.json", "metadata.json"]

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

    return target_folder


def get_export_file_path(task_id: str, title: str, export_format: str) -> Path:
    """
    获取导出文件的路径
    
    :param task_id: 任务 ID
    :param title: 笔记标题
    :param export_format: 导出格式 (pdf, html, docx, png)
    :return: 导出文件路径
    """
    folder = get_note_folder(task_id, title)
    exports_folder = folder / "exports"
    exports_folder.mkdir(parents=True, exist_ok=True)
    
    safe_title = sanitize_folder_name(title)
    return exports_folder / f"{safe_title}.{export_format}"


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
        NOTE_OUTPUT_DIR,
        CACHE_DIR,
        EXPORT_DIR,
    ]

    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)


# 初始化时创建必要的目录
ensure_directories()


if __name__ == "__main__":
    # 测试代码
    print(f"项目根目录: {PROJECT_ROOT}")
    print(f"数据目录: {DATA_DIR}")
    print(f"笔记目录: {NOTE_OUTPUT_DIR}")
    print(f"缓存目录: {CACHE_DIR}")
    print(f"导出目录: {EXPORT_DIR}")
    
    # 测试路径生成
    test_task_id = "test-123-456"
    test_title = "这是一个测试标题：包含特殊字符<>?*"
    
    print(f"\n测试标题: {test_title}")
    print(f"安全文件夹名: {sanitize_folder_name(test_title)}")
    print(f"笔记文件夹: {get_note_folder(test_task_id, test_title)}")
    print(f"笔记文件: {get_note_file_path(test_task_id, test_title, 'note')}")
    print(f"导出文件: {get_export_file_path(test_task_id, test_title, 'pdf')}")
