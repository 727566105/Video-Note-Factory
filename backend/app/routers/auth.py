from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.auth.jwt_handler import create_access_token
from app.auth.dependencies import get_current_user, require_admin
from app.db.user_dao import (
    verify_password,
    get_user_by_username,
    create_user,
    get_all_users,
    update_user,
    delete_user,
)
from app.utils.response import ResponseWrapper as R

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None


@router.post("/login")
def login(req: LoginRequest):
    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_access_token(
        {"user_id": user.id, "username": user.username, "role": user.role}
    )
    return R.success(
        data={
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "role": user.role,
            },
        }
    )


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return R.success(
        data={
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role,
        }
    )


@router.get("/users")
def list_users(current_user=Depends(require_admin)):
    users = get_all_users()
    return R.success(data=users)


@router.post("/users")
def create_user_api(req: UserCreateRequest, current_user=Depends(require_admin)):
    try:
        user = create_user(req.username, req.password, req.role)
        return R.success(
            data={"id": user.id, "username": user.username, "role": user.role},
            msg="用户创建成功",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/users/{user_id}")
def update_user_api(
    user_id: int, req: UserUpdateRequest, current_user=Depends(require_admin)
):
    try:
        result = update_user(user_id, req.username, req.password, req.role)
        return R.success(data=result, msg="用户更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}")
def delete_user_api(user_id: int, current_user=Depends(require_admin)):
    try:
        result = delete_user(user_id)
        return R.success(msg=result["message"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
