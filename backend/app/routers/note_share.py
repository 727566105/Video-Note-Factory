"""笔记分享 API 路由

独立于 WebDAV 整机备份，提供笔记级导出/导入。
- 导出：当前用户可导出自己的笔记（get_current_user）
- 导入：仅管理员可导入分享包（require_admin，因为会写 DB）
"""
import os
import re
import shutil
from pathlib import Path

from fastapi import APIRouter, UploadFile, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional

from app.services.note_share import (
    export_notes, export_all_notes, preview_import, import_notes,
    SHARE_DIR,
)
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger
from app.auth.dependencies import get_current_user, get_current_user_flexible, require_admin

logger = get_logger(__name__)

router = APIRouter()


def _sanitize_filename(name: str) -> str | None:
    """净化文件名：basename + 白名单 + .vnpkg 后缀"""
    basename = os.path.basename(name)
    if not basename or basename in (".", ".."):
        return None
    if ".." in basename:
        return None
    if not re.match(r'^[A-Za-z0-9_.\-]+$', basename):
        return None
    if not (basename.endswith('.vnpkg') or basename.endswith('.zip')):
        return None
    return basename


# ==================== 请求模型 ====================

class ExportRequest(BaseModel):
    task_ids: list[str]


class ImportRequest(BaseModel):
    filename: str
    decisions: dict[str, str] = {}  # {task_id: "skip"|"overwrite"|"new_copy"}


# ==================== 导出 ====================

@router.post("/export")
def export_selected_notes(data: ExportRequest, current_user=Depends(get_current_user)) -> dict:
    """导出指定笔记为分享包"""
    try:
        if not data.task_ids:
            return R.error(msg="请选择至少一条笔记")
        username = getattr(current_user, "username", "")
        pkg_path = export_notes(data.task_ids, current_user.id, username)
        return R.success(
            data={"filename": pkg_path.name, "size": pkg_path.stat().st_size},
            msg=f"已导出 {len(data.task_ids)} 条笔记",
        )
    except Exception as e:
        logger.error(f"导出笔记失败: {e}")
        return R.error(msg="导出失败")


@router.post("/export-all")
def export_all_user_notes(current_user=Depends(get_current_user)) -> dict:
    """一键导出当前用户全部笔记"""
    try:
        username = getattr(current_user, "username", "")
        pkg_path = export_all_notes(current_user.id, username)
        return R.success(
            data={"filename": pkg_path.name, "size": pkg_path.stat().st_size},
            msg="已导出全部笔记",
        )
    except Exception as e:
        logger.error(f"导出全部笔记失败: {e}")
        return R.error(msg="导出失败")


@router.get("/exports")
def list_exports(current_user=Depends(get_current_user)) -> dict:
    """列出已导出的分享包"""
    try:
        SHARE_DIR.mkdir(parents=True, exist_ok=True)
        packages = []
        for f in sorted(SHARE_DIR.glob("*.vnpkg"), key=lambda x: x.name, reverse=True):
            packages.append({"name": f.name, "size": f.stat().st_size})
        return R.success(data={"packages": packages, "total": len(packages)})
    except Exception as e:
        logger.error(f"列出分享包失败: {e}")
        return R.error(msg="获取列表失败")


@router.get("/download/{filename}")
def download_package(filename: str, current_user=Depends(get_current_user_flexible)):
    """下载分享包（流式）"""
    safe_name = _sanitize_filename(filename)
    if not safe_name:
        return R.error(msg="非法文件名")
    try:
        target = (SHARE_DIR / safe_name).resolve()
        share_dir = SHARE_DIR.resolve()
        if not target.is_relative_to(share_dir):
            return R.error(msg="非法文件名")
    except Exception:
        return R.error(msg="非法文件名")
    if not target.exists() or not target.is_file():
        return R.error(msg="文件不存在")
    return FileResponse(str(target), filename=safe_name, media_type="application/zip")


@router.delete("/exports/{filename}")
def delete_package(filename: str, current_user=Depends(get_current_user)) -> dict:
    """删除分享包"""
    safe_name = _sanitize_filename(filename)
    if not safe_name:
        return R.error(msg="非法文件名")
    try:
        target = (SHARE_DIR / safe_name).resolve()
        share_dir = SHARE_DIR.resolve()
        if not target.is_relative_to(share_dir):
            return R.error(msg="非法文件名")
        if not target.exists():
            return R.error(msg="文件不存在")
        target.unlink()
        return R.success(msg="分享包已删除")
    except Exception as e:
        logger.error(f"删除分享包失败: {e}")
        return R.error(msg="删除失败")


# ==================== 导入 ====================

@router.post("/import/preview")
async def import_preview(file: UploadFile = UploadFile(...), current_user=Depends(require_admin)) -> dict:
    """上传分享包并预览内容 + 冲突检测"""
    local_path = None
    try:
        # 校验文件类型
        if not (file.filename.endswith('.vnpkg') or file.filename.endswith('.zip')):
            return R.error(msg="只支持 .vnpkg 或 .zip 格式的分享包")

        # 保存到临时目录
        import tempfile
        temp_dir = Path(tempfile.mkdtemp(prefix="vnpkg_upload_"))
        safe_filename = os.path.basename(file.filename or "share.vnpkg")
        if not safe_filename or safe_filename in (".", ".."):
            safe_filename = "share.vnpkg"
        local_path = temp_dir / safe_filename

        with open(local_path, "wb") as f:
            shutil.copyfileobj(file.file, f)

        # 预览 + 冲突检测
        result = preview_import(local_path, current_user.id)

        # 保存到 SHARE_DIR 供后续 import 使用
        SHARE_DIR.mkdir(parents=True, exist_ok=True)
        dest = SHARE_DIR / f"_upload_{safe_filename}"
        shutil.move(str(local_path), str(dest))
        local_path = None

        result["filename"] = dest.name
        return R.success(data=result, msg=f"预览完成：{result['new_count']} 条新笔记，{result['conflict_count']} 条冲突")

    except Exception as e:
        logger.error(f"预览分享包失败: {e}")
        return R.error(msg="预览失败，请检查文件格式")
    finally:
        if local_path and local_path.exists():
            shutil.rmtree(local_path.parent, ignore_errors=True)


@router.post("/import")
def execute_import(data: ImportRequest, current_user=Depends(require_admin)) -> dict:
    """执行笔记导入"""
    safe_name = _sanitize_filename(data.filename)
    if not safe_name:
        return R.error(msg="非法文件名")
    try:
        pkg_path = SHARE_DIR / safe_name
        if not pkg_path.exists():
            return R.error(msg="分享包不存在，请重新上传")

        result = import_notes(pkg_path, current_user.id, data.decisions)

        # 导入完成后删除上传的临时包
        if safe_name.startswith("_upload_"):
            pkg_path.unlink()

        return R.success(data=result, msg=f"导入完成：成功 {result['success']} 条")
    except Exception as e:
        logger.error(f"导入笔记失败: {e}")
        return R.error(msg="导入失败")
