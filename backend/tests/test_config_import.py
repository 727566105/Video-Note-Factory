"""
ConfigImporter.import_configs 单元测试

运行方式: cd backend && python3 -m unittest tests.test_config_import -v
         （或用 .venv/bin/python -m unittest tests.test_config_import -v）
"""
import unittest
from unittest.mock import patch, MagicMock

from app.services.config_export import ConfigImporter


def _config_data(providers=None, siyuan=None, webdav=None, downloader=None):
    """构造一份导入用的配置数据"""
    configs = {
        "providers": providers or [],
        "siyuan_config": siyuan,
        "webdav_config": webdav,
    }
    if downloader is not None:
        configs["downloader_config"] = downloader
    return {
        "version": "1.0",
        "exported_at": "2026-06-29T10:00:00",
        "configs": configs,
    }


class TestImportProviders(unittest.TestCase):
    """providers 类型导入的结果归类"""

    @patch("app.services.config_export.get_all_providers")
    def test_providers_missing_apikey_counted_as_failed(self, _mock_get_all):
        """所有 provider 缺 API Key 时应计入 failed，而非 success"""
        config_data = _config_data(providers=[
            {"id": "openai", "name": "OpenAI", "base_url": "https://api.openai.com",
             "logo": "", "type": "openai", "enabled": 1}
        ])
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["providers"],
            credentials={"providers": {}},  # 未提供任何 API Key
        )

        # 不应计入 success
        success_types = [s["type"] for s in results["success"]]
        self.assertNotIn("providers", success_types)

        # 应计入 failed，且 error 提示凭证缺失
        failed_types = [f["type"] for f in results["failed"]]
        self.assertIn("providers", failed_types)
        providers_failed = [f for f in results["failed"] if f["type"] == "providers"][0]
        self.assertIn("API Key", providers_failed["error"])

    @patch("app.services.config_export.get_all_providers")
    @patch("app.services.config_export.insert_provider")
    @patch("app.db.provider_dao.get_provider_by_id", return_value=None)
    def test_providers_with_credentials_counted_as_success(
        self, _mock_get_by_id, _mock_insert, _mock_get_all
    ):
        """凭证齐全时应计入 success"""
        config_data = _config_data(providers=[
            {"id": "openai", "name": "OpenAI", "base_url": "https://api.openai.com",
             "logo": "", "type": "openai", "enabled": 1}
        ])
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["providers"],
            credentials={"providers": {"openai": "sk-real-key"}},
        )

        success_types = [s["type"] for s in results["success"]]
        self.assertIn("providers", success_types)
        self.assertEqual(results["failed"], [])


class TestImportSiyuan(unittest.TestCase):
    """siyuan_config 类型导入的结果归类"""

    def test_siyuan_missing_token_counted_as_failed(self):
        """思源笔记缺 API Token 时应计入 failed，而非 skipped"""
        config_data = _config_data(siyuan={
            "api_url": "http://localhost:6806", "default_notebook": "",
            "enabled": 1, "api_token": "********"
        })
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["siyuan_config"],
            credentials={"siyuan_config": {"api_token": ""}},
        )

        skipped_types = [s["type"] for s in results["skipped"]]
        failed_types = [f["type"] for f in results["failed"]]
        self.assertNotIn("siyuan_config", skipped_types)
        self.assertIn("siyuan_config", failed_types)
        siyuan_failed = [f for f in results["failed"] if f["type"] == "siyuan_config"][0]
        self.assertIn("API Token", siyuan_failed["error"])


class TestImportWebdav(unittest.TestCase):
    """webdav_config 类型导入的结果归类"""

    def test_webdav_missing_password_counted_as_failed(self):
        """WebDAV 缺密码时应计入 failed，而非 skipped"""
        config_data = _config_data(webdav={
            "url": "https://dav.example.com/dav/", "username": "user",
            "path": "/", "auto_backup_enabled": 0,
            "auto_backup_schedule": "0 2 * * *", "password": "********"
        })
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["webdav_config"],
            credentials={"webdav_config": {"password": ""}},
        )

        skipped_types = [s["type"] for s in results["skipped"]]
        failed_types = [f["type"] for f in results["failed"]]
        self.assertNotIn("webdav_config", skipped_types)
        self.assertIn("webdav_config", failed_types)
        webdav_failed = [f for f in results["failed"] if f["type"] == "webdav_config"][0]
        self.assertIn("密码", webdav_failed["error"])


class TestIsPlaceholder(unittest.TestCase):
    """占位符判定"""

    def test_empty_string_is_placeholder(self):
        from app.services.config_export import _is_placeholder
        self.assertTrue(_is_placeholder(""))

    def test_none_is_placeholder(self):
        from app.services.config_export import _is_placeholder
        self.assertTrue(_is_placeholder(None))

    def test_stars_is_placeholder(self):
        from app.services.config_export import _is_placeholder
        self.assertTrue(_is_placeholder("********"))

    def test_sk_test_is_placeholder(self):
        from app.services.config_export import _is_placeholder
        self.assertTrue(_is_placeholder("sk-test"))

    def test_real_value_is_not_placeholder(self):
        from app.services.config_export import _is_placeholder
        self.assertFalse(_is_placeholder("sk-real-abc123"))


class TestImportDownloader(unittest.TestCase):
    """downloader_config 类型保持 skipped（硬编码，系统原因）"""

    def test_downloader_counted_as_skipped(self):
        config_data = {
            "version": "1.0",
            "exported_at": "2026-06-29T10:00:00",
            "configs": {"downloader_config": {"enabled_platforms": ["bilibili"]}},
        }
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["downloader_config"],
            credentials={},
        )

        skipped_types = [s["type"] for s in results["skipped"]]
        self.assertIn("downloader_config", skipped_types)
        self.assertEqual(results["success"], [])
        self.assertEqual(results["failed"], [])


if __name__ == "__main__":
    unittest.main()
