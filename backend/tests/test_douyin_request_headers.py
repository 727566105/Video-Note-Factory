"""抖音业务 API 请求头回归测试"""

import os
import tempfile
from unittest.mock import patch

from app.downloaders.douyin_downloader import (
    DouyinDownloader,
    build_douyin_request_headers,
)
from app.services.cookie_manager import CookieConfigManager
from app.services import douyin_api


def test_build_douyin_request_headers_adds_argus_fields():
    """抖音业务 API 必须携带网关校验的 uifid 和 x-tt-argus。"""
    headers = build_douyin_request_headers(
        "ttwid=test-ttwid; sessionid=test-session; UIFID_TEMP=test-uifid"
    )

    assert headers["uifid"] == "test-uifid"
    assert headers["x-tt-argus"] == "1"
    assert headers["Cookie"] == "ttwid=test-ttwid; sessionid=test-session; UIFID_TEMP=test-uifid"


def test_downloader_uses_argus_headers_for_detail_api():
    """生成链路使用的下载器应携带同一组 Argus 请求头。"""
    tmpdir = tempfile.mkdtemp()
    config_path = os.path.join(tmpdir, "downloader.json")
    try:
        cfm = CookieConfigManager(filepath=config_path)
        cfm.set("douyin", "ttwid=test-ttwid; sessionid=test-session; UIFID=test-uifid")
        with patch("app.downloaders.douyin_downloader.cfm", cfm):
            downloader = DouyinDownloader()

        assert downloader.headers_config["uifid"] == "test-uifid"
        assert downloader.headers_config["x-tt-argus"] == "1"
    finally:
        os.remove(config_path)
        os.rmdir(tmpdir)


def test_subscription_api_uses_argus_headers():
    """订阅拉取链路也应复用同一组抖音 API 请求头。"""
    tmpdir = tempfile.mkdtemp()
    config_path = os.path.join(tmpdir, "downloader.json")
    captured = {}

    class FakeResponse:
        def json(self):
            return {"status_code": 0, "aweme_list": [], "has_more": False}

    def fake_get(url, headers=None, timeout=None):
        captured["headers"] = headers or {}
        return FakeResponse()

    try:
        cfm = CookieConfigManager(filepath=config_path)
        cfm.set("douyin", "ttwid=test-ttwid; sessionid=test-session; UIFID=test-uifid")
        with patch.object(douyin_api, "_get_cookie_manager", return_value=cfm), \
             patch.object(douyin_api, "_gen_ms_token", return_value="test-ms-token"), \
             patch("requests.get", side_effect=fake_get):
            douyin_api.fetch_douyin_user_videos("test-sec-uid", max_pages=1)

        assert captured["headers"]["uifid"] == "test-uifid"
        assert captured["headers"]["x-tt-argus"] == "1"
    finally:
        os.remove(config_path)
        os.rmdir(tmpdir)
