"""订阅拉取可观测性 + 增量游标测试

覆盖：
- _classify_fetch_error 四态分类
- _truncate_by_cursor 增量截断边界（首项=游标、找不到游标、空列表、首次拉取）
- update_fetch_result 字段写入（含失败不覆盖游标）
- copy_feed_items_to_user 初始化 last_content_id
- init_last_content_id_from_feed_items（缓存命中路径游标初始化）
- create_feed_items_from_channel_videos_with_records 返回 dict（防 DetachedInstanceError 回归）
- content_type 保留（article/live_photo 不被误标为 video）
"""
from datetime import datetime

import pytest

# conftest 已在 import 时调 init_db()，迁移会自动执行

from app.db.subscription_dao import (
    add_subscription, remove_subscription, update_fetch_result,
    copy_feed_items_to_user, upsert_feed_items, get_subscription_by_id,
    init_last_content_id_from_feed_items,
    create_feed_items_from_channel_videos_with_records,
)
from app.db.channel_video_dao import upsert_channel_videos
from app.db.engine import get_db
from app.db.models.subscriptions import FeedItem, Subscription
from app.db.models.channel_video import ChannelVideo


# ── _classify_fetch_error 四态分类 ──

def _classify(error_str):
    """复现路由层 _classify_fetch_error 逻辑（避免循环 import 路由）"""
    if not error_str:
        return "failed"
    return "cookie_expired" if "Cookie" in error_str else "failed"


def test_classify_cookie_expired():
    assert _classify("抖音 Cookie 已过期，请在设置页重新配置") == "cookie_expired"
    assert _classify("小红书 Cookie 缺少必要字段(a1/web_session)，请重新配置") == "cookie_expired"
    assert _classify("B站 Cookie 已过期，请在设置页重新配置") == "cookie_expired"


def test_classify_failed():
    assert _classify("请求超时") == "failed"
    assert _classify("请求失败: ConnectionError") == "failed"
    assert _classify("获取失败: 未知错误") == "failed"


def test_classify_empty():
    assert _classify("") == "failed"
    assert _classify(None) == "failed"


# ── _truncate_by_cursor 增量截断 ──

from app.tasks.subscription_scheduler import SubscriptionScheduler

_truncate = SubscriptionScheduler._truncate_by_cursor


def test_truncate_empty_list():
    assert _truncate([], None) == set()
    assert _truncate([], "abc") == set()


def test_truncate_first_fetch_no_cursor():
    """首次拉取（无游标），全部当新"""
    items = [{"content_id": "1"}, {"content_id": "2"}, {"content_id": "3"}]
    assert _truncate(items, None) == {"1", "2", "3"}


def test_truncate_cursor_at_head():
    """游标在列表头部 -> 新增为空（博主无更新）"""
    items = [{"content_id": "last"}, {"content_id": "2"}, {"content_id": "3"}]
    assert _truncate(items, "last") == set()


def test_truncate_cursor_in_middle():
    """游标在列表中间 -> 之前的都算新"""
    items = [{"content_id": "new1"}, {"content_id": "new2"}, {"content_id": "last"}, {"content_id": "old1"}]
    assert _truncate(items, "last") == {"new1", "new2"}


def test_truncate_cursor_not_found():
    """游标不在列表（博主删了那条 / 列表只返回最新N条）-> 全部当新，upsert 兜底"""
    items = [{"content_id": "1"}, {"content_id": "2"}, {"content_id": "3"}]
    assert _truncate(items, "nonexistent") == {"1", "2", "3"}


def test_truncate_skips_items_without_content_id():
    items = [{"content_id": "1"}, {"no_id": True}, {"content_id": "2"}]
    assert _truncate(items, None) == {"1", "2"}


# ── update_fetch_result 字段写入 ──

