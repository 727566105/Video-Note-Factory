import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from jose import JWTError


def test_default_admin_password_policy_rejects_known_weak_values():
    from app.db import user_dao

    assert user_dao.is_insecure_default_admin_password(None)
    assert user_dao.is_insecure_default_admin_password("")
    assert user_dao.is_insecure_default_admin_password("123456")
    assert user_dao.is_insecure_default_admin_password("change_me_on_first_login")
    assert not user_dao.is_insecure_default_admin_password("Stronger-Admin-Password-2026")


def test_seed_default_user_production_requires_strong_password(monkeypatch):
    from app.db import user_dao

    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("DEFAULT_ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("PYTEST_CURRENT_TEST", raising=False)

    class FakeQuery:
        def filter_by(self, **kwargs):
            return self

        def first(self):
            return None

    class FakeDb:
        def query(self, model):
            return FakeQuery()

        def rollback(self):
            pass

        def close(self):
            pass

    def fake_get_db():
        yield FakeDb()

    monkeypatch.setattr(user_dao, "get_db", fake_get_db)

    with pytest.raises(RuntimeError, match="DEFAULT_ADMIN_PASSWORD"):
        user_dao.seed_default_user()


def test_seed_default_user_does_not_log_plaintext_password(monkeypatch, caplog):
    from app.db import user_dao

    password = "Stronger-Admin-Password-2026"
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("DEFAULT_ADMIN_PASSWORD", password)

    class FakeQuery:
        def filter_by(self, **kwargs):
            return self

        def first(self):
            return None

    class FakeDb:
        def query(self, model):
            return FakeQuery()

        def add(self, obj):
            pass

        def commit(self):
            pass

        def rollback(self):
            pass

        def close(self):
            pass

    def fake_get_db():
        yield FakeDb()

    monkeypatch.setattr(user_dao, "get_db", fake_get_db)
    user_dao.seed_default_user()

    assert password not in caplog.text
    assert f"admin/{password}" not in caplog.text


def test_login_rate_limiter_locks_after_repeated_failures():
    from app.auth.rate_limiter import LoginRateLimiter

    limiter = LoginRateLimiter(max_failures=2, lock_seconds=60)
    assert limiter.is_allowed("alice", "127.0.0.1")
    limiter.record_failure("alice", "127.0.0.1")
    assert limiter.is_allowed("alice", "127.0.0.1")
    limiter.record_failure("alice", "127.0.0.1")

    assert not limiter.is_allowed("alice", "127.0.0.1")
    assert limiter.is_allowed("alice", "127.0.0.2")
    assert limiter.is_allowed("bob", "127.0.0.1")

    limiter.record_success("alice", "127.0.0.1")
    assert limiter.is_allowed("alice", "127.0.0.1")


def test_uploaded_path_resolver_rejects_paths_outside_uploads(tmp_path):
    from app.utils.upload_path import resolve_uploaded_file_path

    uploads = tmp_path / "uploads"
    uploads.mkdir()
    allowed = uploads / "video.mp4"
    allowed.write_text("ok")

    assert resolve_uploaded_file_path("/uploads/video.mp4", uploads).resolve() == allowed.resolve()

    with pytest.raises(ValueError):
        resolve_uploaded_file_path("/etc/passwd", uploads)
    with pytest.raises(ValueError):
        resolve_uploaded_file_path("/uploads/../secret.mp4", uploads)

    outside = tmp_path / "outside.mp4"
    outside.write_text("secret")
    symlink = uploads / "escape.mp4"
    symlink.symlink_to(outside)
    with pytest.raises(ValueError):
        resolve_uploaded_file_path("/uploads/escape.mp4", uploads)


def test_upload_rejects_oversized_stream_and_removes_partial_file(monkeypatch, tmp_path):
    from app.auth.dependencies import get_current_user
    from app.routers import note

    monkeypatch.setattr(note, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(note, "MAX_FILE_SIZE", 3)

    app = FastAPI()
    app.include_router(note.router, prefix="/api")
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1, username="tester", role="admin")
    client = TestClient(app)

    resp = client.post("/api/upload", files={"file": ("big.mp4", b"1234", "video/mp4")})

    assert resp.status_code == 413
    assert list(tmp_path.iterdir()) == []


def test_token_issued_before_password_change_is_rejected():
    from app.auth.jwt_handler import create_access_token
    from app.auth.dependencies import ensure_token_not_revoked

    token = create_access_token({"user_id": 1, "username": "alice", "role": "user"})
    user = SimpleNamespace(password_changed_at=datetime.now(timezone.utc) + timedelta(seconds=1))

    with pytest.raises(JWTError):
        ensure_token_not_revoked(token, user)
