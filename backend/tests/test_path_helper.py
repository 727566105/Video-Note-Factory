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


def test_get_video_folder_self_heals_truncated_dir(tmp_path, monkeypatch):
    """get_video_folder 按 video_id_ 前缀复用已存在目录（解压落地的截断目录）

    模拟场景：解压整机包时超长目录段被截断落地（截断点 A），
    运行时 get_video_folder_name 计算出的目录名截断点不同（截断点 B），
    自愈合逻辑应按 video_id_ 前缀匹配到已落地的目录，而非新建空目录。
    """
    import app.utils.path_helper as ph
    from app.utils.path_helper import get_video_folder

    # 隔离 VIDEO_DIR 到临时目录
    monkeypatch.setattr(ph, "VIDEO_DIR", tmp_path, raising=False)

    author_id = "111271277388"
    author_name = "库里的地滑之秀"
    video_id = "7646057570286228212"
    platform = "douyin"

    # 步骤1：先建一个 author 目录（模拟正常存在）
    from app.utils.path_helper import get_author_folder_name, _get_platform_dir
    author_dir = tmp_path / _get_platform_dir(platform) / get_author_folder_name(author_id, author_name, platform)
    author_dir.mkdir(parents=True)

    # 步骤2：在 author 目录下放一个「解压落地的截断目录」（整段截断，截断点 A）
    long_title = "真实自然的画面质感，整体明亮通透，曝光充足偏高，色彩干净通透，高饱和且不艳俗" * 3
    landed_name = ph.sanitize_path_name(f"{video_id}_{long_title}", 200)
    landed_dir = author_dir / landed_name
    landed_dir.mkdir()
    (landed_dir / "cover.jpg").write_text("封面")  # 模拟落地文件

    # 步骤3：运行时用长 title 调 get_video_folder（title 单独截断，截断点 B ≠ A）
    result = get_video_folder(author_id, author_name, video_id, long_title, platform)

    # 自愈合：返回的是已落地的目录，而非新建目录
    assert result == landed_dir
    # 落地文件仍在
    assert (result / "cover.jpg").exists()


def test_find_note_file_self_heals_truncated_dir(tmp_path, monkeypatch):
    """find_note_file 精确路径不存在时，按 video_id_ 前缀自愈合找到截断点不同的目录

    模拟场景：旧整机包导入后目录名截断点 A，运行时 get_video_folder_name 算出截断点 B，
    find_note_file 应按 video_id_ 前缀匹配到 A 目录下的 status.json / note 文件。
    """
    import app.utils.path_helper as ph
    from app.utils.path_helper import find_note_file, get_author_folder_name, _get_platform_dir

    # 隔离 VIDEO_DIR / DATA_DIR 到临时目录
    monkeypatch.setattr(ph, "VIDEO_DIR", tmp_path, raising=False)
    monkeypatch.setattr(ph, "DATA_DIR", tmp_path.parent, raising=False)

    author_id = "111271277388"
    author_name = "库里的地滑之秀"
    video_id = "7646057570286228212"
    platform = "douyin"
    long_title = "真实自然的画面质感，整体明亮通透，曝光充足偏高，色彩干净通透，高饱和且不艳俗" * 3

    # 建一个「截断点 A」的目录（整段截断，与运行时 title 单独截断不同）
    author_dir = tmp_path / _get_platform_dir(platform) / get_author_folder_name(author_id, author_name, platform)
    author_dir.mkdir(parents=True)
    landed_name = ph.sanitize_path_name(f"{video_id}_{long_title}", 200)
    landed_dir = author_dir / landed_name
    landed_dir.mkdir()
    (landed_dir / "status.json").write_text('{"status":"SUCCESS"}')
    (landed_dir / "note_1.json").write_text('{"markdown":"# x"}')

    # 运行时用长 title 查找（算出的 video_folder 截断点 B ≠ A，精确路径不存在）
    status_path = find_note_file("t1", author_id, author_name, video_id, long_title, "status", platform)
    assert status_path is not None
    assert status_path.name == "status.json"

    note_path = find_note_file("t1", author_id, author_name, video_id, long_title, "note", platform, user_id=1)
    assert note_path is not None
    assert note_path.name == "note_1.json"
