"""登录图形验证码（渐进式）端点测试。

覆盖：
- 前 2 次失败不要求验证码（直接返回 401 用户名或密码错误）
- 第 3 次起返回 428 + data{captcha_id, image}
- 验证码错误 -> 428，且不额外累加登录失败计数
- 验证码正确 + 正确密码 -> 成功
- 验证码正确 + 错误密码 -> 401（凭据错误），并继续累加计数
- 与既有 429 锁定共存（失败 5 次锁定后即使验证码正确也 429）
"""
import pytest

from app.auth.rate_limiter import login_rate_limiter
from app.auth.captcha import CAPTCHA_REQUIRED_FAILURES

from tests.conftest import _db_required


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    """每个用例前清空全局限流器（内存 + DB），避免跨用例污染（模块级单例）。"""
    with login_rate_limiter._lock:
        login_rate_limiter._failures.clear()
    from app.db.login_failure_dao import clear_all

    clear_all()
    yield
    with login_rate_limiter._lock:
        login_rate_limiter._failures.clear()
    clear_all()


def _wrong_login(tc, **extra):
    return tc.post(
        "/api/auth/login",
        json={"username": "admin", "password": "wrong-pass", **extra},
    )


@_db_required
def test_first_failures_do_not_require_captcha(client):
    """前 CAPTCHA_REQUIRED_FAILURES 次失败不要求验证码（直接 HTTP 401）"""
    for _ in range(CAPTCHA_REQUIRED_FAILURES):
        resp = _wrong_login(client)
        # 凭据错误走 HTTPException -> 真 HTTP 401（无验证码要求）
        assert resp.status_code == 401


@_db_required
def test_after_threshold_requires_captcha(client):
    """达到阈值后返回 428 + 验证码数据"""
    for _ in range(CAPTCHA_REQUIRED_FAILURES):
        _wrong_login(client)
    resp = _wrong_login(client)
    body = resp.json()
    assert body["code"] == 428
    assert body["msg"] == "请输入图形验证码"
    assert body["data"]["captcha_id"]
    assert body["data"]["image"]


@_db_required
def test_wrong_captcha_returns_428(client):
    """验证码错误 -> 428，且不累加登录失败计数"""
    for _ in range(CAPTCHA_REQUIRED_FAILURES):
        _wrong_login(client)
    before = login_rate_limiter.failure_count("admin", "testclient")

    resp = _wrong_login(client, captcha_id="nonexistent", captcha_code="XXXX")
    assert resp.json()["code"] == 428
    # 验证码错误不计入登录失败计数（防验证码暴力遍历触发锁定）
    assert login_rate_limiter.failure_count("admin", "testclient") == before


@_db_required
def test_correct_captcha_with_wrong_password_returns_401(client):
    """验证码正确但密码错误 -> 401，且计数继续累加"""
    for _ in range(CAPTCHA_REQUIRED_FAILURES):
        _wrong_login(client)
    # 获取一张验证码
    c = client.get("/api/auth/captcha").json()["data"]
    before = login_rate_limiter.failure_count("admin", "testclient")

    resp = _wrong_login(
        client, captcha_id=c["captcha_id"], captcha_code="WRONG"
    )
    # 用错验证码 -> 428（不计入）
    assert resp.json()["code"] == 428
    assert login_rate_limiter.failure_count("admin", "testclient") == before

    # 用真实答案，但密码仍错 -> 真 HTTP 401 且计数 +1
    from app.auth.captcha import captcha_manager

    c2 = client.get("/api/auth/captcha").json()["data"]
    answer = captcha_manager._store[c2["captcha_id"]][0]
    resp2 = _wrong_login(
        client, captcha_id=c2["captcha_id"], captcha_code=answer
    )
    assert resp2.status_code == 401
    assert login_rate_limiter.failure_count("admin", "testclient") == before + 1


@_db_required
def test_correct_captcha_with_correct_password_success(client):
    """验证码正确 + 密码正确 -> 登录成功，计数重置"""
    username, password = "admin", "123456"
    for _ in range(CAPTCHA_REQUIRED_FAILURES):
        client.post(
            "/api/auth/login",
            json={"username": username, "password": "wrong-pass"},
        )
    # 读取真实答案
    from app.auth.captcha import captcha_manager

    c = client.get("/api/auth/captcha").json()["data"]
    answer = captcha_manager._store[c["captcha_id"]][0]

    resp = client.post(
        "/api/auth/login",
        json={
            "username": username,
            "password": password,
            "captcha_id": c["captcha_id"],
            "captcha_code": answer,
        },
    )
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["token"]
    # 成功后重置计数
    assert login_rate_limiter.failure_count(username, "testclient") == 0


@_db_required
def test_captcha_and_429_lockout_coexist(client):
    """验证码通过但密码持续错误，累计失败到 5 次仍会 429 锁定"""
    from app.auth.captcha import captcha_manager

    username = "admin"
    # 每次用正确验证码 + 错误密码累计失败（否则会被验证码门拦截，计数不涨）
    for _ in range(5):
        c = client.get("/api/auth/captcha").json()["data"]
        answer = captcha_manager._store[c["captcha_id"]][0]
        resp = client.post(
            "/api/auth/login",
            json={
                "username": username,
                "password": "wrong-pass",
                "captcha_id": c["captcha_id"],
                "captcha_code": answer,
            },
        )
        assert resp.status_code == 401  # 验证码过了，密码错 -> 累加
    # 现在被锁定
    assert login_rate_limiter.is_allowed(username, "testclient") is False
    resp = _wrong_login(client, captcha_id="x", captcha_code="y")
    assert resp.status_code == 429


@_db_required
def test_non_web_client_skips_captcha_after_threshold(client):
    """非 web 客户端（插件/Android）失败超过阈值也不要求验证码（不锁死）"""
    for _ in range(CAPTCHA_REQUIRED_FAILURES + 1):
        resp = _wrong_login(client, client="android")
        # 仍是凭据错误 401，而不是 428 验证码
        assert resp.status_code == 401


@_db_required
def test_non_web_client_can_login_with_correct_password_after_threshold(client):
    """非 web 客户端在阈值后仍可直接用正确密码登录（无需验证码）"""
    username, password = "admin", "123456"
    for _ in range(CAPTCHA_REQUIRED_FAILURES):
        client.post(
            "/api/auth/login",
            json={"username": username, "password": "wrong-pass", "client": "extension"},
        )
    resp = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "client": "extension"},
    )
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["token"]


@_db_required
def test_shared_counter_web_locks_but_nonweb_can_retry(client):
    """共享计数：web 失败触发验证码，但同一用户名用非 web 客户端仍可登录"""
    username, password = "admin", "123456"
    for _ in range(CAPTCHA_REQUIRED_FAILURES):
        _wrong_login(client)  # 默认 web，累加计数

    # web 端现在要求验证码
    web_resp = _wrong_login(client)  # 默认 web
    assert web_resp.json()["code"] == 428

    # 但同一用户名通过非 web 客户端仍可直接登录（不锁死）
    ok = client.post(
        "/api/auth/login",
        json={"username": username, "password": password, "client": "android"},
    )
    assert ok.json()["code"] == 0
