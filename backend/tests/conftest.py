import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app.routers import auth, note
from app.db.init_db import init_db

# 初始化数据库（创建表 + 种子默认用户）
init_db()


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
    assert resp.json()["code"] == 0, f"登录失败: {resp.json()}"
    return resp.json()["data"]["token"]


@pytest.fixture
def admin_token(client):
    return _get_token(client, "admin", "123456")


@pytest.fixture
def user_token(client):
    return _get_token(client, "bin", "123456")
