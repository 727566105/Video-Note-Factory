from fastapi import APIRouter

from app.utils.response import ResponseWrapper as R

router = APIRouter()


@router.get("/health")
async def health_check():
    return R.success({"status": "ok"})
