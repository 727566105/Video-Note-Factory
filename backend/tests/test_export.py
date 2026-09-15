"""
PDF 导出功能单元测试

测试 export 模块的核心逻辑
运行方式: cd backend && python3 -m pytest tests/test_export.py -v
"""
import unittest
from app.routers import export


class TestExportStyles(unittest.TestCase):
    """测试导出样式定义"""

    def test_pdf_styles_defined(self):
        """PDF 样式常量已定义"""
        self.assertTrue(hasattr(export, 'PDF_STYLES'))
        styles = export.PDF_STYLES
        self.assertIn('default', styles)
        self.assertIn('simple', styles)
        self.assertIn('print', styles)
        self.assertIn('academic', styles)

    def test_default_style_contains_body(self):
        """默认样式包含 body 规则"""
        self.assertIn('body', export.PDF_STYLES['default'])

    def test_default_style_contains_font(self):
        """默认样式包含字体"""
        self.assertIn('Noto Sans SC', export.PDF_STYLES['default'])

    def test_style_types_defined(self):
        """样式类型已定义"""
        # StyleType 和 ImageFormat 是 Literal 类型
        # 验证样式映射完整
        for style_name in ['default', 'simple', 'print', 'academic']:
            self.assertIn(style_name, export.PDF_STYLES)
            self.assertTrue(len(export.PDF_STYLES[style_name]) > 100)

    def test_build_pdf_response_with_title(self):
        """测试 PDF 响应构建（带标题）"""
        resp = export._build_pdf_response(b"fake-pdf", "测试标题", "task123")
        self.assertEqual(resp.media_type, "application/pdf")
        self.assertIn("attachment", resp.headers["content-disposition"])

    def test_build_pdf_response_without_title(self):
        """测试 PDF 响应构建（无标题）"""
        resp = export._build_pdf_response(b"fake-pdf", None, "task123")
        self.assertEqual(resp.media_type, "application/pdf")
        self.assertIn("task123", resp.headers["content-disposition"])


if __name__ == '__main__':
    unittest.main()
