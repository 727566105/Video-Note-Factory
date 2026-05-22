from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.utils.path_helper import VIDEO_DIR, _get_platform_dir

router = APIRouter(prefix="/api/video_screenshots", tags=["screenshots"])


@router.get("/{platform}/{author_id}/{video_id}/{filename}")
async def get_video_screenshot(
    platform: str, author_id: str, video_id: str, filename: str
):
    """从四级目录中读取截图文件"""
    platform_dir = _get_platform_dir(platform)

    plat_path = VIDEO_DIR / platform_dir
    if not plat_path.exists():
        raise HTTPException(status_code=404, detail="Platform directory not found")

    # 防止路径遍历攻击
    for part in (platform, author_id, video_id, filename):
        if ".." in part or "/" in part or "\\" in part:
            raise HTTPException(status_code=400, detail="Invalid parameter")

    for author_folder in plat_path.iterdir():
        if not author_folder.is_dir():
            continue
        if not author_folder.name.startswith(author_id):
            continue
        for video_folder in author_folder.iterdir():
            if not video_folder.is_dir():
                continue
            if not video_folder.name.startswith(video_id):
                continue
            screenshot_path = video_folder / "screenshots" / filename
            if screenshot_path.exists():
                return FileResponse(
                    str(screenshot_path), media_type="image/jpeg"
                )

    raise HTTPException(status_code=404, detail="Screenshot not found")


# 封面 API 路由（独立 router 避免与截图路由路径冲突）
cover_router = APIRouter(prefix="/api/video_cover", tags=["covers"])


@cover_router.get("/{platform}/{author_id}/{video_id}")
async def get_video_cover(platform: str, author_id: str, video_id: str):
    """从四级目录中读取封面文件 cover.jpg"""
    platform_dir = _get_platform_dir(platform)

    plat_path = VIDEO_DIR / platform_dir
    if not plat_path.exists():
        raise HTTPException(status_code=404, detail="Platform directory not found")

    for part in (platform, author_id, video_id):
        if ".." in part or "/" in part or "\\" in part:
            raise HTTPException(status_code=400, detail="Invalid parameter")

    for author_folder in plat_path.iterdir():
        if not author_folder.is_dir():
            continue
        if not author_folder.name.startswith(author_id):
            continue
        for video_folder in author_folder.iterdir():
            if not video_folder.is_dir():
                continue
            if not video_folder.name.startswith(video_id):
                continue
            cover_path = video_folder / "cover.jpg"
            if cover_path.exists():
                return FileResponse(
                    str(cover_path), media_type="image/jpeg"
                )

    raise HTTPException(status_code=404, detail="Cover not found")