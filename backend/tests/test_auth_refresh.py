"""登录 remember_me / refresh token 流转的自动化测试。

覆盖此前未覆盖的核心鉴权链路：
- remember_me=true 才签发 refresh token；false 不签发
- refresh token 7 天有效期（exp-iat 差值）
- /auth/refresh 用 refresh token 换新 access token
- 无效/过期 refresh token 返回 401
- refresh token 不能直接当 access token 用
- 修改密码后 refresh token 被吊销
"""
import time
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth.jwt_handler import decode_payload, decode_refresh_token

from tests.conftest import _db_required


@pytest.fixture
def admin_creds():
    return "admin", "123456"


@_db_required
def test_login_remember_me_true_returns_refresh_token(client: TestClient, admin_creds):
    """勾选 7天免登录 -> 返回 refresh token"""
    username, password = admin_creds
    resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "remember_me": True},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["token"]
    assert data["refresh_token"]


@_db_required
def test_login_remember_me_false_no_refresh_token(client: TestClient, admin_creds):
    """默认/未勾选 -> 不返回 refresh token"""
    username, password = admin_creds
    resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "remember_me": False},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["token"]
    assert "refresh_token" not in data


@_db_required
def test_refresh_token_expires_in_7_days(client: TestClient, admin_creds):
    """refresh token 有效期固定为 7 天"""
    username, password = admin_creds
    resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "remember_me": True},
    )
    refresh_token = resp.json()["data"]["refresh_token"]

    payload = __import__("jose").jwt.get_unverified_claims(refresh_token)
    exp = payload["exp"]
    iat = payload["iat"]
    assert exp - iat == 7 * 24 * 3600


@_db_required
def test_refresh_exchanges_for_new_access_token(client: TestClient, admin_creds):
    """refresh token 换新 access token 成功，且新 token 是 access 类型"""
    username, password = admin_creds
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "remember_me": True},
    ).json()["data"]
    refresh_token = login["refresh_token"]

    resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert resp.status_code == 200
    new_token = resp.json()["data"]["token"]
    # 新 token 是 access 类型（可被 decode_payload 接受）
    assert decode_payload(new_token)["type"] == "access"
    # 且能真正访问鉴权接口
    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {new_token}"}
    )
    assert me.status_code == 200


@_db_required
def test_refresh_with_garbage_token_returns_401(client: TestClient):
    """无效 refresh token -> 401"""
    resp = client.post(
        "/api/auth/refresh", json={"refresh_token": "not-a-real-token"}
    )
    assert resp.status_code == 401


@_db_required
def test_access_token_cannot_be_used_as_refresh(client: TestClient, admin_creds):
    """access token 冒充 refresh token -> 401"""
    username, password = admin_creds
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "remember_me": True},
    ).json()["data"]
    access_token = login["token"]

    resp = client.post("/api/auth/refresh", json={"refresh_token": access_token})
    assert resp.status_code == 401


@_db_required
def test_refresh_token_cannot_be_used_as_access(client: TestClient, admin_creds):
    """refresh token 直接访问 API -> 401（隔离）"""
    username, password = admin_creds
    login = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "remember_me": True},
    ).json()["data"]
    refresh_token = login["refresh_token"]

    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {refresh_token}"}
    )
    assert me.status_code == 401


@_db_required
def test_refresh_revoked_after_password_change(client: TestClient):
    """修改密码后旧 refresh token 被吊销 -> 401"""
    # 创建临时用户
    from app.db.user_dao import create_user, delete_user
    uname = f"refresh_revoke_{int(time.time())}"
    pwd = "oldpass123"
    user = create_user(uname, pwd, "user")
    try:
        login = client.post(
            "/api/auth/login",
            json={"username": uname, "password": pwd, "remember_me": True},
        ).json()["data"]
        refresh_token = login["refresh_token"]

        # 吊销基于秒级时间戳比较（iat < password_changed_at），
        # 需保证密码修改发生在登录的下一秒之后，测试才确定可复现。
        time.sleep(1.1)

        # 修改密码
        change = client.put(
            "/api/auth/change-password",
            headers={"Authorization": f"Bearer {login['token']}"},
            json={"old_password": pwd, "new_password": "newpass456"},
        )
        assert change.status_code == 200

        # 旧 refresh token 应被吊销
        resp = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 401
    finally:
        delete_user(user.id)


@_db_required
def test_refresh_with_expired_but_valid_signature_returns_401(client: TestClient, admin_creds):
    """签名有效但已过期的 refresh token -> 401（而非 500）"""
    from app.auth.jwt_handler import SECRET_KEY, ALGORITHM
    from jose import jwt as _jwt

    username, password = admin_creds
    user_id = 1
    now = datetime.now(timezone.utc)
    payload = {
        "user_id": user_id,
        "username": username,
        "role": "admin",
        "type": "refresh",
        "iat": int((now - timedelta(days=8)).timestamp()),
        "exp": int((now - timedelta(days=1)).timestamp()),  # 已过期
    }
    expired_token = _jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

    resp = client.post("/api/auth/refresh", json={"refresh_token": expired_token})
    assert resp.status_code == 401
