"""
Cookie 修复功能测试用例

验证：
1. CookieConfigManager 纯逻辑功能
2. 下载器延迟实例化（非全局单例）
3. Cookie 配置后立即生效
4. HTTP 请求携带正确的请求头
"""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

from app.services.cookie_manager import CookieConfigManager
from app.services.constant import SUPPORT_PLATFORM_MAP
from app.downloaders.douyin_downloader import DouyinDownloader
from app.downloaders.bilibili_downloader import BilibiliDownloader
from app.downloaders.xiaohongshu_downloader import XiaohongshuDownloader
from app.downloaders.base import Downloader
from app.utils.url_parser import extract_video_id, _COMMON_HEADERS


# ============================================================
# 一、CookieConfigManager 纯逻辑测试
# ============================================================

class TestCookieConfigManager:
    """CookieConfigManager 纯逻辑测试（使用临时文件，不影响生产配置）"""

    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.tmpdir, "test_downloader.json")
        self.cfm = CookieConfigManager(filepath=self.config_path)

    def teardown_method(self):
        if os.path.exists(self.config_path):
            os.remove(self.config_path)
        os.rmdir(self.tmpdir)

    # --- 1. Netscape 格式转换 ---

    def test_convert_netscape_to_browser_cookie(self):
        """Netscape 格式 cookie 应正确转换为浏览器格式"""
        netscape = (
            ".douyin.com\tTRUE\t/\tFALSE\t0\tsessionid\tabc123\n"
            ".douyin.com\tTRUE\t/\tFALSE\t0\tttwid\tdef456"
        )
        result = CookieConfigManager.convert_netscape_to_browser_cookie(netscape)
        assert "sessionid=abc123" in result
        assert "ttwid=def456" in result
        assert "; " in result

    def test_convert_browser_cookie_passthrough(self):
        """浏览器格式 cookie 应原样返回"""
        browser_cookie = "sessionid=abc123; ttwid=def456"
        result = CookieConfigManager.convert_netscape_to_browser_cookie(browser_cookie)
        assert result == browser_cookie

    def test_convert_empty_cookie(self):
        """空 cookie 应返回空字符串"""
        assert CookieConfigManager.convert_netscape_to_browser_cookie("") == ""
        assert CookieConfigManager.convert_netscape_to_browser_cookie(None) == ""

    # --- 2. 必需字段验证 ---

    def test_validate_cookie_with_required_fields(self):
        """包含所有必需字段时应返回有效"""
        self.cfm.set("douyin", "sessionid=abc123; ttwid=def456")
        is_valid, msg = self.cfm.validate_cookie("douyin", ["sessionid", "ttwid"])
        assert is_valid is True
        assert "有效" in msg

    def test_validate_cookie_missing_fields(self):
        """缺少必需字段时应返回失败并指出缺失字段"""
        self.cfm.set("douyin", "sessionid=abc123")
        is_valid, msg = self.cfm.validate_cookie("douyin", ["sessionid", "ttwid"])
        assert is_valid is False
        assert "ttwid" in msg

    def test_validate_cookie_not_configured(self):
        """未配置 cookie 时应返回失败"""
        is_valid, msg = self.cfm.validate_cookie("douyin", ["sessionid"])
        assert is_valid is False
        assert "未配置" in msg

    # --- 3. 写入和读取 ---

    def test_set_and_get_cookie(self):
        """写入后应能正确读取"""
        self.cfm.set("douyin", "sessionid=test123; ttwid=test456")
        result = self.cfm.get("douyin")
        assert result == "sessionid=test123; ttwid=test456"

    def test_cookie_auto_convert_on_set(self):
        """写入 Netscape 格式时应自动转换为浏览器格式"""
        netscape = ".douyin.com\tTRUE\t/\tFALSE\t0\tsessionid\tauto123"
        self.cfm.set("douyin", netscape)
        result = self.cfm.get("douyin")
        assert "sessionid=auto123" in result

    def test_delete_cookie(self):
        """删除后应无法读取"""
        self.cfm.set("douyin", "sessionid=abc")
        self.cfm.delete("douyin")
        assert self.cfm.get("douyin") is None

    def test_html_cookie_rejected(self):
        """包含 HTML 标签的 cookie 应被拒绝"""
        with pytest.raises(ValueError, match="HTML"):
            self.cfm.set("douyin", "<script>alert(1)</script>")

    def test_exists_check(self):
        """exists 方法应正确反映 cookie 是否存在"""
        assert self.cfm.exists("douyin") is False
        self.cfm.set("douyin", "sessionid=abc")
        assert self.cfm.exists("douyin") is True