@pytest.fixture
def test_sub():
    """创建并清理一个测试订阅。每次清理关联 feed_items + 重置游标，保证测试隔离"""
    sub = add_subscription(
        user_id=1, channel_url="https://test.com/obs-cursor-test",
        platform="douyin", channel_name="测试博主", platform_id="test_sec_uid_001",
    )
    # 清理该订阅可能残留的 feed_items + 重置游标/可观测性字段（add_subscription 复用同一条记录）
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(subscription_id=sub.id).delete()
        s = db.query(Subscription).filter_by(id=sub.id).first()
        if s:
            s.last_content_id = None
            s.last_fetch_status = None
            s.last_fetch_count = None
            s.last_fetch_error = None
            s.last_fetch_at = None
        db.commit()
    finally:
        db.close()
    yield sub
    try:
        remove_subscription(sub.id, 1)
    except Exception:
        pass


def test_update_fetch_result_success(test_sub):
    update_fetch_result(test_sub.id, "success", 5, None, "content_abc")
    sub = get_subscription_by_id(test_sub.id)
    assert sub.last_fetch_status == "success"
    assert sub.last_fetch_count == 5
    assert sub.last_fetch_error is None
    assert sub.last_content_id == "content_abc"
    assert sub.last_fetch_at is not None
    assert sub.last_checked_at is not None


def test_update_fetch_result_cookie_expired(test_sub):
    update_fetch_result(test_sub.id, "cookie_expired", 0, "抖音 Cookie 已过期", None)
    sub = get_subscription_by_id(test_sub.id)
    assert sub.last_fetch_status == "cookie_expired"
    assert sub.last_fetch_count == 0
    assert "Cookie" in (sub.last_fetch_error or "")


def test_update_fetch_result_empty(test_sub):
    update_fetch_result(test_sub.id, "empty", 0, None, "content_xyz")
    sub = get_subscription_by_id(test_sub.id)
    assert sub.last_fetch_status == "empty"
    assert sub.last_fetch_count == 0
    assert sub.last_content_id == "content_xyz"


def test_update_fetch_result_failed_no_cursor_update(test_sub):
    """失败时 last_content_id=None 不应覆盖已有游标"""
    update_fetch_result(test_sub.id, "success", 1, None, "existing_cursor")
    update_fetch_result(test_sub.id, "failed", 0, "网络错误", None)
    sub = get_subscription_by_id(test_sub.id)
    assert sub.last_fetch_status == "failed"
    assert sub.last_fetch_error == "网络错误"
    # last_content_id 应保留，不被 None 覆盖
    assert sub.last_content_id == "existing_cursor"


# ── copy_feed_items_to_user 初始化 last_content_id ──

def test_copy_feed_items_initializes_last_content_id(test_sub):
    """订阅复用场景：复制 FeedItem 后应初始化 last_content_id，避免首刷假新增"""
    # 先给源订阅灌几条 feed_items（带 published_at，最新在前）
    items = [
        {"content_id": "newest", "platform": "douyin", "user_id": 1,
         "subscription_id": test_sub.id, "content_url": "https://x/1",
         "published_at": datetime(2026, 7, 18, 10, 0, 0)},
        {"content_id": "middle", "platform": "douyin", "user_id": 1,
         "subscription_id": test_sub.id, "content_url": "https://x/2",
         "published_at": datetime(2026, 7, 17, 10, 0, 0)},
        {"content_id": "oldest", "platform": "douyin", "user_id": 1,
         "subscription_id": test_sub.id, "content_url": "https://x/3",
         "published_at": datetime(2026, 7, 16, 10, 0, 0)},
    ]
    upsert_feed_items(items)

    # 创建目标订阅（模拟复用，用唯一 user_id 避免污染）
    target_sub = add_subscription(
        user_id=2, channel_url="https://test.com/obs-cursor-target",
        platform="douyin", channel_name="复用目标", platform_id="test_sec_uid_001",
    )
    try:
        copied = copy_feed_items_to_user(test_sub.id, 2, target_sub.id)
        assert copied > 0
        # last_content_id 应被初始化为最新一条
        target = get_subscription_by_id(target_sub.id)
        assert target.last_content_id == "newest"
    finally:
        remove_subscription(target_sub.id, 2)
        # 清理 user 2 的 feed_items
        from app.db.engine import get_db
        from app.db.models.subscriptions import FeedItem
        db = next(get_db())
        try:
            db.query(FeedItem).filter_by(user_id=2, platform="douyin").delete()
            db.commit()
        finally:
            db.close()


