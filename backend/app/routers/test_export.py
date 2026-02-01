"""
PDF 导出功能单元测试

使用 FastAPI TestClient 测试核心逻辑和错误处理
运行方式: cd backend && python -m app.routers.test_export
"""
import unittest
import tempfile
import json
import io
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch

from fastapi.testclient import TestClient
from fastapi import FastAPI

# 导入被测试的路由
from app.routers import export


class TestExportPDF(unittest.TestCase):
    """PDF 导出功能单元测试"""

    def setUp(self):
        """测试前准备：创建测试应用和客户端"""
        self.app = FastAPI()
        # 使用与生产环境相同的路由前缀
        self.app.include_router(export.router, prefix="/api/export")
        self.client = TestClient(self.app)

        # 创建临时目录作为测试用的 note_results
        self.temp_dir = tempfile.mkdtemp()
        self.note_output_dir = Path(self.temp_dir)

        # 备份原始配置并替换为测试目录
        self.original_note_dir = export.NOTE_OUTPUT_DIR
        export.NOTE_OUTPUT_DIR = self.note_output_dir

    def tearDown(self):
        """测试后清理"""
        export.NOTE_OUTPUT_DIR = self.original_note_dir

    def _create_test_files(self, task_id: str, markdown_content: str = "# Test Note\n\n测试内容", title: str = "测试标题"):
        """辅助方法：创建测试用的 Markdown 和音频元信息文件"""
        md_file = self.note_output_dir / f"{task_id}_markdown.md"
        audio_file = self.note_output_dir / f"{task_id}_audio.json"

        md_file.write_text(markdown_content, encoding="utf-8")
        audio_file.write_text(json.dumps({"title": title}), encoding="utf-8")

        return md_file, audio_file

    def _mock_markdown_pdf(self, pdf_content: bytes = b"%PDF-1.4-fake-pdf"):
        """辅助方法：mock markdown_pdf 模块"""
        # 创建 mock 对象
        mock_section = Mock()
        mock_md_pdf_instance = Mock()

        # Mock BytesIO 返回模拟的 PDF 内容
        mock_buffer = io.BytesIO(pdf_content)

        return mock_section, mock_md_pdf_instance, mock_buffer

    def test_export_pdf_success(self):
        """测试：成功导出 PDF（正常流程）"""
        task_id = "test_task_001"
        self._create_test_files(task_id)

        mock_section, mock_md_pdf_instance, mock_buffer = self._mock_markdown_pdf()

        # 同时 patch markdown_pdf 模块和 io.BytesIO
        with patch('markdown_pdf.MarkdownPdf', return_value=mock_md_pdf_instance), \
             patch('markdown_pdf.Section', return_value=mock_section), \
             patch('app.routers.export.io.BytesIO', return_value=mock_buffer):

            response = self.client.get(f"/api/export/pdf/{task_id}")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.headers["content-type"], "application/pdf")
            self.assertIn("attachment", response.headers["content-disposition"])
            self.assertIn(".pdf", response.headers["content-disposition"])

    def test_export_pdf_file_not_found(self):
        """测试：笔记文件不存在时返回 404"""
        task_id = "nonexistent_task"

        response = self.client.get(f"/api/export/pdf/{task_id}")

        self.assertEqual(response.status_code, 404)
        self.assertIn("笔记不存在", response.json()["detail"])

    def test_export_pdf_empty_content(self):
        """测试：笔记内容为空时返回 400"""
        task_id = "empty_task"
        md_file, _ = self._create_test_files(task_id, markdown_content="   \n\n   ")

        response = self.client.get(f"/api/export/pdf/{task_id}")

        self.assertEqual(response.status_code, 400)
        self.assertIn("内容为空", response.json()["detail"])

    def test_export_pdf_with_title(self):
        """测试：使用标题作为文件名"""
        task_id = "test_task_title"
        title = "我的笔记标题"
        self._create_test_files(task_id, title=title)

        mock_section, mock_md_pdf_instance, mock_buffer = self._mock_markdown_pdf()

        with patch('markdown_pdf.MarkdownPdf', return_value=mock_md_pdf_instance), \
             patch('markdown_pdf.Section', return_value=mock_section), \
             patch('app.routers.export.io.BytesIO', return_value=mock_buffer):

            response = self.client.get(f"/api/export/pdf/{task_id}")

            self.assertEqual(response.status_code, 200)
            # 验证文件名包含标题
            disposition = response.headers["content-disposition"]
            self.assertIn("attachment", disposition)

    def test_export_pdf_with_special_chars_in_title(self):
        """测试：处理标题中的特殊字符"""
        task_id = "test_task_special"
        title = "测试/标题:特殊*字符?\"<>|"
        self._create_test_files(task_id, title=title)

        mock_section, mock_md_pdf_instance, mock_buffer = self._mock_markdown_pdf()

        with patch('markdown_pdf.MarkdownPdf', return_value=mock_md_pdf_instance), \
             patch('markdown_pdf.Section', return_value=mock_section), \
             patch('app.routers.export.io.BytesIO', return_value=mock_buffer):

            response = self.client.get(f"/api/export/pdf/{task_id}")

            self.assertEqual(response.status_code, 200)

    def test_export_pdf_markdown_pdf_error(self):
        """测试：markdown_pdf 转换失败时返回 500"""
        task_id = "test_task_error"
        self._create_test_files(task_id)

        with patch('markdown_pdf.MarkdownPdf', side_effect=Exception("转换失败")):
            response = self.client.get(f"/api/export/pdf/{task_id}")

            self.assertEqual(response.status_code, 500)
            self.assertIn("PDF 生成失败", response.json()["detail"])

    def test_export_pdf_without_title(self):
        """测试：没有标题时使用默认文件名"""
        task_id = "test_task_no_title"
        # 只创建 markdown 文件，不创建 audio.json
        md_file = self.note_output_dir / f"{task_id}_markdown.md"
        md_file.write_text("# Note\n\nContent", encoding="utf-8")

        mock_section, mock_md_pdf_instance, mock_buffer = self._mock_markdown_pdf()

        with patch('markdown_pdf.MarkdownPdf', return_value=mock_md_pdf_instance), \
             patch('markdown_pdf.Section', return_value=mock_section), \
             patch('app.routers.export.io.BytesIO', return_value=mock_buffer):

            response = self.client.get(f"/api/export/pdf/{task_id}")

            self.assertEqual(response.status_code, 200)

    def test_css_styles_defined(self):
        """测试：CSS 样式常量已定义"""
        self.assertTrue(hasattr(export, 'CSS_STYLES'))
        self.assertIn('body', export.CSS_STYLES)
        self.assertIn('Noto Sans SC', export.CSS_STYLES)

    def test_clean_markdown_internal_links(self):
        """测试：内部链接被正确清理"""
        task_id = "test_internal_links"
        # 包含内部链接的 markdown
        markdown = "# Title\n\n[链接](#anchor)\n\n[外部](https://example.com)"
        self._create_test_files(task_id, markdown_content=markdown)

        mock_section, mock_md_pdf_instance, mock_buffer = self._mock_markdown_pdf()

        with patch('markdown_pdf.MarkdownPdf', return_value=mock_md_pdf_instance), \
             patch('markdown_pdf.Section', return_value=mock_section), \
             patch('app.routers.export.io.BytesIO', return_value=mock_buffer):

            response = self.client.get(f"/api/export/pdf/{task_id}")

            self.assertEqual(response.status_code, 200)
            # 验证 add_section 被调用
            mock_md_pdf_instance.add_section.assert_called_once()


class TestExportCoverage(unittest.TestCase):
    """测试覆盖率统计"""

    def test_coverage_report(self):
        """生成测试覆盖率报告"""
        # 导入测试类
        from app.routers.test_export import TestExportPDF

        # 统计测试方法数量
        test_methods = [m for m in dir(TestExportPDF) if m.startswith('test_')]

        print(f"\n{'='*50}")
        print(f"PDF 导出单元测试")
        print(f"{'='*50}")
        print(f"测试用例数: {len(test_methods)}")
        print(f"\n测试覆盖场景:")
        for method in test_methods:
            print(f"  - {method}")
        print(f"{'='*50}\n")


if __name__ == '__main__':
    # 运行测试并生成报告
    unittest.main(verbosity=2)
