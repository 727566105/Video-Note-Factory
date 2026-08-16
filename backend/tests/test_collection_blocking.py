"""合集生成接口不得阻塞事件循环

回归：generate_summary 曾为 async 路由却同步调用 LLM（gpt.summarize），
生成期间整个 FastAPI 事件循环被阻塞，其他合集的详情请求排队不响应，
前端表现为打开其他合集一直转圈。修复为同步路由（FastAPI 线程池执行）后，
生成期间其他请求必须保持响应。
"""
import asyncio
import time

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.auth.dependencies import get_current_user
from app.db.engine import get_db
from app.routers import collection as collection_routes
from app.services import collection as collection_svc


class _FakeUser:
    id = 1


def _build_app(monkeypatch) -> FastAPI:
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

    monkeypatch.setattr(collection_svc, "generate_collection_summary", slow_generate)
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
