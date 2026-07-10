"""笔记分享服务

独立于 WebDAV 整机备份，提供笔记级导出/导入能力。
支持跨用户共享：A 用户导出笔记包，B 用户导入，互不冲突。

分享包格式 .vnpkg（ZIP）：
  manifest.json          包元数据 + 笔记清单
  notes/
    {task_id}/
      meta.json          video_task 行数据
      note.json          笔记正文（导入时重写为 note_{目标uid}.json）
      transcript.json    转写文本（可选）
      audio.json         音频元数据（可选）
      cover.jpg          封面（可选）
      screenshots/       截图目录（可选）

冲突检测：按 (platform, video_id) 判断当前用户是否已有同视频笔记。
冲突解决：skip（跳过）/ overwrite（覆盖）/ new_copy（导入为新副本）。
"""
import os
import json
import uuid
import shutil
import zipfile
import tempfile
from pathlib import Path
from datetime import datetime
from typing import Any

from app.utils.logger import get_logger
from app.utils.path_helper import (
    PROJECT_ROOT, VIDEO_DIR, DATA_DIR,
    find_note_file, get_video_folder, get_video_file_path,
    sanitize_path_name,
)

logger = get_logger(__name__)

# 分享包存放目录（与整机备份共用 data/backups/）
SHARE_DIR = DATA_DIR / "backups"

# manifest 版本
MANIFEST_VERSION = "1.0"


def _ensure_share_dir():
    SHARE_DIR.mkdir(parents=True, exist_ok=True)


def _safe_extract_vnpkg(zip_path: Path, dest: Path) -> None:
    """安全解压分享包（防 zip-slip + 符号链接）"""
    import stat
    dest_resolved = dest.resolve()
    with zipfile.ZipFile(zip_path, "r") as zf:
        for member in zf.infolist():
            member_name = member.filename
            # zip-slip 防护
            if member_name.startswith("/") or ".." in member_name.split("/"):
                raise Exception(f"分享包含可疑路径: {member_name}")
            # 符号链接防护
            if stat.S_ISLNK(member.external_attr >> 16):
                raise Exception(f"分享包含符号链接: {member_name}")
            target = dest.joinpath(*member_name.split("/"))
            if dest_resolved not in target.resolve().parents and target.resolve() != dest_resolved:
                raise Exception(f"分享包含逃逸路径: {member_name}")
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as src, open(target, "wb") as out:
                    shutil.copyfileobj(src, out)


# ==================== 导出 ====================

