import shutil
from pathlib import Path

from dotenv import load_dotenv
import subprocess
import os
import uuid
from PIL import Image, ImageStat
load_dotenv()
api_path = os.getenv("API_BASE_URL", "http://localhost")
BACKEND_PORT= os.getenv("BACKEND_PORT", 8483)

BACKEND_BASE_URL = f"{api_path}:{BACKEND_PORT}"

from typing import Optional


def is_blank_image(image_path: Path, stddev_threshold: float = 3.0) -> bool:
    """Return true when a generated frame is effectively a solid-color blank."""
    try:
        with Image.open(image_path) as image:
            stat = ImageStat.Stat(image.convert("RGB").resize((32, 18)))
            return max(stat.stddev) < stddev_threshold
    except Exception:
        return False


def generate_screenshot(video_path: str, output_dir: str, timestamp: int, index: int) -> str:
    """
    使用 ffmpeg 生成截图，返回生成图片路径
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    filename = f"screenshot_{index:03}_{uuid.uuid4()}.jpg"
    output_path = output_dir / filename

    candidate_timestamps = [max(0, timestamp)]
    if timestamp <= 1:
        candidate_timestamps.extend([2, 3, 5, 8])
    else:
        candidate_timestamps.extend([timestamp + 1, timestamp + 2])

    last_error = ""
    for candidate in dict.fromkeys(candidate_timestamps):
        command = [
            "ffmpeg",
            "-ss", str(candidate),
            "-i", str(video_path),
            "-frames:v", "1",
            "-q:v", "2",
            str(output_path),
            "-y"
        ]

        result = subprocess.run(command, capture_output=True, text=True)
        if result.returncode != 0 or not output_path.exists():
            last_error = result.stderr or "文件未创建"
            continue
        if not is_blank_image(output_path):
            return str(output_path)

    if not output_path.exists():
        raise RuntimeError(f"截图生成失败 (timestamp={timestamp}): {last_error or '文件未创建'}")

    return str(output_path)



def save_cover_to_static(local_cover_path: str, subfolder: Optional[str] = "cover") -> str:
    """
    将封面图片保存到 static 目录下，并返回前端可访问的路径
    :param local_cover_path: 本地原封面路径（比如提取出来的jpg）
    :param subfolder: 子目录，默认是 cover，可以自定义
    :return: 前端访问路径，例如 /static/cover/xxx.jpg
    """
    # 项目根目录
    project_root = os.getcwd()

    # static目录
    static_dir = os.path.join(project_root, "static")

    # 确定目标子目录
    target_dir = os.path.join(static_dir, subfolder or "cover")
    os.makedirs(target_dir, exist_ok=True)

    # 拷贝文件
    file_name = os.path.basename(local_cover_path)
    target_path = os.path.join(target_dir, file_name)
    shutil.copy2(local_cover_path, target_path)  # 保留原时间戳、权限
    image_relative_path = f"/static/{subfolder}/{file_name}".replace("\\", "/")
    url_path = f"{BACKEND_BASE_URL.rstrip('/')}/{image_relative_path.lstrip('/')}"
    # 返回前端可访问的路径
    return url_path


def save_cover_to_video_dir(local_cover_path: str, video_dir: str, platform: str, author_id: str, video_id: str) -> str:
    """
    将封面图片保存到视频目录下，并返回前端可访问的 API 路径
    :param local_cover_path: 本地原封面路径（如提取或下载的 jpg）
    :param video_dir: 视频目录路径
    :param platform: 平台名
    :param author_id: 博主 ID
    :param video_id: 视频 ID
    :return: 前端可访问的 API 路径
    """
    target_path = os.path.join(video_dir, "cover.jpg")
    shutil.copy2(local_cover_path, target_path)
    return f"/api/video_cover/{platform}/{author_id}/{video_id}"
