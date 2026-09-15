from pathlib import Path


def resolve_uploaded_file_path(upload_url: str, upload_dir: str | Path = "uploads") -> Path:
    """将 /uploads/xxx 解析为真实路径，并确保不能逃逸上传目录。"""
    if not upload_url or not upload_url.startswith("/uploads/"):
        raise ValueError("本地文件只能使用上传接口返回的 /uploads/ 路径")

    relative_name = upload_url.removeprefix("/uploads/")
    if not relative_name or "/" in relative_name or "\\" in relative_name or relative_name in {".", ".."}:
        raise ValueError("上传文件路径非法")

    upload_root = Path(upload_dir).resolve()
    candidate = (upload_root / relative_name).resolve()

    if not candidate.is_relative_to(upload_root):
        raise ValueError("上传文件路径超出允许目录")
    if not candidate.exists():
        raise FileNotFoundError(f"上传文件不存在: {upload_url}")
    if not candidate.is_file():
        raise ValueError("上传路径不是文件")

    return candidate
