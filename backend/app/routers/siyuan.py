from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, HttpUrl
from typing import Optional
from pathlib import Path

from app.services.siyuan_exporter import SiyuanExporter
from app.db.siyuan_config_dao import get_config as dao_get_config
from app.db.siyuan_config_dao import upsert_config, test_connection as dao_test_connection
from app.db.siyuan_export_history_dao import get_export_history, get_task_export_history
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger

logger = get_logger(__name__)

# 笔记输出目录
NOTE_OUTPUT_DIR = Path(__file__).parent.parent.parent / "note_results"

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
def get_config():
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
def save_config(data: SiyuanConfigRequest):
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
def update_config(data: SiyuanConfigRequest):
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
def get_notebooks(api_url: str = None, api_token: str = None):
    """获取思源笔记本列表"""
    try:
        # 如果提供了参数，使用参数；否则从数据库读取配置
        if api_url and api_token:
            # 使用传入的参数创建临时配置对象
            from app.db.models.siyuan_config import SiyuanConfig
            config = SiyuanConfig(
                api_url=api_url,
                api_token=api_token,
                enabled=1
            )
        else:
            # 从数据库读取配置
            config = dao_get_config()
            if not config:
                return R.error(msg="请先配置思源笔记连接")

        exporter = SiyuanExporter(config)
        notebooks = exporter.get_notebooks()

        return R.success(data=notebooks)
    except Exception as e:
        logger.error(f"获取笔记本列表失败: {e}")
        return R.error(msg=f"获取笔记本列表失败: {str(e)}")


@router.post("/test")
def test_connection(data: TestConnectionRequest):
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
def export_to_siyuan(task_id: str, title: str = None):
    """导出笔记到思源笔记"""
    try:
        # 读取笔记标题（如果未提供）
        if not title:
            from pathlib import Path
            import json
            audio_cache_file = NOTE_OUTPUT_DIR / f"{task_id}_audio.json"
            if audio_cache_file.exists():
                try:
                    audio_meta = json.loads(audio_cache_file.read_text(encoding="utf-8"))
                    title = audio_meta.get("title", "").strip()
                except:
                    pass

        # 执行导出
        config = dao_get_config()
        if not config:
            return R.error(msg="请先配置思源笔记连接")

        exporter = SiyuanExporter(config)
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
def get_siyuan_export_history(limit: int = 50):
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
def get_siyuan_task_export_history(task_id: str):
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
