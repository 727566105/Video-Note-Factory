"""Cookie 端点权限测试

验证 update_downloader_cookie / test_downloader_cookie / get_downloader_cookie
三个端点的鉴权行为：
- 未登录 -> 401
- 普通用户 -> 403（仅管理员可操作 Cookie）
- 管理员 -> 允许访问

依赖数据库环境（需要 admin/bin 用户 + bcrypt），不可用时跳过。
"""
import pytest
from fastapi.testclient import TestClient

_db_ok = False
try:
    from app.db.init_db import init_db
    init_db()
    from app.db.user_dao import hash_password
    hash_password("test")
    _db_ok = True
except Exception:
    pass


@pytest.fixture
def app():
    """创建测试用 FastAPI 应用"""
    from fastapi import FastAPI
    from app.routers import auth, config
    _app = FastAPI()
    _app.include_router(auth.router, prefix="/api/auth")
    _app.include_router(config.router, prefix="/api")
    return _app


@pytest.fixture
def client(app):
    return TestClient(app)


def _get_token(client: TestClient, username: str, password: str):
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    data = resp.json()
    if data.get("code") != 0:
        return None
    return data.get("data", {}).get("token")


@pytest.fixture
def admin_token(client):
    return _get_token(client, "admin", "123456")


@pytest.fixture
def user_token(client):
    return _get_token(client, "bin", "123456")


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


@pytest.mark.skipif(not _db_ok, reason="数据库或 bcrypt 不可用")
class TestCookieEndpointAuth:
    """Cookie 端点权限：未登录 401，普通用户 403，管理员可访问"""

    # ── update_downloader_cookie ──────────────────────────────

    def test_no_auth_update_cookie_returns_401(self, client):
        """未登录推送 Cookie -> 401"""
        resp = client.post("/api/update_downloader_cookie", json={
            "platform": "bilibili",
            "cookie": "SESSDATA=test"
        })
        assert resp.status_code == 401

    def test_normal_user_cannot_update_cookie(self, client, user_token):
        """普通用户推送 Cookie -> 403"""
        if not user_token:
            pytest.skip("bin 用户不可用")
        resp = client.post(
            "/api/update_downloader_cookie",
            json={"platform": "bilibili", "cookie": "SESSDATA=test_value_123"},
            headers=_auth_headers(user_token),
        )
        assert resp.status_code == 403

    def test_admin_can_update_cookie(self, client, admin_token):
        """管理员推送 Cookie -> 成功"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.post(
            "/api/update_downloader_cookie",
            json={"platform": "douyin", "cookie": "sessionid=test_admin"},
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

    # ── get_downloader_cookie ─────────────────────────────────

    def test_no_auth_get_cookie_returns_401(self, client):
        """未登录读取 Cookie -> 401"""
        resp = client.get("/api/get_downloader_cookie/bilibili")
        assert resp.status_code == 401

    def test_normal_user_cannot_get_cookie(self, client, user_token):
        """普通用户读取 Cookie -> 403"""
        if not user_token:
            pytest.skip("bin 用户不可用")
        resp = client.get(
            "/api/get_downloader_cookie/bilibili",
            headers=_auth_headers(user_token),
        )
        assert resp.status_code == 403

    def test_admin_can_get_cookie(self, client, admin_token):
        """管理员读取 Cookie -> 成功"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.get(
            "/api/get_downloader_cookie/bilibili",
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200

    # ── test_downloader_cookie ────────────────────────────────

    def test_no_auth_test_cookie_returns_401(self, client):
        """未登录校验 Cookie -> 401"""
        resp = client.post("/api/test_downloader_cookie", json={
            "platform": "bilibili",
            "cookie": "SESSDATA=test"
        })
        assert resp.status_code == 401

    def test_normal_user_cannot_test_cookie(self, client, user_token):
        """普通用户校验 Cookie -> 403"""
        if not user_token:
            pytest.skip("bin 用户不可用")
        resp = client.post(
            "/api/test_downloader_cookie",
            json={"platform": "bilibili", "cookie": ""},
            headers=_auth_headers(user_token),
        )
        assert resp.status_code == 403

    def test_admin_can_test_cookie_empty(self, client, admin_token):
        """管理员校验空 Cookie -> 返回 valid:false"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.post(
            "/api/test_downloader_cookie",
            json={"platform": "bilibili", "cookie": ""},
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert data["data"]["valid"] is False

    def test_admin_can_test_cookie_unsupported_platform(self, client, admin_token):
        """管理员校验不支持的平台 -> 返回 valid:false"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.post(
            "/api/test_downloader_cookie",
            json={"platform": "unknown_platform", "cookie": "foo=bar"},
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["valid"] is False

    # ── update_downloader_cookie 输入校验（管理员） ─────────────

    def test_update_cookie_html_rejected(self, client, admin_token):
        """推送含 HTML 的 Cookie -> 返回错误（不崩溃）"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.post(
            "/api/update_downloader_cookie",
            json={"platform": "bilibili", "cookie": "<script>alert(1)</script>"},
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] != 0
        assert "HTML" in data["msg"]

    def test_update_cookie_empty_value(self, client, admin_token):
        """推送空 Cookie -> 成功（清空该平台 cookie）"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.post(
            "/api/update_downloader_cookie",
            json={"platform": "bilibili", "cookie": ""},
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200
        assert resp.json()["code"] == 0

    def test_update_cookie_whitespace_only(self, client, admin_token):
        """推送纯空白 Cookie -> 成功（strip 后为空）"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.post(
            "/api/update_downloader_cookie",
            json={"platform": "bilibili", "cookie": "   "},
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200

    # ── test_downloader_cookie 非法字符（管理员） ────────────────

    def test_test_cookie_non_ascii_rejected(self, client, admin_token):
        """校验含中文/非 ASCII 字符的 Cookie -> 返回 valid:false"""
        if not admin_token:
            pytest.skip("admin 用户不可用")
        resp = client.post(
            "/api/test_downloader_cookie",
            json={"platform": "bilibili", "cookie": "SESSDATA=测试中文cookie"},
            headers=_auth_headers(admin_token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["data"]["valid"] is False
