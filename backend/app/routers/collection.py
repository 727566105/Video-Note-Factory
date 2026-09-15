"""合集管理 API"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth.dependencies import get_current_user
from app.db.engine import get_db
from app.services import collection as collection_svc
from app.utils.response import ResponseWrapper as R

router = APIRouter(prefix="/api/collections", tags=["合集管理"])


class CreateCollectionRequest(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    task_ids: Optional[list[str]] = None


class UpdateCollectionRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    category: Optional[str] = None
    sort_order: Optional[int] = None


class AddItemsRequest(BaseModel):
    task_ids: list[str]


class UpdateOrderRequest(BaseModel):
    ordered_task_ids: list[str]


class GenerateSummaryRequest(BaseModel):
    style: str = "minimal"
    model_name: Optional[str] = None
    provider_id: Optional[str] = None
    extras: Optional[str] = None
    mode: str = "overview"


class EditSummaryRequest(BaseModel):
    content: str


class SmartCollectionRequest(BaseModel):
    name: str
    rule_type: str  # tag / channel / platform
    rule_value: str
    description: Optional[str] = None


class CloneRequest(BaseModel):
    new_name: Optional[str] = None


@router.get("")
async def list_collections(user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_user_collections(db, user.id)
        return R.success(result)
    finally:
        db.close()


@router.get("/task_map")
async def get_task_collection_map(user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_task_collection_map(db, user.id)
        return R.success(result)
    finally:
        db.close()


@router.post("")
async def create_collection(req: CreateCollectionRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.create_collection(
            db, user.id, req.name, req.description, req.category, req.task_ids
        )
        return R.success(result)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()


@router.put("/{collection_id}")
async def update_collection(collection_id: str, req: UpdateCollectionRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.update_collection(db, collection_id, **req.model_dump(exclude_none=True))
        if not result:
            raise HTTPException(status_code=404, detail="合集不存在")
        return R.success(result)
    finally:
        db.close()


@router.delete("/{collection_id}")
async def delete_collection(collection_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        ok = collection_svc.delete_collection(db, collection_id, user.id)
        if not ok:
            raise HTTPException(status_code=404, detail="合集不存在")
        return R.success(None)
    finally:
        db.close()


@router.get("/{collection_id}")
async def get_collection_detail(collection_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_collection_detail(db, collection_id, user.id)
        if not result:
            raise HTTPException(status_code=404, detail="合集不存在")
        return R.success(result)
    finally:
        db.close()


@router.post("/{collection_id}/items")
async def add_items(collection_id: str, req: AddItemsRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        added = collection_svc.add_items_to_collection(db, collection_id, req.task_ids)
        return R.success({"added": added})
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()


@router.delete("/{collection_id}/items/{task_id}")
async def remove_item(collection_id: str, task_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        ok = collection_svc.remove_item_from_collection(db, collection_id, task_id)
        if not ok:
            raise HTTPException(status_code=404, detail="条目不存在")
        return R.success(None)
    finally:
        db.close()


@router.put("/{collection_id}/items/order")
async def update_items_order(collection_id: str, req: UpdateOrderRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        collection_svc.update_items_order(db, collection_id, req.ordered_task_ids)
        return R.success(None)
    finally:
        db.close()


@router.get("/{collection_id}/summary")
async def get_summary(collection_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_collection_summary(db, collection_id)
        return R.success(result)
    finally:
        db.close()


@router.post("/{collection_id}/generate_summary")
def generate_summary(collection_id: str, req: GenerateSummaryRequest, user=Depends(get_current_user)):
    # 注意：必须用同步 def——service 内部是同步 LLM 网络调用（gpt.summarize 阻塞数秒），
    # async def 会阻塞整个事件循环，导致生成期间其他合集请求全部排队不响应。
    # 同步 def 由 FastAPI 放到线程池执行，事件循环保持空闲。
    db = next(get_db())
    try:
        result = collection_svc.generate_collection_summary(
            db, collection_id, user.id,
            style=req.style, model_name=req.model_name,
            provider_id=req.provider_id, extras=req.extras,
            mode=req.mode,
        )
        if not result:
            raise HTTPException(status_code=400, detail="生成总结失败，请检查合集是否有笔记内容")
        return R.success(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# ── 编辑总结 ──

@router.put("/{collection_id}/summary")
async def edit_collection_summary(collection_id: str, req: EditSummaryRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.edit_summary(db, collection_id, user.id, req.content)
        if not result:
            raise HTTPException(status_code=404, detail="合集不存在")
        return R.success(result)
    finally:
        db.close()


# ── 分享 ──

@router.post("/{collection_id}/share")
async def share_collection(collection_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.share_collection(db, collection_id, user.id)
        if not result:
            raise HTTPException(status_code=404, detail="合集不存在")
        return R.success(result)
    finally:
        db.close()


@router.delete("/{collection_id}/share")
async def unshare_collection(collection_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        ok = collection_svc.unshare_collection(db, collection_id, user.id)
        if not ok:
            raise HTTPException(status_code=404, detail="合集不存在")
        return R.success(None)
    finally:
        db.close()


@router.get("/shared/{share_token}")
async def get_shared_collection(share_token: str):
    """公开访问分享的合集（无需登录）"""
    db = next(get_db())
    try:
        result = collection_svc.get_shared_collection(db, share_token)
        if not result:
            raise HTTPException(status_code=404, detail="合集不存在或未公开")
        return R.success(result)
    finally:
        db.close()


# ── 广场 ──

@router.get("/plaza/list")
async def get_plaza(page: int = 1, limit: int = 20, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_plaza_collections(db, page, limit)
        return R.success(result)
    finally:
        db.close()


@router.post("/{collection_id}/favorite")
async def toggle_favorite(collection_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.toggle_favorite(db, collection_id, user.id)
        return R.success(result)
    finally:
        db.close()


@router.get("/favorites/list")
async def get_favorites(user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_user_favorites(db, user.id)
        return R.success(result)
    finally:
        db.close()


@router.post("/{collection_id}/clone")
async def clone_collection(collection_id: str, req: CloneRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.clone_collection(db, collection_id, user.id, req.new_name)
        if not result:
            raise HTTPException(status_code=404, detail="合集不存在")
        return R.success(result)
    finally:
        db.close()


# ── 智能合集 ──

@router.get("/smart/list")
async def list_smart_collections(user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_user_smart_collections(db, user.id)
        return R.success(result)
    finally:
        db.close()


@router.post("/smart")
async def create_smart_collection(req: SmartCollectionRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.create_smart_collection(
            db, user.id, req.name, req.rule_type, req.rule_value, req.description
        )
        return R.success(result)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        db.close()


@router.post("/smart/{sc_id}/sync")
async def sync_smart_collection(sc_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        count = collection_svc.sync_smart_collection(db, sc_id, user.id)
        return R.success({"match_count": count})
    finally:
        db.close()


@router.delete("/smart/{sc_id}")
async def delete_smart_collection(sc_id: str, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        ok = collection_svc.delete_smart_collection(db, sc_id, user.id)
        if not ok:
            raise HTTPException(status_code=404, detail="智能合集不存在")
        return R.success(None)
    finally:
        db.close()