# ============================================================
# 二、下载器实例化测试（核心修复验证）
# ============================================================

class TestDownloaderInstantiation:
    """验证下载器从全局单例改为延迟实例化的修复"""

    # --- 6. SUPPORT_PLATFORM_MAP 存储类而非实例 ---

    def test_support_platform_map_stores_classes(self):
        """SUPPORT_PLATFORM_MAP 应存储类（type），而非实例"""
        for platform, cls in SUPPORT_PLATFORM_MAP.items():
            assert isinstance(cls, type), f"{platform} 应存储类，但得到 {type(cls)}"
            assert issubclass(cls, Downloader), f"{platform} 应是 Downloader 子类"

    def test_platform_map_contains_expected_platforms(self):
        """应包含所有预期平台"""
        expected = ['youtube', 'bilibili', 'cctv', 'tiktok', 'kuaishou',
                     'douyin', 'xiaohongshu', 'local', 'local_audio']
        for p in expected:
            assert p in SUPPORT_PLATFORM_MAP, f"缺少平台: {p}"

    # --- 7. _get_downloader 每次返回新实例 ---

    def test_get_downloader_returns_new_instance(self):
        """_get_downloader 应每次返回不同的实例"""
        from app.services.note import NoteGenerator
        ng = NoteGenerator.__new__(NoteGenerator)
        dl1 = ng._get_downloader("douyin")
        dl2 = ng._get_downloader("douyin")
        assert dl1 is not dl2, "每次调用 _get_downloader 应返回不同实例"

    def test_get_downloader_returns_correct_type(self):
        """_get_downloader 应返回正确类型的下载器"""
        from app.services.note import NoteGenerator
        ng = NoteGenerator.__new__(NoteGenerator)
        assert isinstance(ng._get_downloader("douyin"), DouyinDownloader)
        assert isinstance(ng._get_downloader("bilibili"), BilibiliDownloader)
        assert isinstance(ng._get_downloader("xiaohongshu"), XiaohongshuDownloader)

    def test_get_downloader_unsupported_platform_raises(self):
        """不支持的平应抛出异常"""
        from app.services.note import NoteGenerator
        from app.exceptions.note import NoteError
        ng = NoteGenerator.__new__(NoteGenerator)
        with pytest.raises(NoteError):
            ng._get_downloader("unsupported_platform")

    # --- 8. 抖音下载器读取最新 Cookie ---

    def test_douyin_downloader_reads_latest_cookie(self):
        """抖音下载器实例化时应读取最新 Cookie"""
        tmpdir = tempfile.mkdtemp()
        config_path = os.path.join(tmpdir, "test_dl.json")
        try:
            cfm = CookieConfigManager(filepath=config_path)
            cfm.set("douyin", "sessionid=fresh_cookie_123; ttwid=fresh_ttwid")

            with patch("app.downloaders.douyin_downloader.cfm", cfm):
                dl = DouyinDownloader()
                assert dl.headers_config.get("Cookie") is not None
                assert "fresh_cookie_123" in dl.headers_config["Cookie"]
        finally:
            os.remove(config_path)
            os.rmdir(tmpdir)

    # --- 9. Cookie 更新后立即生效 ---

    def test_cookie_update_takes_effect_immediately(self):
        """配置 Cookie 后新建下载器应立即使用新 Cookie"""
        tmpdir = tempfile.mkdtemp()
        config_path = os.path.join(tmpdir, "test_immediate.json")
        try:
            cfm = CookieConfigManager(filepath=config_path)

            # 第一次：无 Cookie
            with patch("app.downloaders.douyin_downloader.cfm", cfm):
                dl_before = DouyinDownloader()
                assert dl_before.headers_config.get("Cookie") is None

            # 配置 Cookie
            cfm.set("douyin", "sessionid=immediate_test; ttwid=immediate_ttwid")

            # 第二次：应读取到新 Cookie
            with patch("app.downloaders.douyin_downloader.cfm", cfm):
                dl_after = DouyinDownloader()
                assert dl_after.headers_config.get("Cookie") is not None
                assert "immediate_test" in dl_after.headers_config["Cookie"]
        finally:
            os.remove(config_path)
            os.rmdir(tmpdir)


