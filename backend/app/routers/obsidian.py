import json
import re
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.services.obsidian_exporter import ObsidianExporter
from app.db.obsidian_config_dao import (
    get_config as dao_get_config,
    upsert_config,
    get_decrypted_config,
    get_decrypted_key as dao_get_decrypted_key,
    test_vault_access as dao_test_vault,
    test_api_connection as dao_test_api,
    delete_config as dao_delete_config,
    update_enabled as dao_update_enabled,
)
from app.db.obsidian_export_history_dao import get_export_history, get_task_export_history
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger
from app.auth.dependencies import get_current_user

logger = get_logger(__name__)

# 使用统一的路径管理工具
from app.utils.path_helper import find_note_file
from app.db.video_task_dao import get_task_by_task_id

router = APIRouter()


def _is_masked_token(token: str) -> bool:
    """检测 API Key 是否为脱敏格式"""
    return token.endswith('...') or token == '********'


class ObsidianConfigRequest(BaseModel):
    export_mode: str = "local"  # "local" or "api"
    vault_path: Optional[str] = None
    folder_path: Optional[str] = "videoNote/"
    attachments_folder: Optional[str] = "attachments/"
    api_url: Optional[str] = None  # 用 str 而非 HttpUrl，空字符串也能通过校验；格式由业务层校验
    api_key: Optional[str] = None
    enabled: Optional[int] = 1


class TestConnectionRequest(BaseModel):
    export_mode: str = "local"
    vault_path: Optional[str] = None
    api_url: Optional[str] = None  # 同上
    api_key: Optional[str] = None


class ExportRequest(BaseModel):
    title: Optional[str] = None
    content_sections: Optional[dict] = None


