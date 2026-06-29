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
    """providers 类型导入的取值与结果归类"""

    @patch("app.services.config_export.get_all_providers")
    @patch("app.services.config_export.insert_provider")
    @patch("app.db.provider_dao.get_provider_by_id", return_value=None)
    def test_providers_use_builtin_apikey_when_no_credentials(
        self, _mock_get_by_id, _mock_insert, _mock_get_all
    ):
        """无 credentials 时优先用文件自带 api_key；自带真实值则成功"""
        config_data = _config_data(providers=[
            {"id": "openai", "name": "OpenAI", "base_url": "https://api.openai.com",
             "logo": "", "type": "openai", "enabled": 1, "api_key": "sk-real-builtin"}
        ])
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["providers"],
            # 不传 credentials
        )
        success_types = [s["type"] for s in results["success"]]
        self.assertIn("providers", success_types)
        self.assertEqual(results["failed"], [])

    @patch("app.services.config_export.get_all_providers")
    @patch("app.services.config_export.insert_provider")
    @patch("app.db.provider_dao.get_provider_by_id", return_value=None)
    def test_providers_import_sk_test_default_key(self, _mock_get_by_id, _mock_insert, _mock_get_all):
        """sk-test 是系统内置 provider 默认 key，应忠实导入而非跳过"""
        config_data = _config_data(providers=[
            {"id": "openai", "name": "OpenAI", "base_url": "https://api.openai.com",
             "logo": "", "type": "openai", "enabled": 1, "api_key": "sk-test"}
        ])
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["providers"],
        )
        success_types = [s["type"] for s in results["success"]]
        self.assertIn("providers", success_types)
        self.assertEqual(results["failed"], [])
        # 验证写入了 sk-test（忠实还原）
        _mock_insert.assert_called_once()
        self.assertEqual(_mock_insert.call_args.kwargs["api_key"], "sk-test")

    @patch("app.services.config_export.get_all_providers")
    @patch("app.services.config_export.insert_provider")
    @patch("app.db.provider_dao.get_provider_by_id", return_value=None)
    def test_providers_credentials_override_builtin(
        self, _mock_get_by_id, _mock_insert, _mock_get_all
    ):
        """credentials 优先级高于文件自带 api_key"""
        config_data = _config_data(providers=[
            {"id": "openai", "name": "OpenAI", "base_url": "https://api.openai.com",
             "logo": "", "type": "openai", "enabled": 1, "api_key": "sk-test"}
        ])
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["providers"],
            credentials={"providers": {"openai": "sk-real-from-cred"}},
        )
        success_types = [s["type"] for s in results["success"]]
        self.assertIn("providers", success_types)
        # 验证写入用的是 credentials 的值
        _mock_insert.assert_called_once()
        self.assertEqual(_mock_insert.call_args.kwargs["api_key"], "sk-real-from-cred")


class TestImportSiyuan(unittest.TestCase):
    """siyuan_config 类型导入的取值与结果归类"""

    @patch("app.services.config_export.upsert_siyuan_config")
    def test_siyuan_use_builtin_token_when_no_credentials(self, _mock_upsert):
        """无 credentials 时优先用文件自带 api_token"""
        config_data = _config_data(siyuan={
            "api_url": "http://localhost:6806", "default_notebook": "",
            "enabled": 1, "api_token": "token-real-123"
        })
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["siyuan_config"],
        )
        success_types = [s["type"] for s in results["success"]]
        self.assertIn("siyuan_config", success_types)
        self.assertEqual(results["failed"], [])
        _mock_upsert.assert_called_once_with(
            api_url="http://localhost:6806", api_token="token-real-123", default_notebook=""
        )

    def test_siyuan_skip_when_builtin_is_placeholder(self):
        """文件 api_token 是占位符时归 skipped（非 failed）"""
        config_data = _config_data(siyuan={
            "api_url": "http://localhost:6806", "default_notebook": "",
            "enabled": 1, "api_token": "********"
        })
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["siyuan_config"],
        )
        self.assertEqual(results["success"], [])
        self.assertEqual(results["failed"], [])
        skipped_types = [s["type"] for s in results["skipped"]]
        self.assertIn("siyuan_config", skipped_types)

    def test_siyuan_skip_when_config_is_null(self):
        """siyuan_config 为 null 时归 skipped"""
        config_data = _config_data(siyuan=None)
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["siyuan_config"],
        )
        skipped_types = [s["type"] for s in results["skipped"]]
        self.assertIn("siyuan_config", skipped_types)


