"""合集生成接口不得阻塞事件循环

回归：generate_summary 曾为 async 路由却同步调用 LLM（gpt.summarize），
生成期间整个 FastAPI 事件循环被阻塞，其他合集的详情请求排队不响应，
前端表现为打开其他合集一直转圈。修复为同步路由（FastAPI 线程池执行）后，
生成期间其他请求必须保持响应。
"""
import asyncio
import json
import threading
import time
from datetime import datetime

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user
from app.db.engine import get_db
from app.routers import collection as collection_routes
from app.services import collection as collection_svc


class _FakeUser:
    id = 1


def _build_app(monkeypatch, generate_impl=None) -> FastAPI:
    """构造只含合集路由的 app，service 替换为可控制慢速的实现，绕开真实 DB/鉴权"""
    app = FastAPI()
    # router 已自带 prefix="/api/collections"，不要再加前缀
    app.include_router(collection_routes.router)

    def slow_generate(db, collection_id, user_id, **kwargs):
        # 模拟 LLM 同步阻塞调用
        time.sleep(1.0)
        return {"id": "s1", "collection_id": collection_id}

    def fast_detail(db, collection_id, user_id):
        return {"id": collection_id, "name": "合集", "items": []}

    monkeypatch.setattr(collection_svc, "generate_collection_summary", generate_impl or slow_generate)
    monkeypatch.setattr(collection_svc, "get_collection_detail", fast_detail)

    class _FakeDB:
        def close(self):
            pass

    app.dependency_overrides[get_current_user] = lambda: _FakeUser()
    app.dependency_overrides[get_db] = lambda: iter([_FakeDB()])
    return app


def test_generate_summary_does_not_block_detail_request(monkeypatch):
    """生成总结进行中（1s），其他合集的详情请求应在 0.5s 内返回"""
    app = _build_app(monkeypatch)

    async def scenario():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            loop = asyncio.get_running_loop()
            t0 = loop.time()
            # 并发：慢速生成 + 详情读取
            gen_task = asyncio.create_task(
                ac.post("/api/collections/c1/generate_summary", json={"mode": "overview"})
            )
            # 确保生成请求已进入 handler
            await asyncio.sleep(0.05)
            detail_resp = await ac.get("/api/collections/c1")
            elapsed = loop.time() - t0
            gen_resp = await gen_task
            return detail_resp.status_code, elapsed, gen_resp.status_code

    status, elapsed, gen_status = asyncio.run(scenario())
    assert gen_status == 200
    assert status == 200
    # 详情必须在生成（1s）完成前返回：事件循环未被阻塞
    assert elapsed < 0.5, f"详情请求被生成阻塞了 {elapsed:.2f}s"


def test_generate_summary_returns_400_when_service_has_no_material(monkeypatch):
    """service 返回 None（合集为空/无可用笔记/LLM 降级失败）→ 路由 400 用户提示"""
    app = _build_app(monkeypatch, generate_impl=lambda db, cid, uid, **kw: None)

    async def scenario():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            return await ac.post("/api/collections/c1/generate_summary", json={"mode": "overview"})

    resp = asyncio.run(scenario())
    assert resp.status_code == 400
    assert "生成总结失败" in resp.json()["detail"]


def test_generate_summary_returns_500_on_unexpected_service_error(monkeypatch):
    """service 抛未预期异常（如 DB 故障）→ 路由 500，不误报 400"""
    def boom(db, collection_id, user_id, **kwargs):
        raise RuntimeError("db exploded")

    app = _build_app(monkeypatch, generate_impl=boom)

    async def scenario():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            return await ac.post("/api/collections/c1/generate_summary", json={"mode": "overview"})

    resp = asyncio.run(scenario())
    assert resp.status_code == 500
    assert "db exploded" in resp.json()["detail"]


def test_generate_summary_single_flight_runs_llm_once(monkeypatch, tmp_path):
    """同一合集并发两次生成：LLM 只调用一次，两个请求拿到相同结果（single-flight）"""
    from app.services import collection

    task = type("Task", (), {
        "task_id": "t1", "author_id": "a1", "author_name": "作者", "video_id": "v1",
        "title": "标题", "platform": "douyin", "author": "作者", "created_at": datetime(2026, 7, 12),
        "duration": None, "description": "", "tags": "{}",
    })()
    item = type("Item", (), {"task_id": "t1", "position": 1})()
    collection_obj = type("Collection", (), {"id": "c1", "user_id": 1, "name": "合集"})()

    class Query:
        def __init__(self, model): self.model = model
        def filter(self, *args): return self
        def order_by(self, *args): return self
        def all(self): return [item] if self.model is collection.CollectionItem else []
        def first(self):
            if self.model is collection.Collection:
                return collection_obj
            if self.model is collection.VideoTask:
                return task
            return None

    class DB:
        def query(self, model): return Query(model)
        def add(self, obj): pass
        def commit(self): pass
        def refresh(self, obj): pass

    note_path = tmp_path / "note.json"
    note_path.write_text(json.dumps({"markdown": "正文"}), encoding="utf-8")
    monkeypatch.setattr(collection, "find_note_file", lambda **kwargs: note_path)

    calls = {"n": 0}
    calls_lock = threading.Lock()

    class GPT:
        def summarize(self, source):
            with calls_lock:
                calls["n"] += 1
            time.sleep(0.3)
            return "# 总结"

    monkeypatch.setattr(collection, "_get_gpt", lambda *args: GPT())

    results = []

    def worker():
        results.append(collection.generate_collection_summary(DB(), "c1", 1, mode="overview"))

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    try:
        assert calls["n"] == 1, f"LLM 被调用了 {calls['n']} 次，期望 1 次"
        assert results[0] is not None and results[1] is not None
        assert results[0]["content"] == results[1]["content"] == "# 总结"
    finally:
        # 清理模块级 single-flight 状态，避免残留影响其他测试
        collection._generation_inflight.clear()
