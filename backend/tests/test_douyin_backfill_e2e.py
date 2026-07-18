"""抖音历史回溯 + _fetch_job 端到端集成测试

用 mock fetcher 模拟完整 _fetch_job 流程，覆盖：
- 首次定时刷新（含回溯初始化）
- 博主发新作品 -> 第二次定时刷新（含新作品检测 + 回溯拉历史）
- RSSHub 图文错误不影响视频回溯（video_error 隔离）
- complete 状态不重复回溯
- 回溯在 auto_generate 之后执行（新作品笔记不被推迟）
"""
from datetime import datetime
from unittest.mock import patch, MagicMock

import pytest

from app.db.subscription_dao import (
    add_subscription, remove_subscription, get_subscription_by_id,
    update_fetch_result,
)
from app.db.channel_video_dao import (
    get_or_create_fetch_status, upsert_channel_videos,
    count_channel_videos,
)
from app.db.engine import get_db
from app.db.models.subscriptions import FeedItem, Subscription
from app.db.models.channel_video import ChannelVideo, ChannelFetchStatus
from app.services.channel_fetcher import FetchResult


# ── 辅助 ──

@pytest.fixture
def douyin_sub():
    """创建一个抖音测试订阅，用唯一标识避免污染"""
    pid = "test_e2e_douyin_sec_uid_001"
    sub = add_subscription(
        user_id=1, channel_url=f"https://test.com/e2e-douyin/{pid}",
        platform="douyin", channel_name="E2E测试博主", platform_id=pid,
    )
    # 清理可能残留的 channel_videos + fetch_status + feed_items
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(subscription_id=sub.id).delete()
        db.query(ChannelVideo).filter_by(platform="douyin", platform_id=pid).delete()
        db.query(ChannelFetchStatus).filter_by(platform="douyin", platform_id=pid).delete()
        s = db.query(Subscription).filter_by(id=sub.id).first()
        if s:
            s.last_content_id = None
            s.last_fetch_status = None
            s.auto_generate = 0
        db.commit()
    finally:
        db.close()
    yield sub
    # 清理
    try:
        remove_subscription(sub.id, 1)
    except Exception:
        pass
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(subscription_id=sub.id).delete()
        db.query(ChannelVideo).filter_by(platform="douyin", platform_id=pid).delete()
        db.query(ChannelFetchStatus).filter_by(platform="douyin", platform_id=pid).delete()
        db.commit()
    finally:
        db.close()


def _make_fetch_result(items, video_error=None, article_error=None):
    """构造 FetchResult，模拟 fetch_all_for_subscription 的返回"""
    errors = []
    if video_error:
        errors.append(f"视频: {video_error}")
    if article_error:
        errors.append(f"图文: {article_error}")
    combined = "; ".join(errors) if errors else None
    return FetchResult(items=items, error=combined, video_error=video_error)


# ── 测试：回溯在 auto_generate 之后执行 ──

def test_backfill_runs_after_auto_generate(douyin_sub):
    """_fetch_job 中 auto_generate 应在回溯之前执行（点1：不推迟笔记生成）"""
    from app.tasks.subscription_scheduler import SubscriptionScheduler

    # 开启 auto_generate
    db = next(get_db())
    s = db.query(Subscription).filter_by(id=douyin_sub.id).first()
    s.auto_generate = 1
    db.commit()
    db.close()

    call_order = []

    # mock fetch_all_for_subscription 返回新作品
    new_item = {
        "content_id": "e2e_new_001", "content_type": "video",
        "content_url": "https://douyin.com/video/e2e_new_001",
        "user_id": 1, "subscription_id": douyin_sub.id, "platform": "douyin",
    }
    # 先把新作品灌进 channel_videos（_fetch_job 会从中查）
    upsert_channel_videos([new_item], "douyin", douyin_sub.platform_id)

    with patch("app.tasks.subscription_scheduler.fetch_all_for_subscription") as mock_fetch, \
         patch.object(SubscriptionScheduler, "_auto_generate_notes") as mock_auto, \
         patch.object(SubscriptionScheduler, "_backfill_douyin_history") as mock_back:
        mock_fetch.return_value = _make_fetch_result([new_item])
        mock_auto.side_effect = lambda *a, **kw: call_order.append("auto_generate")
        mock_back.side_effect = lambda *a, **kw: call_order.append("backfill")

        scheduler = SubscriptionScheduler.__new__(SubscriptionScheduler)
        scheduler._fetch_job(douyin_sub.id, "douyin", douyin_sub.platform_id, "E2E测试博主")

    # auto_generate 应在 backfill 之前
    assert "auto_generate" in call_order, "auto_generate 未被调用"
    assert "backfill" in call_order, "backfill 未被调用"
    assert call_order.index("auto_generate") < call_order.index("backfill"), \
        f"auto_generate 应在 backfill 之前，实际顺序: {call_order}"


# ── 测试：RSSHub 图文错误不影响视频回溯 ──

