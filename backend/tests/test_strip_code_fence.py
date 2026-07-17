"""
strip_code_fence 深度测试套件（标准 pytest 格式）
覆盖：正常场景、边界条件、异常输入、回归保护、误剥防护
"""
import sys
import os
import pytest

# 确保 backend 目录在 path 中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# 抑制日志噪音
import logging
logging.disable(logging.WARNING)

from app.services.note import strip_code_fence, _strip_single_fence_layer


# ========== 辅助 ==========

def _check(inp, expect_start=None, expect_exact=None, expect_not_start=None, expect_is_none=False):
    """调用 strip_code_fence 并断言检查结果"""
    result = strip_code_fence(inp)
    if expect_is_none:
        assert result is None, f"期望 None，实际 '{result}'"
        return
    if expect_exact is not None:
        assert result == expect_exact, f"期望精确匹配 '{expect_exact[:60]}'，实际 '{result}'"
        return
    if expect_start is not None:
        assert isinstance(result, str), f"期望字符串，实际类型 {type(result)}"
        assert result.strip().startswith(expect_start), f"期望以 '{expect_start}' 开头，实际 '{result[:60]}'"
    if expect_not_start is not None:
        assert isinstance(result, str), f"期望字符串，实际类型 {type(result)}"
        assert not result.strip().startswith(expect_not_start), f"不应以 '{expect_not_start}' 开头，实际 '{result[:60]}'"


# ========== A. 正常场景 ==========

def test_standard_markdown_fence():
    _check("```markdown\n# 标题\n正文\n```", expect_start="# 标题")

def test_standard_md_fence():
    _check("```md\n# 标题\n```", expect_start="# 标题")

def test_no_lang_fence():
    _check("```\n# 标题\n正文\n```", expect_start="# 标题")

def test_text_fence():
    _check("```text\n# 标题\n```", expect_start="# 标题")

def test_no_fence_normal():
    _check("# 标题\n## 子标题\n- 列表", expect_start="# 标题")

def test_real_problem_data_format():
    _check("```markdown\n# 笔记：#我呢永远明媚\n\n## 1. 核心要点\n- **主题**：测试\n```", expect_start="# 笔记")


# ========== B. 多层包裹 ==========

def test_double_layer_fence():
    _check("```markdown\n```markdown\n# 标题\n```\n```", expect_start="# 标题")

def test_triple_layer_fence():
    # 三层罕见，至少剥除最外层
    _check("```markdown\n```markdown\n```markdown\n# 标题\n```\n```\n```",
           expect_not_start="```markdown\n```markdown\n```markdown")

def test_double_layer_diff_lang():
    _check("```markdown\n```\n# 标题\n```\n```", expect_start="# 标题")


# ========== C. 前导文本 ==========

def test_leading_text_fence():
    _check("好的，这是你的笔记：\n```markdown\n# 标题\n正文\n```", expect_start="# 标题")

def test_leading_long_text_fence():
    _check("根据你的要求，我已经生成了以下笔记内容，请查阅：\n```markdown\n# 标题\n```", expect_start="# 标题")

def test_leading_multiline_fence():
    _check("好的。\n\n这是笔记：\n```markdown\n# 标题\n```", expect_start="# 标题")


# ========== D. 误剥防护 ==========

def test_inline_code_block_preserved():
    _check("# 标题\n\n```python\nprint('hello')\n```\n\n正文", expect_start="# 标题")

def test_multiple_inline_code_blocks():
    _check("# 标题\n\n```python\nx=1\n```\n\n中间文字\n\n```javascript\ny=2\n```\n\n结尾", expect_start="# 标题")

def test_only_code_block_not_stripped():
    """只有代码块没有其他内容（合法代码笔记）不应被剥除"""
    _check("```python\ndef hello():\n    print('hi')\n```",
           expect_exact="```python\ndef hello():\n    print('hi')\n```",
           expect_not_start="def hello")

def test_legit_markdown_snippet_not_stripped():
    """合法 markdown 代码片段笔记不误剥"""
    _check("```markdown\n这是一个示例 markdown 文件\n```",
           expect_exact="```markdown\n这是一个示例 markdown 文件\n```")

def test_legit_text_snippet_not_stripped():
    """合法 text 代码片段不误剥"""
    _check("```text\n纯文本内容\n没有标题\n```",
           expect_exact="```text\n纯文本内容\n没有标题\n```")


# ========== E. 边界条件 ==========

def test_empty_string():
    _check("", expect_exact="")

def test_pure_whitespace():
    _check("   \n\n  ", expect_exact="")

def test_empty_fence():
    """只有代码围栏无内容"""
    _check("```\n```", expect_exact="```\n```", expect_not_start="#")

def test_only_opening_fence():
    _check("```markdown\n# 标题", expect_start="```markdown", expect_not_start="# 标题")

def test_only_closing_fence():
    _check("# 标题\n```", expect_start="# 标题")

def test_leading_trailing_blank_lines():
    _check("\n\n```markdown\n# 标题\n```\n\n", expect_start="# 标题")

def test_windows_crlf():
    _check("```markdown\r\n# 标题\r\n正文\r\n```", expect_start="# 标题")

def test_huge_content():
    _check("```markdown\n" + "# 标题\n" + "正文内容\n" * 10000 + "\n```", expect_start="# 标题")


# ========== F. 异常输入 ==========

def test_none_input():
    _check(None, expect_is_none=True)

def test_non_string_int_input():
    _check(123, expect_exact=123)

def test_special_chars_paired_fence():
    """内嵌成对代码块"""
    _check("```markdown\n# 标题 `<code>` \n\n```嵌套```\n```", expect_start="# 标题")

def test_special_chars_unpaired_fence():
    """内嵌不成对代码块"""
    _check("```markdown\n# 标题\n未闭合的 ``` 代码\n```",
           expect_start="```markdown", expect_not_start="# 标题")

def test_unicode_content():
    _check("```markdown\n# 🎯 标题\n\n中文内容\n日本語\n```", expect_start="# 🎯")


# ========== G. _strip_single_fence_layer 单元测试 ==========

def test_layer_strips_single_fence():
    result = _strip_single_fence_layer("```markdown\n# 标题\n```".strip())
    assert result == "# 标题", f"期望 '# 标题'，实际 '{result}'"

def test_layer_no_change_without_fence():
    inp = "# 标题\n正文"
    result = _strip_single_fence_layer(inp.strip())
    assert result == inp, "无包裹时不应变化"

def test_layer_preserves_inline_code():
    inp = "# 标题\n```python\ncode\n```\n正文"
    result = _strip_single_fence_layer(inp.strip())
    assert result == inp, "内联代码块不应被剥除"


# ========== H. 回归保护 ==========

def test_regression_normal_note_1():
    note = "# 笔记标题\n\n## 要点\n- 第一\n- 第二\n\n正文段落"
    _check(note, expect_exact=note)

def test_regression_normal_note_2():
    note = "## 章节\n\n1. 有序项\n2. 另一项\n\n| 列1 | 列2 |\n|-----|-----|\n| A | B |"
    _check(note, expect_exact=note)

def test_regression_normal_note_3():
    note = "# 标题\n\n> 引用块\n\n```javascript\nconsole.log('hi');\n```\n\n**加粗**文字"
    _check(note, expect_exact=note)