def export_notes(task_ids: list[str], user_id: int, username: str = "") -> Path:
    """导出指定笔记为 .vnpkg 分享包

    Args:
        task_ids: 要导出的 task_id 列表
        user_id: 导出者用户 ID（权限校验：只能导出自己的笔记）
        username: 导出者用户名（写入 manifest，仅展示用）

    Returns:
        生成的 .vnpkg 文件路径
    """
    from app.db.video_task_dao import get_task_by_task_id_and_user

    _ensure_share_dir()
    temp_dir = Path(tempfile.mkdtemp(prefix="vnpkg_export_"))

    try:
        notes_meta = []
        notes_dir = temp_dir / "notes"

        for task_id in task_ids:
            # 权限校验：只能导出自己的笔记
            task = get_task_by_task_id_and_user(task_id, user_id)
            if not task:
                logger.warning(f"导出跳过：task_id={task_id} 不属于用户 {user_id} 或不存在")
                continue

            # 查找笔记正文文件（当前用户的）
            note_path = find_note_file(
                task.task_id, task.author_id, task.author_name,
                task.video_id, task.title, "note", task.platform,
                user_id=user_id,
            )

            task_dir = notes_dir / task_id
            task_dir.mkdir(parents=True, exist_ok=True)

            # 写 meta.json（video_task 行数据）
            meta = {
                "task_id": task.task_id,
                "video_id": task.video_id,
                "platform": task.platform,
                "video_url": task.video_url,
                "title": task.title,
                "cover_url": task.cover_url,
                "duration": task.duration,
                "author": task.author,
                "author_id": task.author_id,
                "author_name": task.author_name,
                "description": task.description,
                "tags": task.tags,
                "note_style": task.note_style,
            }
            (task_dir / "meta.json").write_text(
                json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
            )

            has_transcript = False
            has_media = False

            # 笔记正文 -> note.json（统一规范名，导入时重写为 note_{uid}.json）
            if note_path and note_path.exists():
                shutil.copy2(note_path, task_dir / "note.json")

            # 转写文本
            transcript_path = find_note_file(
                task.task_id, task.author_id, task.author_name,
                task.video_id, task.title, "transcript", task.platform,
            )
            if transcript_path and transcript_path.exists():
                shutil.copy2(transcript_path, task_dir / "transcript.json")
                has_transcript = True

            # 音频元数据
            audio_path = find_note_file(
                task.task_id, task.author_id, task.author_name,
                task.video_id, task.title, "audio", task.platform,
            )
            if audio_path and audio_path.exists():
                shutil.copy2(audio_path, task_dir / "audio.json")
                has_media = True

            # 封面
            video_folder = get_video_folder(
                task.author_id, task.author_name,
                task.video_id, task.title, task.platform,
            )
            cover_path = video_folder / "cover.jpg"
            if cover_path.exists():
                shutil.copy2(cover_path, task_dir / "cover.jpg")
                has_media = True

            # 截图目录
            screenshots_dir = video_folder / "screenshots"
            if screenshots_dir.exists() and any(screenshots_dir.iterdir()):
                dest_ss = task_dir / "screenshots"
                shutil.copytree(screenshots_dir, dest_ss)
                has_media = True

            notes_meta.append({
                "task_id": task.task_id,
                "video_id": task.video_id,
                "platform": task.platform,
                "title": task.title,
                "author": task.author,
                "author_id": task.author_id,
                "tags": task.tags,
                "has_transcript": has_transcript,
                "has_media": has_media,
            })

        if not notes_meta:
            raise Exception("没有找到可导出的笔记（请确认笔记属于当前用户）")

        # 写 manifest
        manifest = {
            "version": MANIFEST_VERSION,
            "exported_at": datetime.now().isoformat(),
            "exported_by": username,
            "note_count": len(notes_meta),
            "notes": notes_meta,
        }
        (temp_dir / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        # 打包
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        pkg_name = f"videonote_notes_{timestamp}.vnpkg"
        pkg_path = SHARE_DIR / pkg_name
        with zipfile.ZipFile(pkg_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in temp_dir.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(temp_dir)
                    zf.write(file_path, arcname)

        logger.info(f"导出 {len(notes_meta)} 条笔记到 {pkg_path}")
        return pkg_path

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def export_all_notes(user_id: int, username: str = "") -> Path:
    """一键导出当前用户全部笔记"""
    from app.db.video_task_dao import get_all_tasks

    tasks = get_all_tasks(user_id=user_id, role="user")
    task_ids = [t.task_id for t in tasks if t.task_id]
    if not task_ids:
        raise Exception("当前用户没有可导出的笔记")
    return export_notes(task_ids, user_id, username)


# ==================== 导入 ====================

def preview_import(vnpkg_path: Path, user_id: int) -> dict[str, Any]:
    """预览分享包内容 + 冲突检测

    Returns:
        {
            "manifest": {...},
            "notes": [{task_id, title, ...}],
            "conflicts": [{task_id, video_id, platform, existing_task_id}],
            "new_count": int,
            "conflict_count": int,
        }
    """
    from app.db.video_task_dao import get_user_task_for_video

    temp_dir = Path(tempfile.mkdtemp(prefix="vnpkg_preview_"))
    try:
        _safe_extract_vnpkg(vnpkg_path, temp_dir)

        manifest_path = temp_dir / "manifest.json"
        if not manifest_path.exists():
            raise Exception("分享包缺少 manifest.json")

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        notes = manifest.get("notes", [])

        conflicts = []
        new_count = 0

        for note in notes:
            video_id = note.get("video_id")
            platform = note.get("platform", "")
            # 检测当前用户是否已有同视频笔记
            existing = get_user_task_for_video(video_id, platform, user_id) if video_id else None
            if existing:
                conflicts.append({
                    "task_id": note["task_id"],
                    "video_id": video_id,
                    "platform": platform,
                    "title": note.get("title", ""),
                    "existing_task_id": existing.task_id,
                })
            else:
                new_count += 1

        return {
            "manifest": manifest,
            "notes": notes,
            "conflicts": conflicts,
            "new_count": new_count,
            "conflict_count": len(conflicts),
        }

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def import_notes(vnpkg_path: Path, user_id: int, decisions: dict[str, str]) -> dict[str, Any]:
    """执行笔记导入

    Args:
        vnpkg_path: .vnpkg 文件路径
        user_id: 导入目标用户 ID
        decisions: {task_id: "skip"|"overwrite"|"new_copy"}，缺省视为 "new_copy"

    Returns:
        {"success": int, "skipped": int, "overwritten": int, "new_copy": int, "failed": int, "details": [...]}
    """
    from app.db.video_task_dao import get_user_task_for_video, insert_video_task
    from app.db.models.video_tasks import VideoTask
    from app.db.engine import get_db

    temp_dir = Path(tempfile.mkdtemp(prefix="vnpkg_import_"))
    results = {"success": 0, "skipped": 0, "overwritten": 0, "new_copy": 0, "failed": 0, "details": []}

    try:
        _safe_extract_vnpkg(vnpkg_path, temp_dir)

        manifest_path = temp_dir / "manifest.json"
        if not manifest_path.exists():
            raise Exception("分享包缺少 manifest.json")

        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        notes = manifest.get("notes", [])
        notes_dir = temp_dir / "notes"

        for note in notes:
            task_id = note["task_id"]
            decision = decisions.get(task_id, "new_copy")
            task_dir = notes_dir / task_id

            if not task_dir.exists():
                logger.warning(f"导入跳过：分享包中缺少 task_id={task_id} 的目录")
                results["failed"] += 1
                results["details"].append({"task_id": task_id, "status": "failed", "reason": "包中缺少数据"})
                continue

            # 读取 meta.json
            meta_path = task_dir / "meta.json"
            if not meta_path.exists():
                logger.warning(f"导入跳过：task_id={task_id} 缺少 meta.json")
                results["failed"] += 1
                results["details"].append({"task_id": task_id, "status": "failed", "reason": "缺少 meta.json"})
                continue
            meta = json.loads(meta_path.read_text(encoding="utf-8"))

            video_id = meta.get("video_id")
            platform = meta.get("platform", "")

            # 检查冲突
            existing = get_user_task_for_video(video_id, platform, user_id) if video_id else None

            if existing and decision == "skip":
                results["skipped"] += 1
                results["details"].append({"task_id": task_id, "status": "skipped"})
                continue

            # 确定目标 task_id
            if existing and decision == "overwrite":
                # 覆盖：复用已有 task_id，覆盖笔记文件
                target_task_id = existing.task_id
                # 先备份当前笔记文件
                current_note = get_video_file_path(
                    meta.get("author_id"), meta.get("author_name"),
                    video_id, meta.get("title"), "note", platform, user_id=user_id,
                )
                if current_note and current_note.exists():
                    backup_note = current_note.parent / f"{current_note.name}.bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                    shutil.copy2(current_note, backup_note)
                    logger.info(f"覆盖前备份笔记: {backup_note.name}")
                results["overwritten"] += 1
            else:
                # 新副本：生成新 task_id
                target_task_id = str(uuid.uuid4())
                results["new_copy"] += 1

            # 写入 DB 行
            insert_video_task(
                video_id=video_id,
                platform=platform,
                task_id=target_task_id,
                video_url=meta.get("video_url"),
                user_id=user_id,
                author_id=meta.get("author_id"),
                author_name=meta.get("author_name"),
            )

            # 更新 DB 行的元数据（title/tags 等 insert_video_task 不写）
            db = next(get_db())
            try:
                task_row = db.query(VideoTask).filter_by(
                    task_id=target_task_id, user_id=user_id
                ).first()
                if task_row:
                    task_row.title = meta.get("title")
                    task_row.cover_url = meta.get("cover_url")
                    task_row.duration = meta.get("duration")
                    task_row.author = meta.get("author")
                    task_row.description = meta.get("description")
                    task_row.tags = meta.get("tags")
                    task_row.note_style = meta.get("note_style")
                    db.commit()
            except Exception as e:
                logger.error(f"更新笔记元数据失败: {e}")
                db.rollback()
            finally:
                db.close()

            # 写入笔记文件到目标视频目录
            video_folder = get_video_folder(
                meta.get("author_id"), meta.get("author_name"),
                video_id, meta.get("title"), platform,
            )
            video_folder.mkdir(parents=True, exist_ok=True)

            # 笔记正文 -> note_{user_id}.json（统一规范名，消除裸 note.json 串读风险）
            src_note = task_dir / "note.json"
            if src_note.exists():
                dest_note = video_folder / f"note_{user_id}.json"
                shutil.copy2(src_note, dest_note)

            # 转写文本（已存在则跳过去重）
            src_transcript = task_dir / "transcript.json"
            if src_transcript.exists():
                dest_transcript = video_folder / "transcript.json"
                if not dest_transcript.exists():
                    shutil.copy2(src_transcript, dest_transcript)

            # 音频元数据（已存在则跳过）
            src_audio = task_dir / "audio.json"
            if src_audio.exists():
                dest_audio = video_folder / "audio.json"
                if not dest_audio.exists():
                    shutil.copy2(src_audio, dest_audio)

            # 封面（已存在则跳过）
            src_cover = task_dir / "cover.jpg"
            if src_cover.exists():
                dest_cover = video_folder / "cover.jpg"
                if not dest_cover.exists():
                    shutil.copy2(src_cover, dest_cover)

            # 截图目录（已存在则跳过）
            src_screenshots = task_dir / "screenshots"
            if src_screenshots.exists():
                dest_screenshots = video_folder / "screenshots"
                if not dest_screenshots.exists():
                    shutil.copytree(src_screenshots, dest_screenshots)

            results["success"] += 1
            results["details"].append({"task_id": task_id, "status": decision, "target_task_id": target_task_id})

        logger.info(f"笔记导入完成: 成功 {results['success']}, 跳过 {results['skipped']}, "
                     f"覆盖 {results['overwritten']}, 新副本 {results['new_copy']}, 失败 {results['failed']}")
        return results

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
