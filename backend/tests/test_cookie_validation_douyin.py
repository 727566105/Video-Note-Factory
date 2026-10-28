"""抖音 Cookie 在线验证回归测试"""

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import patch

from app.routers import config as config_router
from app.routers.config import CookieTestRequest


def test_douyin_cookie_validation_sends_argus_headers():
    """抖音验证请求必须携带网关要求的 uifid 和 x-tt-argus 请求头。"""
    captured = {}

    class FakeResponse:
        status_code = 200

        headers = {"Content-Type": "application/json"}

        def json(self):
            return {"status_code": 0}

    def fake_get(url, headers=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers or {}
        return FakeResponse()

    request = CookieTestRequest(
        platform="douyin",
        cookie="ttwid=test-ttwid; sessionid=test-session; UIFID_TEMP=test-uifid",
    )

    with patch("requests.get", side_effect=fake_get):
        response = asyncio.run(
            config_router.test_downloader_cookie(request, user=SimpleNamespace(username="admin"))
        )
    result = json.loads(response.body)

    assert captured["headers"].get("uifid") == "test-uifid"
    assert captured["headers"].get("x-tt-argus") == "1"
    assert result["data"]["valid"] is True


def test_douyin_cookie_validation_handles_non_json_gateway_response():
    """安全网关返回非 JSON 时，应给出可读提示而不是暴露解析异常。"""

    class FakeResponse:
        status_code = 403
        text = "Blocked by ArgusSecurityPlugin Uifid Not Found"
        headers = {"Content-Type": "text/plain"}

        def json(self):
            raise ValueError("Expecting value: line 1 column 1 (char 0)")

    request = CookieTestRequest(
        platform="douyin",
        cookie="ttwid=test-ttwid; sessionid=test-session; UIFID=test-uifid",
    )

    with patch("requests.get", return_value=FakeResponse()):
        response = asyncio.run(
            config_router.test_downloader_cookie(request, user=SimpleNamespace(username="admin"))
        )
    result = json.loads(response.body)

    assert result["data"]["valid"] is False
    assert "解析" not in result["data"]["message"]
    assert "Expecting value" not in result["data"]["message"]
    assert result["data"]["details"]