class TestImportWebdav(unittest.TestCase):
    """webdav_config 类型导入的取值与结果归类"""

    @patch("app.services.config_export.upsert_webdav_config")
    def test_webdav_use_builtin_password_when_no_credentials(self, _mock_upsert):
        """无 credentials 时优先用文件自带 password"""
        config_data = _config_data(webdav={
            "url": "https://dav.example.com/dav/", "username": "user",
            "path": "/", "auto_backup_enabled": 0,
            "auto_backup_schedule": "0 2 * * *", "password": "real-pass-456"
        })
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["webdav_config"],
        )
        success_types = [s["type"] for s in results["success"]]
        self.assertIn("webdav_config", success_types)
        self.assertEqual(results["failed"], [])
        _mock_upsert.assert_called_once()
        self.assertEqual(_mock_upsert.call_args.kwargs["password"], "real-pass-456")

    def test_webdav_skip_when_builtin_is_placeholder(self):
        """文件 password 是占位符时归 skipped（非 failed）"""
        config_data = _config_data(webdav={
            "url": "https://dav.example.com/dav/", "username": "user",
            "path": "/", "auto_backup_enabled": 0,
            "auto_backup_schedule": "0 2 * * *", "password": "********"
        })
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["webdav_config"],
        )
        self.assertEqual(results["success"], [])
        self.assertEqual(results["failed"], [])
        skipped_types = [s["type"] for s in results["skipped"]]
        self.assertIn("webdav_config", skipped_types)

    def test_webdav_skip_when_config_is_null(self):
        """webdav_config 为 null 时归 skipped"""
        config_data = _config_data(webdav=None)
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=["webdav_config"],
        )
        skipped_types = [s["type"] for s in results["skipped"]]
        self.assertIn("webdav_config", skipped_types)


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

    def test_sk_test_is_not_placeholder(self):
        """sk-test 是系统内置默认 key，不再视为占位符（忠实还原）"""
        from app.services.config_export import _is_placeholder
        self.assertFalse(_is_placeholder("sk-test"))

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


class TestImportSelectedItemsAuto(unittest.TestCase):
    """selected_items 为空/None 时自动导入全部存在的项"""

    @patch("app.services.config_export.upsert_webdav_config")
    @patch("app.services.config_export.upsert_siyuan_config")
    @patch("app.services.config_export.insert_provider")
    @patch("app.db.provider_dao.get_provider_by_id", return_value=None)
    @patch("app.services.config_export.get_all_providers")
    def test_empty_selected_items_imports_all(
        self, _mock_get_all, _mock_get_by_id, _mock_insert,
        _mock_upsert_siyuan, _mock_upsert_webdav
    ):
        """selected_items 传 None 时自动导入 providers/siyuan/webdav（不含 downloader）"""
        config_data = _config_data(
            providers=[{"id": "openai", "name": "OpenAI", "base_url": "u",
                        "logo": "", "type": "openai", "enabled": 1, "api_key": "sk-real"}],
            siyuan={"api_url": "u", "default_notebook": "", "enabled": 1, "api_token": "tok"},
            webdav={"url": "u", "username": "u", "path": "/", "auto_backup_enabled": 0,
                    "auto_backup_schedule": "0 2 * * *", "password": "pw"},
            downloader={"enabled_platforms": ["bilibili"]},
        )
        results = ConfigImporter.import_configs(
            config_data=config_data,
            selected_items=None,  # 触发全导入
        )
        success_types = [s["type"] for s in results["success"]]
        self.assertIn("providers", success_types)
        self.assertIn("siyuan_config", success_types)
        self.assertIn("webdav_config", success_types)
        # downloader_config 不自动导入
        self.assertNotIn("downloader_config", success_types)


if __name__ == "__main__":
    unittest.main()
