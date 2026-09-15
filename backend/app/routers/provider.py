from typing import Optional
from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel
import os
import uuid

from app.services.model import ModelService
from app.utils.response import ResponseWrapper as R
from app.services.provider import ProviderService
from app.utils.logger import get_logger
from app.auth.dependencies import require_admin, get_current_user

logger = get_logger(__name__)
router = APIRouter()

#  新增 type 字段
class ProviderRequest(BaseModel):
    name: str
    api_key: str
    base_url: str
    logo: Optional[str] = None
    logo_url: Optional[str] = None
    type: str

class TestRequest(BaseModel):
    id: str
class ProviderUpdateRequest(BaseModel):
    id: str
    name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    logo: Optional[str] = None
    logo_url: Optional[str] = None
    type: Optional[str] = None
    enabled:Optional[int] = None

@router.post("/add_provider")
def add_provider(data: ProviderRequest, current_user=Depends(require_admin)) -> dict:
    try:
        res = ProviderService.add_provider(
            name=data.name,
            api_key=data.api_key,
            base_url=data.base_url,
            logo=data.logo,
            type_=data.type,
            logo_url=data.logo_url
        )
        return R.success(msg='添加模型供应商成功',data=res)
    except Exception as e:
        return R.error(msg=e)

@router.get("/get_all_providers")
def get_all_providers(current_user=Depends(get_current_user)) -> dict:
    try:
        res = ProviderService.get_all_providers_safe()
        return R.success(data=res)
    except Exception as e:
        return R.error(msg=e)

@router.get("/get_provider_by_id/{id}")
def get_provider_by_id(id: str, current_user=Depends(require_admin)) -> dict:
    try:
        res = ProviderService.get_provider_by_id_safe(id)
        return R.success(data=res)
    except Exception as e:
        return R.error(msg=e)
#
# @router.get("/get_provider_by_name/{name}")
# def get_provider_by_name(name: str):
#     try:
#         res = ProviderService.get_provider_by_name(name)
#         return R.success(data=res)
#     except Exception as e:
#         return R.error(msg=e)


@router.post("/update_provider")
def update_provider(data: ProviderUpdateRequest, current_user=Depends(require_admin)) -> dict:
    try:
        if all(
            field is None
            for field in [data.name, data.api_key, data.base_url, data.logo, data.logo_url, data.type,data.enabled]
        ):
            return R.error(msg='请至少填写一个参数')

        provider_id =ProviderService.update_provider(
            id=data.id,
            data=dict(data)
        )
        return R.success(msg='更新模型供应商成功',data={'id': provider_id})
    except Exception as e:
        logger.error(f"更新供应商失败: {e}")
        return R.error(msg=str(e))

@router.post('/connect_test')
def gpt_connect_test(data: TestRequest, current_user=Depends(require_admin)) -> dict:
    ModelService().connect_test(data.id)
    return R.success(msg='连接成功')


@router.delete("/delete_provider/{id}")
def delete_provider(id: str, current_user=Depends(require_admin)) -> dict:
    """删除模型供应商"""
    try:
        from app.db.provider_dao import delete_provider as dao_delete_provider
        dao_delete_provider(id)
        return R.success(msg='删除模型供应商成功')
    except Exception as e:
        return R.error(msg=f'删除模型供应商失败: {e}')

# 图标上传配置
ICON_UPLOAD_DIR = "uploads/icons"
ICON_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "svg"}
ICON_MAX_SIZE = 2 * 1024 * 1024  # 2MB

@router.post("/upload_icon")
async def upload_icon(file: UploadFile = File(...), current_user=Depends(require_admin)) -> dict:
    """上传供应商图标"""
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in ICON_ALLOWED_EXTENSIONS:
        return R.error(msg=f"不支持的文件格式，仅允许: {', '.join(ICON_ALLOWED_EXTENSIONS)}")

    content = await file.read()
    if len(content) > ICON_MAX_SIZE:
        return R.error(msg="文件大小不能超过 2MB")

    os.makedirs(ICON_UPLOAD_DIR, exist_ok=True)

    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(ICON_UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(content)

    url = f"/uploads/icons/{filename}"
    return R.success(data={"url": url})