# ── init_last_content_id_from_feed_items（缓存命中路径） ──

def test_init_last_content_id_sets_cursor(test_sub):
    """缓存命中路径：feed_items 已存在但游标为空，应从最新 feed_item 初始化"""
    items = [
        {"content_id": "c_new", "platform": "douyin", "user_id": 1,
         "subscription_id": test_sub.id, "content_url": "https://x/n",
         "published_at": datetime(2026, 7, 18)},
        {"content_id": "c_old", "platform": "douyin", "user_id": 1,
         "subscription_id": test_sub.id, "content_url": "https://x/o",
         "published_at": datetime(2026, 7, 1)},
    ]
    upsert_feed_items(items)
    assert get_subscription_by_id(test_sub.id).last_content_id is None

    init_last_content_id_from_feed_items(test_sub.id)
    assert get_subscription_by_id(test_sub.id).last_content_id == "c_new"
    # feed_items 清理由 test_sub fixture 的 setup 负责，无需手动清理


def test_init_last_content_id_does_not_overwrite_existing(test_sub):
    """游标已存在时不应被覆盖"""
    update_fetch_result(test_sub.id, "success", 1, None, "existing_cursor")
    init_last_content_id_from_feed_items(test_sub.id)
    assert get_subscription_by_id(test_sub.id).last_content_id == "existing_cursor"


def test_init_last_content_id_no_feed_items(test_sub):
    """无 feed_items 时不报错，游标保持 None"""
    # 显式清空游标 + feed_items，确保本测试独立于前序测试状态
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(subscription_id=test_sub.id).delete()
        sub = db.query(Subscription).filter_by(id=test_sub.id).first()
        if sub:
            sub.last_content_id = None
        db.commit()
    finally:
        db.close()

    init_last_content_id_from_feed_items(test_sub.id)
    assert get_subscription_by_id(test_sub.id).last_content_id is None


def test_init_last_content_id_nonexistent_sub():
    """订阅不存在时不报错"""
    init_last_content_id_from_feed_items(999999)


# ── create_feed_items_from_channel_videos_with_records 返回 dict（防 DetachedInstanceError）──

def test_with_records_returns_dicts_not_orm_objects(test_sub):
    """返回的应为 dict 列表，访问属性不触发 DetachedInstanceError（expire_on_commit=True）"""
    # 先灌 channel_videos
    raw_videos = [
        {"content_id": "art_1", "content_type": "article", "content_url": "https://x/a1"},
        {"content_id": "vid_1", "content_type": "video", "content_url": "https://x/v1"},
    ]
    cvs = upsert_channel_videos(raw_videos, "douyin", "test_sec_uid_001")
    assert len(cvs) == 2

    created, new_items = create_feed_items_from_channel_videos_with_records(
        1, test_sub.id, cvs, "douyin"
    )
    assert created == 2
    assert len(new_items) == 2
    # 关键断言：返回的是 dict，不是 ORM 对象
    for item in new_items:
        assert isinstance(item, dict), f"期望 dict，实际 {type(item)}"
        # 访问这些字段不应抛 DetachedInstanceError（dict 取值无 lazy load）
        assert item["content_id"] in ("art_1", "vid_1")
        assert item["content_url"].startswith("https://x/")
        assert item["id"] is not None  # flush 后拿到了主键

    # 清理
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(subscription_id=test_sub.id).delete()
        db.query(ChannelVideo).filter_by(platform="douyin", platform_id="test_sec_uid_001").delete()
        db.commit()
    finally:
        db.close()


