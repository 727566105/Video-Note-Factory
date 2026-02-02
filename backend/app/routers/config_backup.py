"""配置备份 API 路由

提供系统配置的导出和导入功能：
- AI 模型设置
- 下载器配置
- 思源笔记配置
- WebDAV 备份配置
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
import json
import os

from app.services.config_export import ConfigExporter, ConfigImporter
from app.utils.response import ResponseWrapper as R
from app.utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter()


class ImportPreviewRequest(BaseModel):
    """导入预览请求 - 用于已解析的 JSON 数据"""
    config_data: dict


class ImportExecuteRequest(BaseModel):
    """导入执行请求"""
    config_data: dict
    selected_items: List[str]
    credentials: Optional[Dict[str, Dict[str, str]]] = None


# ==================== 配置导出 ====================

@router.get("/export")
def export_configs():
    """导出当前配置为 JSON"""
    try:
        config_data = ConfigExporter.export_config()
        logger.info("Config exported successfully")
        return R.success(data=config_data, msg="配置导出成功")
    except Exception as e:
        logger.error(f"导出配置失败: {e}")
        return R.error(msg=f"导出配置失败: {str(e)}")


@router.get("/export/file")
def export_configs_file():
    """导出配置为 JSON 文件下载"""
    try:
        import tempfile
        from fastapi.responses import FileResponse

        # 生成配置文件
        config_file_path = ConfigExporter.save_configs_file()

        # 创建临时文件用于下载
        temp_dir = tempfile.gettempdir()
        download_path = os.path.join(temp_dir, "bilinote_configs.json")

        # 复制文件到下载位置
        import shutil
        shutil.copy2(config_file_path, download_path)

        logger.info(f"Config file generated: {download_path}")

        # 返回文件下载响应
        return FileResponse(
            path=download_path,
            filename="bilinote_configs.json",
            media_type="application/json",
            background=None
        )
    except Exception as e:
        logger.error(f"导出配置文件失败: {e}")
        raise HTTPException(status_code=500, detail=f"导出配置文件失败: {str(e)}")


# ==================== 配置导入 ====================

@router.post("/import/preview")
async def preview_import(file: UploadFile = File(...)):
    """
    预览配置导入文件

    上传 configs.json 文件，返回可导入的配置项预览
    """
    try:
        # 验证文件类型
        if not file.filename.endswith('.json'):
            return R.error(msg="请上传 JSON 格式的配置文件")

        # 读取文件内容
        content = await file.read()
        try:
            config_data = json.loads(content.decode('utf-8'))
        except json.JSONDecodeError:
            return R.error(msg="配置文件格式错误，无法解析")

        # 验证配置文件
        is_valid, errors = ConfigImporter.validate_config_file(config_data)
        if not is_valid:
            return R.error(msg=f"配置文件验证失败: {', '.join(errors)}")

        # 生成预览
        preview = ConfigImporter.preview_configs(config_data)

        logger.info(f"Config import preview: {len(preview['available_items'])} items available")
        return R.success(data=preview, msg="配置文件预览成功")

    except Exception as e:
        logger.error(f"预览配置文件失败: {e}")
        return R.error(msg=f"预览配置文件失败: {str(e)}")


@router.post("/import/preview/json")
def preview_import_json(request: ImportPreviewRequest):
    """
    预览配置导入（JSON 数据）

    直接传入已解析的 JSON 数据进行预览
    """
    try:
        config_data = request.config_data

        # 验证配置文件
        is_valid, errors = ConfigImporter.validate_config_file(config_data)
        if not is_valid:
            return R.error(msg=f"配置文件验证失败: {', '.join(errors)}")

        # 生成预览
        preview = ConfigImporter.preview_configs(config_data)

        logger.info(f"Config import preview (JSON): {len(preview['available_items'])} items available")
        return R.success(data=preview, msg="配置文件预览成功")

    except Exception as e:
        logger.error(f"预览配置失败: {e}")
        return R.error(msg=f"预览配置失败: {str(e)}")


@router.post("/import/execute")
def execute_import(request: ImportExecuteRequest):
    """
    执行配置导入

    根据用户选择的配置项和提供的敏感信息执行导入
    """
    try:
        # 验证配置文件
        is_valid, errors = ConfigImporter.validate_config_file(request.config_data)
        if not is_valid:
            return R.error(msg=f"配置文件验证失败: {', '.join(errors)}")

        # 执行导入
        results = ConfigImporter.import_configs(
            config_data=request.config_data,
            selected_items=request.selected_items,
            credentials=request.credentials
        )

        # 检查是否有失败的项目
        has_failures = len(results["failed"]) > 0
        has_skips = len(results["skipped"]) > 0

        # 构建消息
        success_count = len(results["success"])
        failed_count = len(results["failed"])
        skipped_count = len(results["skipped"])

        if success_count > 0 and failed_count == 0 and skipped_count == 0:
            msg = f"成功导入 {success_count} 项配置"
        elif failed_count > 0:
            msg = f"导入完成：成功 {success_count} 项，失败 {failed_count} 项，跳过 {skipped_count} 项"
        else:
            msg = f"导入完成：成功 {success_count} 项，跳过 {skipped_count} 项"

        logger.info(f"Config import executed: success={success_count}, failed={failed_count}, skipped={skipped_count}")
        return R.success(data=results, msg=msg)

    except Exception as e:
        logger.error(f"执行配置导入失败: {e}")
        return R.error(msg=f"执行配置导入失败: {str(e)}")
