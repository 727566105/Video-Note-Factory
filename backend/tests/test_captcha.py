"""CaptchaManager 单元测试（不依赖 DB / 登录端点）。

直接对 CaptchaManager 做单测，避免触发全局单例（captcha_manager 是模块级单例）。
覆盖：
- generate 返回非空 id + base64 图片
- verify 正确 / 错误
- 大小写不敏感
- 一次性使用（校验后即作废，防重放）
- 过期失效
"""
import base64
import time
from datetime import datetime, timedelta, timezone

from app.auth.captcha import CaptchaManager


def _make_manager(**kwargs):
    return CaptchaManager(**kwargs)


def _seed(mgr, cid, answer):
    """向管理器注入一条未过期记录，便于确定性测试。"""
    mgr._store[cid] = (answer, datetime.now(timezone.utc) + timedelta(seconds=60))


def test_generate_returns_id_and_image():
    """generate 返回非空 captcha_id 和 base64 图片"""
    mgr = _make_manager()
    captcha_id, image = mgr.generate()
    assert captcha_id
    assert image
    # base64 PNG 头部
    raw = base64.b64decode(image)
    assert raw[:8] == b"\x89PNG\r\n\x1a\n"


def test_verify_correct():
    """正确验证码校验通过"""
    mgr = _make_manager()
    _seed(mgr, "cid", "ABCD")
    assert mgr.verify("cid", "ABCD") is True


def test_verify_wrong():
    """错误验证码校验失败"""
    mgr = _make_manager()
    _seed(mgr, "cid", "ABCD")
    assert mgr.verify("cid", "WXYZ") is False


def test_verify_case_insensitive():
    """大小写不敏感"""
    mgr = _make_manager()
    _seed(mgr, "cid", "abcd")
    assert mgr.verify("cid", "ABCD") is True


def test_verify_single_use():
    """一次性使用：校验后 id 即作废"""
    mgr = _make_manager()
    _seed(mgr, "cid", "ABCD")
    assert mgr.verify("cid", "ABCD") is True
    # 第二次（无论对错）都失败
    assert mgr.verify("cid", "ABCD") is False
    assert mgr.verify("cid", "WXYZ") is False


def test_verify_expired():
    """过期验证码失效"""
    mgr = _make_manager(ttl_seconds=1)
    captcha_id, _ = mgr.generate()
    answer = mgr._store[captcha_id][0]
    time.sleep(1.1)
    assert mgr.verify(captcha_id, answer) is False


def test_verify_missing_id_or_code():
    """空 id / 空 code 直接失败"""
    mgr = _make_manager()
    assert mgr.verify(None, "ABCD") is False
    assert mgr.verify("cid", "") is False
    assert mgr.verify("cid", None) is False


def test_store_bounded_by_max_size():
    """存储有上限：超限时淘汰最旧，内存不会无界增长（防内存 DoS）"""
    mgr = _make_manager(ttl_seconds=300, max_size=5)
    ids = []
    for _ in range(10):
        cid, _ = mgr.generate()
        ids.append(cid)
    # 存储大小被钳制在上限
    assert len(mgr._store) <= 5
    # 最新生成的仍然存在
    assert ids[-1] in mgr._store
    # 最旧的已被淘汰
    assert ids[0] not in mgr._store
    # 淘汰后仍能正常校验（新验证码可用）
    cid = ids[-1]
    answer = mgr._store[cid][0]
    assert mgr.verify(cid, answer) is True


def test_store_cap_does_not_break_evicted_refresh():
    """达到上限淘汰旧码后，新生成的验证码可正常使用"""
    mgr = _make_manager(ttl_seconds=300, max_size=2)
    for _ in range(5):
        mgr.generate()
    cid, _ = mgr.generate()
    assert len(mgr._store) == 2
    assert cid in mgr._store
    answer = mgr._store[cid][0]
    assert mgr.verify(cid, answer) is True


def test_max_size_zero_evicts_everything_but_still_usable():
    """极端：max_size=0 时每次生成即淘汰旧码，但最新一个仍可校验"""
    mgr = _make_manager(ttl_seconds=300, max_size=0)
    cid, _ = mgr.generate()
    # 插入后 len=1 > 0，会淘汰（此时是空则 break）；由于先判断空，最终保留刚插入的
    assert cid in mgr._store
    answer = mgr._store[cid][0]
    assert mgr.verify(cid, answer) is True