# ============================================================
# 三、请求头测试
# ============================================================

class TestRequestHeaders:
    """验证 HTTP 请求携带正确的请求头"""

    # --- 10. 抖音 extract_video_id 使用带 UA 的请求 ---

    @patch("app.downloaders.douyin_downloader.requests.head")
    def test_douyin_extract_video_id_uses_headers(self, mock_head):
        """extract_video_id 应发送带 User-Agent 和 Cookie 的请求"""
        mock_response = MagicMock()
        mock_response.url = "https://www.douyin.com/video/7123456789012345678"
        mock_head.return_value = mock_response

        dl = DouyinDownloader(cookie="sessionid=test123; ttwid=test456")
        dl.extract_video_id("https://v.douyin.com/test123/")

        mock_head.assert_called_once()
        call_kwargs = mock_head.call_args
        assert "headers" in call_kwargs.kwargs
        headers = call_kwargs.kwargs["headers"]
        assert "User-Agent" in headers
        assert "Cookie" in headers
        assert "test123" in headers["Cookie"]

    @patch("app.downloaders.douyin_downloader.requests.head")
    def test_douyin_extract_video_id_no_cookie_still_has_ua(self, mock_head):
        """即使无 Cookie，extract_video_id 也应携带 User-Agent"""
        mock_response = MagicMock()
        mock_response.url = "https://www.douyin.com/video/7123456789012345678"
        mock_head.return_value = mock_response

        dl = DouyinDownloader(cookie=None)
        dl.extract_video_id("https://v.douyin.com/test123/")

        call_kwargs = mock_head.call_args
        headers = call_kwargs.kwargs["headers"]
        assert "User-Agent" in headers

    # --- 11. url_parser 使用 UA ---

    @patch("app.utils.url_parser.requests.head")
    def test_url_parser_douyin_uses_headers(self, mock_head):
        """url_parser 解析抖音短链接应使用带 UA 的请求头"""
        mock_response = MagicMock()
        mock_response.url = "https://www.douyin.com/video/7123456789012345678"
        mock_head.return_value = mock_response

        extract_video_id("https://v.douyin.com/test123/", "douyin")

        mock_head.assert_called_once()
        call_kwargs = mock_head.call_args
        assert "headers" in call_kwargs.kwargs
        headers = call_kwargs.kwargs["headers"]
        assert "User-Agent" in headers
        assert headers["User-Agent"] == _COMMON_HEADERS["User-Agent"]

    @patch("app.utils.url_parser.requests.head")
    def test_url_parser_bilibili_uses_headers(self, mock_head):
        """url_parser 解析 B站短链接应使用带 UA 的请求头"""
        mock_response = MagicMock()
        mock_response.url = "https://www.bilibili.com/video/BV1test123"
        mock_head.return_value = mock_response

        extract_video_id("https://b23.tv/test123", "bilibili")

        mock_head.assert_called_once()
        call_kwargs = mock_head.call_args
        assert "headers" in call_kwargs.kwargs

    def test_url_parser_direct_url_no_http_request(self):
        """url_parser 处理直接 URL（非短链接）不应发起 HTTP 请求"""
        with patch("app.utils.url_parser.requests.head") as mock_head:
            result = extract_video_id(
                "https://www.douyin.com/video/7123456789012345678", "douyin"
            )
            mock_head.assert_not_called()
            assert result == "7123456789012345678"

    def test_url_parser_extracts_douyin_video_id(self):
        """应正确提取抖音视频 ID"""
        result = extract_video_id(
            "https://www.douyin.com/video/7123456789012345678", "douyin"
        )
        assert result == "7123456789012345678"

    def test_url_parser_extracts_douyin_note_id(self):
        """应正确提取抖音图文笔记 ID"""
        result = extract_video_id(
            "https://www.douyin.com/note/7987654321098765432", "douyin"
        )
        assert result == "7987654321098765432"

    def test_url_parser_extracts_bilibili_bvid(self):
        """应正确提取 B站 BV 号"""
        result = extract_video_id(
            "https://www.bilibili.com/video/BV1test123", "bilibili"
        )
        assert result == "BV1test123"
