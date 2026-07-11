"""图片/媒体路由认证与安全测试

固化规则：所有被 <img>/<video> 标签直接引用的静态资源路由
不应该需要 JWT 认证（因为浏览器标签无法携带自定义 header），
但必须保留路径遍历防护和 SSRF 防护。
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


@pytest.fixture
def app():
    """创建包含所有图片/媒体路由的测试 app"""
    from app.routers import note, screenshot

    _app = FastAPI()
    _app.include_router(note.router, prefix="/api")
    _app.include_router(screenshot.router)
    _app.include_router(screenshot.cover_router)
    _app.include_router(screenshot.video_router)
    _app.include_router(screenshot.media_router)
    return _app


@pytest.fixture
def client(app):
    return TestClient(app)


class TestImageRoutesNoAuth:
    """图片/媒体路由不需要认证（<img> 标签兼容）"""

    def test_image_proxy_no_auth_returns_not_401(self, client):
        """image_proxy 不带 token 不应返回 401"""
        resp = client.get("/api/image_proxy", params={"url": "https://example.com/test.jpg"})
        # 不应该是 401（可能是 200/404/400，取决于能否下载，但不能是认证失败）
        assert resp.status_code != 401, "image_proxy 不应需要认证（<img> 标签无法带 header）"

    def test_video_cover_no_auth(self, client):
        """video_cover 不带 token 不应返回 401"""
        resp = client.get("/api/video_cover/bilibili/test/test")
        assert resp.status_code != 401

    def test_video_screenshot_no_auth(self, client):
        """video_screenshots 不带 token 不应返回 401"""
        resp = client.get("/api/video_screenshots/bilibili/test/test/test.jpg")
        assert resp.status_code != 401

    def test_note_media_file_no_auth(self, client):
        """note_media_file 不带 token 不应返回 401"""
        resp = client.get("/api/note_media_file/bilibili/test/test/test.jpg")
        assert resp.status_code != 401


class TestImageProxySSRFProtection:
    """image_proxy 的 SSRF 防护必须有效"""

    def test_rejects_localhost(self, client):
        """拒绝 127.0.0.1 内网地址"""
        resp = client.get("/api/image_proxy", params={"url": "http://127.0.0.1:8483/api/health"})
        assert resp.status_code == 400

    def test_rejects_file_protocol(self, client):
        """拒绝 file:// 协议"""
        resp = client.get("/api/image_proxy", params={"url": "file:///etc/passwd"})
        assert resp.status_code == 400

    def test_rejects_javascript_protocol(self, client):
        """拒绝 javascript: 协议"""
        resp = client.get("/api/image_proxy", params={"url": "javascript:alert(1)"})
        assert resp.status_code == 400

    def test_rejects_169_internal(self, client):
        """拒绝 169.254.x.x 链路本地地址"""
        resp = client.get("/api/image_proxy", params={"url": "http://169.254.169.254/latest/meta-data/"})
        assert resp.status_code == 400

    def test_rejects_10_internal(self, client):
        """拒绝 10.x.x.x 内网地址"""
        resp = client.get("/api/image_proxy", params={"url": "http://10.0.0.1/admin"})
        assert resp.status_code == 400


class TestPathTraversalProtection:
    """路径遍历防护（screenshot 路由）"""

    def test_video_cover_rejects_dotdot(self, client):
        """video_cover 拒绝 .. 路径遍历"""
        resp = client.get("/api/video_cover/..%2F..%2Fetc/passwd/test/test")
        assert resp.status_code in (400, 404)

    def test_video_screenshot_rejects_dotdot(self, client):
        """video_screenshots 拒绝 .. 路径遍历"""
        resp = client.get("/api/video_screenshots/bilibili/..%2F..%2Fetc/passwd/test/test.jpg")
        assert resp.status_code in (400, 404)

    def test_note_media_file_rejects_dotdot(self, client):
        """note_media_file 拒绝 .. 路径遍历"""
        resp = client.get("/api/note_media_file/bilibili/test/..%2F..%2Fetc/passwd/test.jpg")
        assert resp.status_code in (400, 404)
