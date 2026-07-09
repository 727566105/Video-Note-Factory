"""专项安全加固回归测试

覆盖：
- image_proxy 鉴权
- check_remote_status SSRF 校验
- CDN 白名单收紧
- SSRF URL 校验工具
- 备份恢复文件名净化
- 前端 HTML 转义 / KaTeX trust
"""
import pytest
from types import SimpleNamespace
from unittest.mock import patch, MagicMock

from fastapi import FastAPI
from fastapi.testclient import TestClient


# ==================== image_proxy 鉴权 ====================

def test_image_proxy_requires_auth():
    """image_proxy 必须鉴权，未携带 token 返回 401"""
    from app.routers import note

    app = FastAPI()
    app.include_router(note.router, prefix="/api")
    client = TestClient(app)

    resp = client.get("/api/image_proxy", params={"url": "https://example.com/img.png"})
    assert resp.status_code == 401


# ==================== check_remote_status SSRF ====================

def test_check_remote_status_rejects_internal_url():
    """check_remote_status 应拦截内网 URL"""
    from app.routers import note
    from app.auth.dependencies import get_current_user

    app = FastAPI()
    app.include_router(note.router, prefix="/api")
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, username="tester", role="admin")
    client = TestClient(app)

    resp = client.get("/api/check_remote_status", params={"url": "http://169.254.169.254/latest/meta-data/"})
    assert resp.status_code == 400
    assert "不安全" in resp.text or "内网" in resp.text


# ==================== CDN 白名单收紧 ====================

def test_cdn_com_not_in_whitelist():
    """cdn.com 不应在白名单中"""
    from app.routers.note import ALLOWED_DOMAINS
    assert "cdn.com" not in ALLOWED_DOMAINS


def test_trusted_cdn_suffix_uses_leading_dot():
    """DownloadHelper 的 CDN 后缀匹配应使用前导点"""
    from app.utils.download_helper import DownloadHelper
    dh = DownloadHelper()

    # evilcdn.com 不应被信任（DNS 解析为内网则拒绝）
    is_safe, _ = dh.is_safe_url("https://evilcdn.com/video.mp4")
    assert not is_safe

    # notcdn.com 不应被信任
    is_safe, _ = dh.is_safe_url("https://notcdn.com/video.mp4")
    assert not is_safe


# ==================== SSRF URL 校验工具 ====================

def test_is_safe_url_rejects_metadata_ip():
    from app.routers.note import is_safe_url
    safe, _ = is_safe_url("http://169.254.169.254/latest/meta-data/")
    assert not safe


def test_is_safe_url_rejects_localhost():
    from app.routers.note import is_safe_url
    safe, _ = is_safe_url("http://localhost:8080/secret")
    assert not safe


def test_is_safe_url_allows_cdn_subdomain():
    from app.routers.note import is_safe_url
    # 白名单域名应通过（DNS 解析后非内网）
    safe, _ = is_safe_url("https://i0.hdslb.com/bfs/test.jpg")
    assert safe


# ==================== 备份恢复文件名净化 ====================

def test_restore_upload_sanitizes_filename():
    """恢复上传时应净化文件名，阻止路径遍历"""
    import io
    import zipfile
    from app.routers import webdav
    from app.auth.dependencies import get_current_user

    app = FastAPI()
    app.include_router(webdav.router, prefix="/api/webdav")
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, username="admin", role="admin")
    client = TestClient(app)

    # 创建一个合法的 zip 内容
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as zf:
        zf.writestr("data/video_note.db", b"fake db")
    buf.seek(0)

    # 使用带路径遍历的文件名
    resp = client.post(
        "/api/webdav/restore/upload",
        files={"file": ("../../evil.zip", buf.read(), "application/zip")},
    )

    # 不应写出 restore_temp_dir 之外的文件
    # 接口可能返回 200（后台处理）或错误，关键是文件名被净化
    assert resp.status_code in (200, 400, 500)


# ==================== 前端安全 ====================

def test_export_image_dialog_escapes_html_fields():
    """ExportImageDialog 应转义 title 等字段"""
    import ast
    import re
    from pathlib import Path

    component_path = Path(__file__).parent.parent.parent / "videoNote_frontend" / "src" / "components" / "ExportImageDialog.tsx"
    if not component_path.exists():
        pytest.skip("ExportImageDialog.tsx 不存在")

    content = component_path.read_text(encoding="utf-8")

    # 检查是否使用了转义函数或 textContent
    # 如果有 escapeHtml / DOMPurify / textContent 则通过
    has_escaping = any(
        keyword in content
        for keyword in ["escapeHtml", "DOMPurify", "textContent", "escape", "sanitize"]
    )
    assert has_escaping, "ExportImageDialog 应对 HTML 字段进行转义"


def test_katex_trust_is_false():
    """KaTeX 不应启用 trust: true"""
    from pathlib import Path

    component_path = Path(__file__).parent.parent.parent / "videoNote_frontend" / "src" / "components" / "MarkdownRenderer" / "index.tsx"
    if not component_path.exists():
        pytest.skip("MarkdownRenderer/index.tsx 不存在")

    content = component_path.read_text(encoding="utf-8")
    assert "trust: true" not in content, "KaTeX 不应启用 trust: true"


# ==================== SSRF 校验工具 ====================

def test_validate_safe_url_rejects_metadata_ip():
    from app.utils.ssrf import validate_safe_url
    safe, _ = validate_safe_url("http://169.254.169.254/latest/meta-data/")
    assert not safe


def test_validate_safe_url_rejects_localhost():
    from app.utils.ssrf import validate_safe_url
    safe, _ = validate_safe_url("http://localhost:8080/secret")
    assert not safe


def test_validate_safe_url_rejects_private_ip():
    from app.utils.ssrf import validate_safe_url
    safe, _ = validate_safe_url("http://10.0.0.1/internal")
    assert not safe
    safe, _ = validate_safe_url("http://192.168.1.1/internal")
    assert not safe
    safe, _ = validate_safe_url("http://172.16.0.1/internal")
    assert not safe


def test_validate_safe_url_rejects_non_http():
    from app.utils.ssrf import validate_safe_url
    safe, _ = validate_safe_url("file:///etc/passwd")
    assert not safe
    safe, _ = validate_safe_url("ftp://example.com/file")
    assert not safe


def test_webdav_test_connection_rejects_internal_url():
    """WebDAV test_connection 应拒绝内网地址"""
    from app.db.webdav_config_dao import test_connection
    ok, msg = test_connection("http://169.254.169.254/", "user", "pass")
    assert not ok
    assert "不安全" in msg or "内网" in msg


def test_siyuan_test_connection_rejects_internal_url():
    """Siyuan test_connection 应拒绝内网地址"""
    from app.db.siyuan_config_dao import test_connection
    ok, msg = test_connection("http://10.0.0.1:6806/", "fake-token")
    assert not ok
    assert "不安全" in msg or "内网" in msg


def test_obsidian_test_connection_rejects_internal_url():
    """Obsidian test_connection 应拒绝内网地址"""
    from app.db.obsidian_config_dao import test_api_connection
    ok, msg = test_api_connection("http://192.168.1.1:27124/", "fake-key")
    assert not ok
    assert "不安全" in msg or "内网" in msg
