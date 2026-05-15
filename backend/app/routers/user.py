from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional

from app.db.user_preferences_dao import get_preferences, save_preferences
from app.utils.response import ResponseWrapper as R
from app.auth.dependencies import get_current_user

router = APIRouter()


class PreferencesRequest(BaseModel):
    summary: Optional[dict] = None
    model: Optional[dict] = None


@router.get("/preferences")
def get_user_preferences(current_user=Depends(get_current_user)):
    prefs = get_preferences(current_user.id)
    return R.success(data=prefs)


@router.put("/preferences")
def save_user_preferences(data: PreferencesRequest, current_user=Depends(get_current_user)):
    existing = get_preferences(current_user.id)

    if data.summary is not None:
        existing["summary"] = data.summary
    if data.model is not None:
        existing["model"] = data.model

    save_preferences(current_user.id, existing)
    return R.success(data=existing, msg="偏好设置已保存")
