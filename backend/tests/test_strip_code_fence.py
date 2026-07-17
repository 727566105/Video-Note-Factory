"""
strip_code_fence 深度测试套件
覆盖：正常场景、边界条件、异常输入、回归保护、误剥防护
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

# 抑制日志噪音
import logging
logging.disable(logging.WARNING)

from app.services.note import strip_code_fence, _strip_single_fence_layer

passed = 0
failed = 0
results = []

def test(desc, inp, expect_start=None, expect_exact=None, expect_not_start=None, expect_is_none=False):
    """单个测试用例"""
    global passed, failed
    try:
        result = strip_code_fence(inp)
        ok = True
        if expect_is_none:
            if result is not None:
                ok = False
                detail = f"期望 None，实际 '{result}'"
            else:
                detail = "返回 None"
        elif expect_exact is not None and result != expect_exact:
            ok = False
            detail = f"期望精确匹配 '{expect_exact[:60]}'，实际 '{result[:60] if isinstance(result, str) else result}'"
        elif expect_start is not None and not (isinstance(result, str) and result.strip().startswith(expect_start)):
            ok = False
            detail = f"期望以 '{expect_start}' 开头，实际 '{result[:60] if isinstance(result, str) else result}'"
        elif expect_not_start is not None and isinstance(result, str) and result.strip().startswith(expect_not_start):
            ok = False
            detail = f"不应以 '{expect_not_start}' 开头，实际 '{result[:60]}'"
        else:
            detail = f"'{result[:50]}...'" if isinstance(result, str) and len(result) > 50 else f"'{result}'"
    except Exception as e:
        ok = False
        detail = f"异常: {e}"
        result = ""

    if ok:
        passed += 1
        results.append(f"✅ {desc}: {detail}")
    else:
        failed += 1
        results.append(f"❌ {desc}: {detail}")


# ========== A. 正常场景 ==========

test("标准 markdown 包裹",
     "```markdown\n# 标题\n正文\n```",
     expect_start="# 标题")

test("标准 md 包裹",
     "```md\n# 标题\n```",
     expect_start="# 标题")

test("无语言标记包裹",
     "```\n# 标题\n正文\n```",
     expect_start="# 标题")

test("text 标记包裹",
     "```text\n# 标题\n```",
     expect_start="# 标题")

test("无包裹的正常 markdown",
     "# 标题\n## 子标题\n- 列表",
     expect_start="# 标题")

test("真实问题数据格式",
     "```markdown\n# 笔记：#我呢永远明媚\n\n## 1. 核心要点\n- **主题**：测试\n```",
     expect_start="# 笔记")

# ========== B. 多层包裹 ==========

test("双层包裹",
     "```markdown\n```markdown\n# 标题\n```\n```",
     expect_start="# 标题")

test("三层包裹（罕见，至少剥除最外层）",
     "```markdown\n```markdown\n```markdown\n# 标题\n```\n```\n```",
     expect_not_start="```markdown\n```markdown\n```markdown")

test("双层不同标记",
     "```markdown\n```\n# 标题\n```\n```",
     expect_start="# 标题")

# ========== C. 前导文本 ==========

test("前导寒暄+包裹",
     "好的，这是你的笔记：\n```markdown\n# 标题\n正文\n```",
     expect_start="# 标题")

test("前导长寒暄+包裹",
     "根据你的要求，我已经生成了以下笔记内容，请查阅：\n```markdown\n# 标题\n```",
     expect_start="# 标题")

test("前导多行+包裹",
     "好的。\n\n这是笔记：\n```markdown\n# 标题\n```",
     expect_start="# 标题")

# ========== D. 误剥防护（不应剥除的场景） ==========

test("内联代码块保留",
     "# 标题\n\n```python\nprint('hello')\n```\n\n正文",
     expect_start="# 标题")

test("多个内联代码块",
     "# 标题\n\n```python\nx=1\n```\n\n中间文字\n\n```javascript\ny=2\n```\n\n结尾",
     expect_start="# 标题")

test("只有代码块没有其他内容（合法代码笔记）",
     "```python\ndef hello():\n    print('hi')\n```",
     expect_exact="```python\ndef hello():\n    print('hi')\n```",
     expect_not_start="def hello")

test("合法 markdown 代码片段笔记不误剥",
     "```markdown\n这是一个示例 markdown 文件\n```",
     expect_exact="```markdown\n这是一个示例 markdown 文件\n```")

test("合法 text 代码片段不误剥",
     "```text\n纯文本内容\n没有标题\n```",
     expect_exact="```text\n纯文本内容\n没有标题\n```")

test("内容以#开头但无包裹",
     "## 标题\n\n正文内容",
     expect_start="## 标题")

# ========== E. 边界条件 ==========

test("空字符串",
     "",
     expect_exact="")

test("纯空白",
     "   \n\n  ",
     expect_exact="")

test("只有代码围栏无内容",
     "```\n```",
     expect_exact="```\n```",
     expect_not_start="#")

test("只有开头围栏",
     "```markdown\n# 标题",
     expect_start="```markdown",
     expect_not_start="# 标题")

test("只有结尾围栏",
     "# 标题\n```",
     expect_start="# 标题")

test("首尾有空行",
     "\n\n```markdown\n# 标题\n```\n\n",
     expect_start="# 标题")

test("Windows 换行符",
     "```markdown\r\n# 标题\r\n正文\r\n```",
     expect_start="# 标题")

test("超大内容",
     "```markdown\n" + "# 标题\n" + "正文内容\n" * 10000 + "\n```",
     expect_start="# 标题")

# ========== F. 异常输入 ==========

test("None 输入",
     None,
     expect_is_none=True)

test("非字符串输入（整数）",
     123,
     expect_exact=123)

test("特殊字符内容（内嵌成对代码块）",
     "```markdown\n# 标题 `<code>` \n\n```嵌套```\n```",
     expect_start="# 标题")

test("特殊字符内容（内嵌不成对代码块）",
     "```markdown\n# 标题\n未闭合的 ``` 代码\n```",
     expect_start="```markdown",
     expect_not_start="# 标题")

test("Unicode 内容",
     "```markdown\n# 🎯 标题\n\n中文内容\n日本語\n```",
     expect_start="# 🎯")

# ========== G. _strip_single_fence_layer 单元测试 ==========

def test_layer(desc, inp, expect_changed):
    """测试单层剥除"""
    global passed, failed
    try:
        result = _strip_single_fence_layer(inp.strip())
        changed = result != inp.strip()
        ok = changed == expect_changed
        detail = f"{'已剥除' if changed else '未变'} (期望{'剥除' if expect_changed else '不变'})"
    except Exception as e:
        ok = False
        detail = f"异常: {e}"

    if ok:
        passed += 1
        results.append(f"✅ [layer] {desc}: {detail}")
    else:
        failed += 1
        results.append(f"❌ [layer] {desc}: {detail}")

test_layer("单层有包裹", "```markdown\n# 标题\n```", True)
test_layer("单层无包裹", "# 标题\n正文", False)
test_layer("内联代码不剥", "# 标题\n```python\ncode\n```\n正文", False)

# ========== H. 回归保护：确保正常 markdown 不被修改 ==========

normal_notes = [
    "# 笔记标题\n\n## 要点\n- 第一\n- 第二\n\n正文段落",
    "## 章节\n\n1. 有序项\n2. 另一项\n\n| 列1 | 列2 |\n|-----|-----|\n| A | B |",
    "# 标题\n\n> 引用块\n\n```javascript\nconsole.log('hi');\n```\n\n**加粗**文字",
]

for i, note in enumerate(normal_notes):
    test(f"回归保护-正常笔记{i+1}", note, expect_exact=note)

# ========== 输出结果 ==========

for r in results:
    print(r)

print(f"\n{'='*50}")
print(f"总计: {passed} 通过, {failed} 失败, {passed+failed} 个用例")
print(f"覆盖率: 正常{6} + 多层{3} + 前导{3} + 误剥{4} + 边界{9} + 异常{4} + 单层{3} + 回归{3} = {35} 场景")
sys.exit(1 if failed else 0)