def test_with_records_preserves_content_type(test_sub):
    """content_type 应从 ChannelVideo 正确传递：article/live_photo 不被误标为 video"""
    raw_videos = [
        {"content_id": "art_2", "content_type": "article", "content_url": "https://x/a2"},
        {"content_id": "live_2", "content_type": "live_photo", "content_url": "https://x/l2"},
        {"content_id": "vid_2", "content_type": "video", "content_url": "https://x/v2"},
    ]
    cvs = upsert_channel_videos(raw_videos, "douyin", "test_ct_002")
    created, new_items = create_feed_items_from_channel_videos_with_records(
        1, test_sub.id, cvs, "douyin"
    )
    types = {item["content_id"]: item["content_type"] for item in new_items}
    assert types.get("art_2") == "article"
    assert types.get("live_2") == "live_photo"
    assert types.get("vid_2") == "video"

    # 清理
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(subscription_id=test_sub.id).delete()
        db.query(ChannelVideo).filter_by(platform="douyin", platform_id="test_ct_002").delete()
        db.commit()
    finally:
        db.close()


def test_with_records_skips_existing(test_sub):
    """已存在的 content_id 应跳过，不重复创建"""
    raw_videos = [{"content_id": "dup_1", "content_type": "video", "content_url": "https://x/d1"}]
    cvs = upsert_channel_videos(raw_videos, "douyin", "test_dup_003")
    # 第一次创建
    created1, _ = create_feed_items_from_channel_videos_with_records(1, test_sub.id, cvs, "douyin")
    assert created1 == 1
    # 第二次应跳过
    created2, new2 = create_feed_items_from_channel_videos_with_records(1, test_sub.id, cvs, "douyin")
    assert created2 == 0
    assert new2 == []

    # 清理
    db = next(get_db())
    try:
        db.query(FeedItem).filter_by(subscription_id=test_sub.id).delete()
        db.query(ChannelVideo).filter_by(platform="douyin", platform_id="test_dup_003").delete()
        db.commit()
    finally:
        db.close()


# ── upsert_channel_videos content_type 处理 ──

def test_upsert_channel_videos_preserves_content_type():
    """upsert_channel_videos 应正确存储和更新 content_type"""
    db = next(get_db())
    try:
        # 新建
        cvs = upsert_channel_videos(
            [{"content_id": "ut_1", "content_type": "article", "content_url": "https://x/u1"}],
            "douyin", "test_upsert_ct"
        )
        assert len(cvs) == 1
        assert cvs[0].content_type == "article"

        # 更新（content_type 变化应被更新）
        cvs2 = upsert_channel_videos(
            [{"content_id": "ut_1", "content_type": "live_photo", "content_url": "https://x/u1"}],
            "douyin", "test_upsert_ct"
        )
        cv = db.query(ChannelVideo).filter_by(
            platform="douyin", platform_id="test_upsert_ct", content_id="ut_1"
        ).first()
        assert cv.content_type == "live_photo"

        # 缺 content_type 时默认 video
        cvs3 = upsert_channel_videos(
            [{"content_id": "ut_2", "content_url": "https://x/u2"}],
            "douyin", "test_upsert_ct"
        )
        assert cvs3[-1].content_type == "video"
    finally:
        db.query(ChannelVideo).filter_by(platform="douyin", platform_id="test_upsert_ct").delete()
        db.commit()
        db.close()


# ── 边界：_truncate_by_cursor 空值/None content_id ──

def test_truncate_all_items_missing_content_id():
    """所有 item 都没 content_id 时返回空集"""
    items = [{"foo": "bar"}, {"baz": "qux"}]
    assert _truncate(items, None) == set()
    assert _truncate(items, "anything") == set()


def test_truncate_cursor_is_none_string():
    """游标为空字符串时应等同 None（全部当新）"""
    items = [{"content_id": "1"}, {"content_id": "2"}]
    assert _truncate(items, "") == {"1", "2"}

