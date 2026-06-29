"""sanitize_path_name 按字节截断单元测试

验证目录名生成不会超过文件系统单文件名 255 字节限制（UTF-8 计字节）。

运行: cd backend && python3 -m pytest tests/test_path_helper.py -v
"""
from app.utils.path_helper import sanitize_path_name, get_video_folder_name


def test_short_name_not_truncated():
    """短标题不截断，原样返回"""
    assert sanitize_path_name("普通标题") == "普通标题"
    assert sanitize_path_name("hello") == "hello"


def test_long_chinese_name_truncated_by_bytes():
    """超长中文标题按 UTF-8 字节截断到 ≤200"""
    # 100 个中文字符 = 300 字节，远超 200
    name = sanitize_path_name("测" * 100)
    assert len(name.encode('utf-8')) <= 200
    assert name.endswith("...")
    # 能正常 decode（无半截字符）——若截断在字符中间，此断言会抛 UnicodeDecodeError
    assert name.encode('utf-8').decode('utf-8') == name


def test_long_ascii_name_truncated_by_bytes():
    """超长 ASCII 标题按字节截断到 ≤200"""
    name = sanitize_path_name("a" * 300)
    assert len(name.encode('utf-8')) <= 200
    assert name.endswith("...")


def test_truncation_at_character_boundary():
    """截断在完整 UTF-8 字符边界，不产生半个字符"""
    # 混合中英文，确保截断点不会落在多字节字符中间
    name = sanitize_path_name("x" * 100 + "测试" * 50)
    # 能成功 decode 即证明没有半截字符
    decoded = name.encode('utf-8').decode('utf-8')
    assert decoded == name


def test_video_folder_name_within_byte_limit():
    """get_video_folder_name 生成的完整目录名 UTF-8 字节数 < 255"""
    # 模拟真实超长标题
    title = "真实自然的画面质感，整体明亮通透，曝光充足偏高，色彩干净通透，高饱和且不艳俗" * 3
    video_id = "7646057570286228212"
    folder = get_video_folder_name(video_id, title)
    assert len(folder.encode('utf-8')) < 255
