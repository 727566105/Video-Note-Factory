import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.routers import auth, note

# 尝试初始化数据库，失败则跳过数据库相关测试
_db_ready = False
try:
    from app.db.init_db import init_db
    init_db()
    _db_ready = True
except Exception:
    pass


def _db_required(func):
    """标记需要数据库的测试，数据库不可用时跳过"""
    return pytest.mark.skipif(not _db_ready, reason="数据库未初始化")(func)


@pytest.fixture
def app():
    """创建测试用 FastAPI 应用"""
    _app = FastAPI()
    _app.include_router(auth.router, prefix="/api/auth")
    _app.include_router(note.router, prefix="/api")
    return _app


@pytest.fixture
def client(app):
    return TestClient(app)


def _get_token(client: TestClient, username: str, password: str) -> str:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    data = resp.json()
    if data.get("code") != 0:
        return None
    return data["data"]["token"]


@pytest.fixture
def admin_token(client):
    return _get_token(client, "admin", "123456")


@pytest.fixture
def user_token(client):
    return _get_token(client, "bin", "123456")
