from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl
from typing import Optional
from pathlib import Path

from app.services.siyuan_exporter import SiyuanExporter
from app.db.siyuan_config_dao import get_config as dao_get_config
from app.db.siyuan_config_dao import upsert_config, test_connection as dao_test_connection
from app.db.siyuan_export_history_dao import get_export_history, get_task_export_history
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger
from app.auth.dependencies import get_current_user

logger = get_logger(__name__)

# 使用统一的路径管理工具
from app.utils.path_helper import find_note_file
from app.db.video_task_dao import get_task_by_task_id

router = APIRouter()


def _is_masked_token(token: str) -> bool:
    """检测 Token 是否为脱敏格式"""
    return token.endswith('...') or token == '********'


class SiyuanConfigRequest(BaseModel):
    api_url: HttpUrl
    api_token: str
    default_notebook: Optional[str] = None


class TestConnectionRequest(BaseModel):
    api_url: HttpUrl
    api_token: str


@router.get("/config")
def get_config(current_user=Depends(get_current_user)) -> dict:
    """获取思源笔记配置"""
    try:
        config = dao_get_config()
        if not config:
            return R.success(data=None)
        # 脱敏 Token（使用统一占位符，不泄露长度）
        return R.success(data={
            "id": config.id,
            "api_url": config.api_url,
            "api_token": "********",
            "default_notebook": config.default_notebook,
            "enabled": config.enabled,
            "created_at": config.created_at.isoformat() if config.created_at else None,
            "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        })
    except Exception as e:
        logger.error(f"获取思源笔记配置失败: {e}")
        return R.error(msg=f"获取配置失败: {str(e)}")


@router.post("/config")
def save_config(data: SiyuanConfigRequest, current_user=Depends(get_current_user)) -> dict:
    """保存思源笔记配置"""
    try:
        config_id = upsert_config(
            api_url=str(data.api_url),
            api_token=data.api_token,
            default_notebook=data.default_notebook
        )
        return R.success(data={"id": config_id}, msg="思源笔记配置保存成功")
    except Exception as e:
        logger.error(f"保存思源笔记配置失败: {e}")
        return R.error(msg=f"保存配置失败: {str(e)}")


@router.put("/config")
def update_config(data: SiyuanConfigRequest, current_user=Depends(get_current_user)) -> dict:
    """更新思源笔记配置"""
    try:
        # 检查是否为脱敏 Token，是则保留原 Token
        if _is_masked_token(data.api_token):
            existing = dao_get_config()
            if not existing:
                return R.error(msg="配置不存在")
            actual_token = existing.api_token
        else:
            actual_token = data.api_token

        config_id = upsert_config(
            api_url=str(data.api_url),
            api_token=actual_token,
            default_notebook=data.default_notebook
        )
        return R.success(data={"id": config_id}, msg="思源笔记配置更新成功")
    except Exception as e:
        logger.error(f"更新思源笔记配置失败: {e}")
        return R.error(msg=f"更新配置失败: {str(e)}")


@router.get("/notebooks")
def get_notebooks(api_url: str = None, api_token: str = None, current_user=Depends(get_current_user)) -> dict:
    """获取思源笔记本列表"""
    try:
        if api_url and api_token:
            # 使用传入的参数创建临时配置对象（token 明文）
            from app.db.models.siyuan_config import SiyuanConfig
            config = SiyuanConfig(
                api_url=api_url,
                api_token=api_token,
                enabled=1
            )
            exporter = SiyuanExporter(config)
        else:
            # 从数据库读取配置（exporter 会自动解密）
            exporter = SiyuanExporter()
            if not exporter.config:
                return R.error(msg="请先配置思源笔记连接")

        notebooks = exporter.get_notebooks()
        return R.success(data=notebooks)
    except Exception as e:
        logger.error(f"获取笔记本列表失败: {e}")
        return R.error(msg=f"获取笔记本列表失败: {str(e)}")


@router.post("/test")
def test_connection(data: TestConnectionRequest, current_user=Depends(get_current_user)) -> dict:
    """测试思源笔记连接"""
    logger.info(f"收到测试连接请求: api_url={data.api_url}, token={data.api_token[:8]}...")
    try:
        success, message = dao_test_connection(
            api_url=str(data.api_url),
            api_token=data.api_token
        )
        logger.info(f"测试连接结果: success={success}, message={message}")
        # 返回统一格式，data 中包含 success 和 message
        result = R.success(data={"success": success, "message": message})
        logger.info(f"返回结果: {result}")
        return result
    except Exception as e:
        logger.error(f"测试连接异常: {e}", exc_info=True)
        return R.success(data={"success": False, "message": f"测试连接失败: {str(e)}"})


@router.post("/export/siyuan/{task_id}")
def export_to_siyuan(task_id: str, title: str = None, current_user=Depends(get_current_user)) -> dict:
    """导出笔记到思源笔记"""
    try:
        # 读取笔记标题（如果未提供）
        if not title:
            import json
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

        # 执行导出（exporter 会自动解密 Token）
        exporter = SiyuanExporter()
        if not exporter.config:
            return R.error(msg="请先配置思源笔记连接")

        result = exporter.export_note(task_id, title)

        return R.success(
            data=result,
            msg=f"笔记已成功导出到思源笔记"
        )
    except FileNotFoundError as e:
        logger.error(f"笔记文件不存在: task_id={task_id}")
        return R.error(msg="笔记不存在或已删除")
    except ValueError as e:
        logger.error(f"笔记内容无效: task_id={task_id}")
        return R.error(msg="笔记内容为空，无法导出")
    except Exception as e:
        logger.error(f"导出到思源笔记失败: task_id={task_id}, error: {e}")
        return R.error(msg=f"导出失败: {str(e)}")


@router.get("/history")
def get_siyuan_export_history(limit: int = 50, current_user=Depends(get_current_user)) -> dict:
    """获取思源笔记导出历史"""
    try:
        histories = get_export_history(limit)
        history_list = []
        for h in histories:
            history_list.append({
                "id": h.id,
                "task_id": h.task_id,
                "siyuan_doc_id": h.siyuan_doc_id,
                "notebook_id": h.notebook_id,
                "notebook_name": h.notebook_name,
                "doc_path": h.doc_path,
                "status": h.status,
                "error_message": h.error_message,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            })
        return R.success(data={"history": history_list, "total": len(history_list)})
    except Exception as e:
        logger.error(f"获取导出历史失败: {e}")
        return R.error(msg=f"获取导出历史失败: {str(e)}")


@router.get("/history/{task_id}")
def get_siyuan_task_export_history(task_id: str, current_user=Depends(get_current_user)) -> dict:
    """获取指定任务的思源笔记导出历史"""
    try:
        histories = get_task_export_history(task_id)
        history_list = []
        for h in histories:
            history_list.append({
                "id": h.id,
                "siyuan_doc_id": h.siyuan_doc_id,
                "notebook_id": h.notebook_id,
                "notebook_name": h.notebook_name,
                "doc_path": h.doc_path,
                "status": h.status,
                "error_message": h.error_message,
                "created_at": h.created_at.isoformat() if h.created_at else None,
            })
        return R.success(data={"history": history_list, "total": len(history_list)})
    except Exception as e:
        logger.error(f"获取任务导出历史失败: {e}")
        return R.error(msg=f"获取导出历史失败: {str(e)}")
