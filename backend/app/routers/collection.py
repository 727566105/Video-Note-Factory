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


@router.get("")
async def list_collections(user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.get_user_collections(db, user.id)
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
async def generate_summary(collection_id: str, req: GenerateSummaryRequest, user=Depends(get_current_user)):
    db = next(get_db())
    try:
        result = collection_svc.generate_collection_summary(
            db, collection_id, user.id,
            style=req.style, model_name=req.model_name,
            provider_id=req.provider_id, extras=req.extras,
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