def test_rsshub_error_does_not_skip_backfill(douyin_sub):
    """图文 RSSHub 抖动报错时，视频回溯不应被跳过（点2：video_error 隔离）"""
    from app.tasks.subscription_scheduler import SubscriptionScheduler

    backfill_called = []

    with patch("app.tasks.subscription_scheduler.fetch_all_for_subscription") as mock_fetch, \
         patch.object(SubscriptionScheduler, "_backfill_douyin_history") as mock_back:
        # 视频成功，图文 RSSHub 报错 -> combined_error 非空但 video_error 为 None
        mock_fetch.return_value = _make_fetch_result(
            items=[], video_error=None, article_error="RSSHub 连接超时"
        )
        mock_back.side_effect = lambda *a, **kw: backfill_called.append(True)

        scheduler = SubscriptionScheduler.__new__(SubscriptionScheduler)
        scheduler._fetch_job(douyin_sub.id, "douyin", douyin_sub.platform_id, "E2E测试博主")

    assert len(backfill_called) == 1, f"RSSHub 报错不应跳过回溯，backfill 调用次数={len(backfill_called)}"


def test_video_error_skips_backfill(douyin_sub):
    """视频拉取失败时，回溯应被跳过"""
    from app.tasks.subscription_scheduler import SubscriptionScheduler

    backfill_called = []

    with patch("app.tasks.subscription_scheduler.fetch_all_for_subscription") as mock_fetch, \
         patch.object(SubscriptionScheduler, "_backfill_douyin_history") as mock_back:
        mock_fetch.return_value = _make_fetch_result(
            items=[], video_error="抖音 Cookie 已过期"
        )
        mock_back.side_effect = lambda *a, **kw: backfill_called.append(True)

        scheduler = SubscriptionScheduler.__new__(SubscriptionScheduler)
        scheduler._fetch_job(douyin_sub.id, "douyin", douyin_sub.platform_id, "E2E测试博主")

    assert len(backfill_called) == 0, "视频失败时应跳过回溯"


# ── 测试：complete 状态不重复回溯 ──

def test_complete_status_skips_backfill(douyin_sub):
    """fetch_status=complete 时回溯直接 return"""
    # 标记为 complete
    status = get_or_create_fetch_status("douyin", douyin_sub.platform_id)
    from app.db.channel_video_dao import update_fetch_status
    update_fetch_status("douyin", douyin_sub.platform_id, fetch_status="complete")

    db = next(get_db())
    before = db.query(ChannelVideo).filter_by(
        platform="douyin", platform_id=douyin_sub.platform_id
    ).count()
    db.close()

    from app.tasks.subscription_scheduler import SubscriptionScheduler
    scheduler = SubscriptionScheduler.__new__(SubscriptionScheduler)
    # 直接调回溯（不 mock fetcher，因为 complete 应在调 API 前就 return）
    scheduler._backfill_douyin_history(douyin_sub, douyin_sub.platform_id)

    db = next(get_db())
    after = db.query(ChannelVideo).filter_by(
        platform="douyin", platform_id=douyin_sub.platform_id
    ).count()
    db.close()
    assert before == after, "complete 状态不应拉取任何新数据"


# ── 测试：_fetch_job 可观测性回写（含 video_error 场景）──

def test_fetch_job_writes_cookie_expired_status(douyin_sub):
    """视频 Cookie 失效时，_fetch_job 应写 cookie_expired 状态"""
    from app.tasks.subscription_scheduler import SubscriptionScheduler

    with patch("app.tasks.subscription_scheduler.fetch_all_for_subscription") as mock_fetch, \
         patch.object(SubscriptionScheduler, "_backfill_douyin_history"):
        mock_fetch.return_value = _make_fetch_result(
            items=[], video_error="抖音 Cookie 已过期，请在设置页重新配置"
        )
        scheduler = SubscriptionScheduler.__new__(SubscriptionScheduler)
        scheduler._fetch_job(douyin_sub.id, "douyin", douyin_sub.platform_id, "E2E测试博主")

    sub = get_subscription_by_id(douyin_sub.id)
    assert sub.last_fetch_status == "cookie_expired"
    assert "Cookie" in (sub.last_fetch_error or "")


# ── 测试：并发回溯锁（同一 platform_id 不并发）──

def test_backfill_lock_prevents_concurrent_same_platform(douyin_sub):
    """同一 platform_id 的回溯不应并发（应用层锁）"""
    import threading
    from app.tasks.subscription_scheduler import _get_backfill_lock

    lock = _get_backfill_lock(douyin_sub.platform_id)
    # 持有锁
    acquired = lock.acquire(timeout=0.1)
    assert acquired, "应能获取锁"

    try:
        # 另一个线程尝试获取同一把锁应超时
        result = []
        def try_acquire():
            l = _get_backfill_lock(douyin_sub.platform_id)
            r = l.acquire(timeout=0.2)
            result.append(r)
            if r:
                l.release()

        t = threading.Thread(target=try_acquire)
        t.start()
        t.join(timeout=1)
        assert len(result) == 1
        assert result[0] is False, "同 platform_id 应获取不到锁（已被持有）"
    finally:
        lock.release()