@router.get("/config")
def get_config(current_user=Depends(get_current_user)) -> dict:
    """获取 Obsidian 配置"""
    try:
        config = dao_get_config()
        if not config:
            return R.success(data=None)
        # 脱敏 api_key
        return R.success(data={
            "id": config.id,
            "export_mode": config.export_mode,
            "vault_path": config.vault_path,
            "folder_path": config.folder_path,
            "attachments_folder": config.attachments_folder,
            "api_url": config.api_url,
            "api_key": "********",
            "enabled": config.enabled,
            "created_at": config.created_at.isoformat() if config.created_at else None,
            "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        })
    except Exception as e:
        logger.error(f"获取 Obsidian 配置失败: {e}")
        return R.error(msg=f"获取配置失败: {str(e)}")


@router.post("/config")
def save_config(data: ObsidianConfigRequest, current_user=Depends(get_current_user)) -> dict:
    """保存 Obsidian 配置"""
    try:
        # 如果 api_key 是脱敏占位符，拒绝保存（防止误用前端缓存的脱敏值覆盖真实密钥）
        api_key = data.api_key
        if api_key and _is_masked_token(api_key):
            return R.error(msg="API Key 不能为脱敏占位符，请输入真实密钥")

        config_id = upsert_config(
            export_mode=data.export_mode,
            vault_path=data.vault_path,
            folder_path=data.folder_path,
            attachments_folder=data.attachments_folder,
            api_url=str(data.api_url) if data.api_url else None,
            api_key=api_key,
            enabled=data.enabled if data.enabled is not None else 1,
        )
        return R.success(data={"id": config_id}, msg="Obsidian 配置保存成功")
    except Exception as e:
        logger.error(f"保存 Obsidian 配置失败: {e}")
        return R.error(msg=f"保存配置失败: {str(e)}")


@router.put("/config")
def update_config(data: ObsidianConfigRequest, current_user=Depends(get_current_user)) -> dict:
    """更新 Obsidian 配置"""
    try:
        # 检查是否为脱敏 api_key，是则保留原值
        api_key = data.api_key
        if api_key and _is_masked_token(api_key):
            existing = dao_get_config()
            if not existing:
                return R.error(msg="配置不存在")
            api_key = existing.api_key

        config_id = upsert_config(
            export_mode=data.export_mode,
            vault_path=data.vault_path,
            folder_path=data.folder_path,
            attachments_folder=data.attachments_folder,
            api_url=str(data.api_url) if data.api_url else None,
            api_key=api_key,
            enabled=data.enabled if data.enabled is not None else 1,
        )
        return R.success(data={"id": config_id}, msg="Obsidian 配置更新成功")
    except Exception as e:
        logger.error(f"更新 Obsidian 配置失败: {e}")
        return R.error(msg=f"更新配置失败: {str(e)}")


@router.delete("/config")
def delete_config(current_user=Depends(get_current_user)) -> dict:
    """删除 Obsidian 配置"""
    try:
        dao_delete_config()
        return R.success(msg="Obsidian 配置已删除")
    except Exception as e:
        logger.error(f"删除 Obsidian 配置失败: {e}")
        return R.error(msg=f"删除配置失败: {str(e)}")


@router.put("/config/enabled")
def toggle_enabled(enabled: int = 1, current_user=Depends(get_current_user)) -> dict:
    """启用/禁用 Obsidian 集成"""
    try:
        if enabled not in (0, 1):
            return R.error(msg="enabled 参数只能为 0 或 1")
        dao_update_enabled(enabled)
        return R.success(msg=f"Obsidian 已{'启用' if enabled else '禁用'}")
    except Exception as e:
        logger.error(f"切换 Obsidian 启用状态失败: {e}")
        return R.error(msg=f"操作失败: {str(e)}")


@router.post("/test")
def test_connection(data: TestConnectionRequest, current_user=Depends(get_current_user)) -> dict:
    """测试 Obsidian 连接（根据模式测试 Vault 或 API）"""
    try:
        if data.export_mode == "local":
            if not data.vault_path:
                return R.success(data={"success": False, "message": "请提供 Vault 路径"})
            success, message = dao_test_vault(data.vault_path)
        else:
            if not data.api_url or not data.api_key:
                return R.success(data={"success": False, "message": "请提供 API 地址和密钥"})
            success, message = dao_test_api(
                api_url=str(data.api_url),
                api_key=data.api_key
            )
        return R.success(data={"success": success, "message": message})
    except Exception as e:
        logger.error(f"测试 Obsidian 连接异常: {e}", exc_info=True)
        return R.success(data={"success": False, "message": f"测试连接失败: {str(e)}"})


@router.post("/export/obsidian/{task_id}")
def export_to_obsidian(task_id: str, data: Optional[ExportRequest] = None, current_user=Depends(get_current_user)) -> dict:
    """导出笔记到 Obsidian"""
    try:
        # 读取笔记标题（如果未提供）
        title = None
        if data:
            title = data.title

        if not title:
            task = get_task_by_task_id(task_id)
            audio_cache_file = find_note_file(
                task_id,
                author_id=getattr(task, 'author_id', None),
                author_name=getattr(task, 'author_name', None),
                video_id=getattr(task, 'video_id', None),
                title=getattr(task, 'title', None),
                file_type="audio",
                platform=getattr(task, 'platform', "") or ""
            ) if task else None
            if audio_cache_file and audio_cache_file.exists():
                try:
                    audio_meta = json.loads(audio_cache_file.read_text(encoding="utf-8"))
                    title = audio_meta.get("title", "").strip()
                except Exception:
                    pass

        # 获取 content_sections（如果有）
        content_sections = None
        if data and data.content_sections:
            content_sections = data.content_sections

        # 执行导出
        exporter = ObsidianExporter()
        if not exporter.config:
            return R.error(msg="请先配置 Obsidian 连接")

        result = exporter.export_note(task_id, content_sections=content_sections, title=title)

        return R.success(
            data=result,
            msg="笔记已成功导出到 Obsidian"
        )
    except FileNotFoundError as e:
        logger.error(f"笔记文件不存在: task_id={task_id}")
        return R.error(msg="笔记不存在或已删除")
    except ValueError as e:
        logger.error(f"笔记内容无效: task_id={task_id}")
        return R.error(msg="笔记内容为空，无法导出")
    except PermissionError as e:
        logger.error(f"Obsidian Vault 写入权限不足: task_id={task_id}")
        return R.error(msg=f"写入权限不足: {str(e)}")
    except Exception as e:
        logger.error(f"导出到 Obsidian 失败: task_id={task_id}, error: {e}")
        return R.error(msg=f"导出失败: {str(e)}")


@router.get("/history")
def get_obsidian_export_history(limit: int = 50, current_user=Depends(get_current_user)) -> dict:
    """获取 Obsidian 导出历史"""
    try:
        histories = get_export_history(limit)
        history_list = []
        for h in histories:
            history_list.append({
                "id": h.id,
                "task_id": h.task_id,
                "export_mode": h.export_mode,
                "file_path": h.file_path,
                "status": h.status,
                "error_message": h.error_message,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            })
        return R.success(data={"history": history_list, "total": len(history_list)})
    except Exception as e:
        logger.error(f"获取 Obsidian 导出历史失败: {e}")
        return R.error(msg=f"获取导出历史失败: {str(e)}")


@router.get("/history/{task_id}")
def get_obsidian_task_export_history(task_id: str, current_user=Depends(get_current_user)) -> dict:
    """获取指定任务的 Obsidian 导出历史"""
    try:
        histories = get_task_export_history(task_id)
        history_list = []
        for h in histories:
            history_list.append({
                "id": h.id,
                "task_id": h.task_id,
                "export_mode": h.export_mode,
                "file_path": h.file_path,
                "status": h.status,
                "error_message": h.error_message,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            })
        return R.success(data={"history": history_list, "total": len(history_list)})
    except Exception as e:
        logger.error(f"获取任务导出历史失败: {e}")
        return R.error(msg=f"获取导出历史失败: {str(e)}")
