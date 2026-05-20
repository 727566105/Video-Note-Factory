"""
路径管理工具模块
统一管理项目中所有数据存储路径，确保路径一致性
"""
import os
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# 项目根目录（backend 的父目录）
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent.resolve()

# 从环境变量读取配置，默认值相对于项目根目录
DATA_DIR = PROJECT_ROOT / os.getenv("DATA_DIR", "data")
NOTE_OUTPUT_DIR = PROJECT_ROOT / os.getenv("NOTE_OUTPUT_DIR", "data/notes")
MEDIA_DIR = PROJECT_ROOT / os.getenv("MEDIA_DIR", "data/media")
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
    获取笔记相关文件的完整路径
    
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


def get_media_file_path(task_id: str, media_type: str, extension: str) -> Path:
    """
    获取媒体文件（音频/视频）的存储路径
    
    :param task_id: 任务 ID
    :param media_type: 媒体类型 (audio, video)
    :param extension: 文件扩展名（不含点）
    :return: 媒体文件路径
    """
    media_folder = MEDIA_DIR / media_type
    media_folder.mkdir(parents=True, exist_ok=True)
    return media_folder / f"{task_id}.{extension}"


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
        MEDIA_DIR,
        MEDIA_DIR / "audio",
        MEDIA_DIR / "video",
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
    print(f"媒体目录: {MEDIA_DIR}")
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
