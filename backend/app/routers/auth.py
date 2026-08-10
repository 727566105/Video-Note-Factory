from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from app.auth.jwt_handler import create_access_token, create_refresh_token, decode_refresh_token
from app.auth.dependencies import get_current_user, require_admin
from app.auth.rate_limiter import login_rate_limiter
from app.auth.captcha import CAPTCHA_REQUIRED_FAILURES, captcha_manager
from app.db.user_dao import (
    verify_password,
    get_user_by_username,
    create_user,
    get_all_users,
    update_user,
    delete_user,
    generate_api_key,
    get_api_key_info,
    clear_api_key,
)
from app.utils.response import ResponseWrapper as R

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str
    remember_me: bool = False
    # 图形验证码（连续失败达到阈值后必填）
    captcha_id: Optional[str] = None
    captcha_code: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str = "user"


class UserUpdateRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


@router.get("/captcha")
def get_captcha() -> dict:
    """生成一张图形验证码。返回 {captcha_id, image}，image 为 PNG base64。"""
    captcha_id, image = captcha_manager.generate()
    return R.success(data={"captcha_id": captcha_id, "image": image})


@router.post("/login")
def login(req: LoginRequest, request: Request) -> dict:
    client_ip = request.client.host if request.client else "unknown"
    if not login_rate_limiter.is_allowed(req.username, client_ip):
        raise HTTPException(status_code=429, detail="登录失败次数过多，请稍后再试")

    # 渐进式验证码：连续失败达到阈值后，必须先通过图形验证码
    if login_rate_limiter.failure_count(req.username, client_ip) >= CAPTCHA_REQUIRED_FAILURES:
        if not captcha_manager.verify(req.captcha_id, req.captcha_code or ""):
            captcha_id, image = captcha_manager.generate()
            return R.error(
                msg="请输入图形验证码",
                code=428,
                data={"captcha_id": captcha_id, "image": image},
            )

    user = get_user_by_username(req.username)
    if not user or not verify_password(req.password, user.password_hash):
        login_rate_limiter.record_failure(req.username, client_ip)
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    login_rate_limiter.record_success(req.username, client_ip)
    token = create_access_token(
        {"user_id": user.id, "username": user.username, "role": user.role}
    )
    data = {
        "token": token,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
        },
    }
    # 勾选"7天免登录"时签发 refresh token
    if req.remember_me:
        data["refresh_token"] = create_refresh_token(
            {"user_id": user.id, "username": user.username, "role": user.role}
        )
    return R.success(data=data)


@router.post("/refresh")
def refresh_token(req: RefreshTokenRequest) -> dict:
    """
    用 refresh token 换取新的 access token。
    - 不重新签发 refresh token（固定 7 天上限）
    - refresh token 无效/过期返回 401
    """
    from app.auth.dependencies import ensure_token_not_revoked
    from app.db.user_dao import get_user_by_id
    from jose import JWTError

    try:
        user_id = decode_refresh_token(req.refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="refresh token 无效或已过期")

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")

    # 检查密码是否已修改（与 access token 相同的吊销逻辑）
    try:
        ensure_token_not_revoked(req.refresh_token, user)
    except JWTError:
        raise HTTPException(status_code=401, detail="refresh token 已失效")

    new_token = create_access_token(
        {"user_id": user.id, "username": user.username, "role": user.role}
    )
    return R.success(data={"token": new_token})


@router.get("/me")
def get_me(current_user=Depends(get_current_user)) -> dict:
    return R.success(
        data={
            "id": current_user.id,
            "username": current_user.username,
            "role": current_user.role,
        }
    )


@router.get("/users")
def list_users(current_user=Depends(require_admin)) -> dict:
    users = get_all_users()
    return R.success(data=users)


@router.post("/users")
def create_user_api(req: UserCreateRequest, current_user=Depends(require_admin)) -> dict:
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
) -> dict:
    try:
        result = update_user(user_id, req.username, req.password, req.role)
        return R.success(data=result, msg="用户更新成功")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}")
def delete_user_api(user_id: int, current_user=Depends(require_admin)) -> dict:
    try:
        result = delete_user(user_id)
        return R.success(msg=result["message"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/change-password")
def change_password(req: ChangePasswordRequest, current_user=Depends(get_current_user)) -> dict:
    if not verify_password(req.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="旧密码错误")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码长度不能少于6位")
    update_user(current_user.id, password=req.new_password)
    return R.success(msg="密码修改成功")


@router.post("/api-key/generate")
def generate_user_api_key(current_user=Depends(get_current_user)) -> dict:
    """生成或重置当前用户的 API Key（用于 MCP 鉴权）。
    明文仅返回这一次，后续只能查看脱敏。"""
    try:
        api_key = generate_api_key(current_user.id)
        return R.success(data={"api_key": api_key}, msg="API Key 已生成，请立即保存")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api-key")
def get_user_api_key(current_user=Depends(get_current_user)) -> dict:
    """获取当前用户的 API Key 信息（脱敏显示，不返回明文）"""
    info = get_api_key_info(current_user.id)
    return R.success(data=info)


@router.delete("/api-key")
def revoke_user_api_key(current_user=Depends(get_current_user)) -> dict:
    """撤销当前用户的 API Key"""
    ok = clear_api_key(current_user.id)
    if not ok:
        raise HTTPException(status_code=400, detail="清除失败")
    return R.success(msg="API Key 已撤销")
