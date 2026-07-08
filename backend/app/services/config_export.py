"""
配置导出/导入服务

提供系统配置的导出和导入功能：
- AI 模型设置
- 下载器配置
- 思源笔记配置
- Obsidian 配置
- WebDAV 备份配置

敏感信息（API Key、密码、Token）在导出时使用占位符替代，
导入时需要用户补充这些敏感信息。
"""
import json
import tempfile
import os
from datetime import datetime
from typing import Any, Literal
from app.utils.logger import get_logger
from app.db.provider_dao import get_all_providers, insert_provider, update_provider
from app.db.webdav_config_dao import get_config, upsert_config as upsert_webdav_config
from app.db.siyuan_config_dao import get_config as get_siyuan_config, upsert_config as upsert_siyuan_config
from app.db.obsidian_config_dao import get_config as get_obsidian_config, upsert_config as upsert_obsidian_config
from app.services.constant import SUPPORT_PLATFORM_MAP

logger = get_logger(__name__)

# 配置版本号
CONFIG_VERSION = "1.0"

# 敏感信息占位符
SENSITIVE_PLACEHOLDER = "********"

# 占位符集合：导出源端常存的假值，原样导入无意义
# 注意：只有导出时主动脱敏产生的 "********" 才视为占位符；
# "sk-test" 等是系统内置 provider 的默认 key，属于用户的真实状态，
# 应忠实还原，不再当作假值跳过。
_SENSITIVE_PLACEHOLDERS = {SENSITIVE_PLACEHOLDER}


def _is_placeholder(value: str | None) -> bool:
    """判断敏感信息值是否为空或占位符（应跳过导入）

    仅当值为 None/空串，或等于导出脱敏占位符 "********" 时才跳过。
    """
    if not value:
        return True
    return value in _SENSITIVE_PLACEHOLDERS


class ConfigExporter:
    """配置导出器"""

    @staticmethod
    def export_config(include_sensitive: bool = True) -> dict[str, Any]:
        """
        导出所有配置到字典格式

        Args:
            include_sensitive: 是否包含敏感信息（默认 True）

        Returns:
            dict: 包含所有配置的字典
        """
        logger.info(f"Starting config export (include_sensitive={include_sensitive})")

        configs: dict[str, Any] = {}

        # 导出 AI 模型设置
        try:
            providers = get_all_providers()
            configs["providers"] = [
                {
                    "id": p.id,
                    "name": p.name,
                    "logo": p.logo,
                    "type": p.type,
                    "base_url": p.base_url,
                    "enabled": p.enabled,
                    "api_key": p.api_key if include_sensitive else SENSITIVE_PLACEHOLDER,
                }
                for p in providers
            ]
            logger.info(f"Exported {len(providers)} providers")
        except Exception as e:
            logger.error(f"Failed to export providers: {e}")
            configs["providers"] = []

        # 导出下载器配置
        try:
            configs["downloader_config"] = {
                "enabled_platforms": list(SUPPORT_PLATFORM_MAP.keys())
            }
            logger.info(f"Exported downloader config: {configs['downloader_config']}")
        except Exception as e:
            logger.error(f"Failed to export downloader config: {e}")
            configs["downloader_config"] = {"enabled_platforms": []}

        # 导出思源笔记配置
        try:
            siyuan_config = get_siyuan_config()
            if siyuan_config:
                configs["siyuan_config"] = {
                    "api_url": siyuan_config.api_url,
                    "default_notebook": siyuan_config.default_notebook,
                    "enabled": siyuan_config.enabled,
                    "api_token": siyuan_config.api_token if include_sensitive else SENSITIVE_PLACEHOLDER,
                }
                logger.info("Exported Siyuan config")
            else:
                configs["siyuan_config"] = None
        except Exception as e:
            logger.error(f"Failed to export Siyuan config: {e}")
            configs["siyuan_config"] = None

        # 导出 WebDAV 配置
        try:
            webdav_config = get_config()
            if webdav_config:
                # 获取解密后的密码
                if include_sensitive:
                    from app.db.webdav_config_dao import get_decrypted_password
                    decrypted_password = get_decrypted_password()
                    password = decrypted_password if decrypted_password else SENSITIVE_PLACEHOLDER
                else:
                    password = SENSITIVE_PLACEHOLDER
                
                configs["webdav_config"] = {
                    "url": webdav_config.url,
                    "username": webdav_config.username,
                    "path": webdav_config.path,
                    "auto_backup_enabled": webdav_config.auto_backup_enabled,
                    "auto_backup_schedule": webdav_config.auto_backup_schedule,
                    "password": password,
                }
                logger.info("Exported WebDAV config")
            else:
                configs["webdav_config"] = None
        except Exception as e:
            logger.error(f"Failed to export WebDAV config: {e}")
            configs["webdav_config"] = None

        # 导出 Obsidian 配置
        try:
            obsidian_config = get_obsidian_config()
            if obsidian_config:
                configs["obsidian_config"] = {
                    "export_mode": obsidian_config.export_mode,
                    "vault_path": obsidian_config.vault_path,
                    "folder_path": obsidian_config.folder_path,
                    "attachments_folder": obsidian_config.attachments_folder,
                    "api_url": obsidian_config.api_url,
                    "api_key": obsidian_config.api_key if include_sensitive else SENSITIVE_PLACEHOLDER,
                    "enabled": obsidian_config.enabled,
                }
                logger.info("Exported Obsidian config")
            else:
                configs["obsidian_config"] = None
        except Exception as e:
            logger.error(f"Failed to export Obsidian config: {e}")
            configs["obsidian_config"] = None

        return {
            "version": CONFIG_VERSION,
            "exported_at": datetime.now().isoformat(),
            "include_sensitive": include_sensitive,
            "configs": configs
        }

    @staticmethod
    def save_configs_file(include_sensitive: bool = True) -> str:
        """
        保存配置到临时目录的 configs.json 文件

        Args:
            include_sensitive: 是否包含敏感信息（默认 True）

        Returns:
            str: configs.json 文件的完整路径
        """
        config_data = ConfigExporter.export_config(include_sensitive=include_sensitive)

        # 创建临时文件
        temp_dir = tempfile.gettempdir()
        config_file_path = os.path.join(temp_dir, "configs.json")

        try:
            with open(config_file_path, 'w', encoding='utf-8') as f:
                json.dump(config_data, f, ensure_ascii=False, indent=2)
            logger.info(f"Saved configs to: {config_file_path} (include_sensitive={include_sensitive})")
            return config_file_path
        except Exception as e:
            logger.error(f"Failed to save configs file: {e}")
            raise


class ConfigImporter:
    """配置导入器"""

    @staticmethod
    def validate_config_file(config_data: dict[str, Any]) -> tuple[bool, list[str]]:
        """
        验证配置文件格式

        Args:
            config_data: 解析后的配置数据

        Returns:
            tuple: (是否有效, 错误信息列表)
        """
        errors: list[str] = []

        # 检查版本号
        if "version" not in config_data:
            errors.append("缺少版本号字段")
        elif config_data["version"] != CONFIG_VERSION:
            errors.append(f"版本号不匹配，期望 {CONFIG_VERSION}，实际 {config_data['version']}")

        # 检查导出时间
        if "exported_at" not in config_data:
            errors.append("缺少导出时间字段")

        # 检查配置字段
        if "configs" not in config_data:
            errors.append("缺少配置字段")
        elif not isinstance(config_data["configs"], dict):
            errors.append("配置字段格式错误")

        return len(errors) == 0, errors

    @staticmethod
    def preview_configs(config_data: dict[str, Any]) -> dict[str, Any]:
        """
        生成配置预览

        Args:
            config_data: 解析后的配置数据

        Returns:
            dict: 包含可导入配置项的预览信息
        """
        preview = {
            "version": config_data.get("version", "unknown"),
            "exported_at": config_data.get("exported_at", ""),
            "available_items": [],
            "has_sensitive_data": False
        }

        configs = config_data.get("configs", {})

        # 检查 AI 模型设置
        if configs.get("providers"):
            preview["available_items"].append({
                "type": "providers",
                "name": "AI 模型设置",
                "count": len(configs["providers"]),
                "needs_credentials": True
            })

        # 检查下载器配置
        if configs.get("downloader_config"):
            preview["available_items"].append({
                "type": "downloader_config",
                "name": "下载器配置",
                "count": len(configs["downloader_config"].get("enabled_platforms", [])),
                "needs_credentials": False
            })

        # 检查思源笔记配置
        if configs.get("siyuan_config"):
            preview["available_items"].append({
                "type": "siyuan_config",
                "name": "思源笔记配置",
                "count": 1,
                "needs_credentials": True
            })

        # 检查 WebDAV 配置
        if configs.get("webdav_config"):
            preview["available_items"].append({
                "type": "webdav_config",
                "name": "WebDAV 备份配置",
                "count": 1,
                "needs_credentials": True
            })

        # 检查 Obsidian 配置
        if configs.get("obsidian_config"):
            preview["available_items"].append({
                "type": "obsidian_config",
                "name": "Obsidian 配置",
                "count": 1,
                "needs_credentials": True
            })

        # 检查是否包含敏感数据
        preview["has_sensitive_data"] = any(
            item.get("needs_credentials", False) for item in preview["available_items"]
        )

        return preview

    @staticmethod
    def import_configs(
        config_data: dict[str, Any],
        selected_items: list[str] | None = None,
        credentials: dict[str, dict[str, str]] | None = None
    ) -> dict[str, Any]:
        """
        执行配置导入

        Args:
            config_data: 解析后的配置数据
            selected_items: 要导入的配置项列表。为空/None 时自动导入全部存在的项
                （providers/siyuan_config/webdav_config，不含 downloader_config）
            credentials: 敏感信息字典，格式为 {"type": {"field": "value"}}
                例如: {"providers": {"openai": "sk-xxx"}, "webdav_config": {"password": "xxx"}}
                可选；为空时优先使用 config_data 中自带的敏感信息

        Returns:
            dict: 导入结果，包含成功和失败的配置项
        """
        results = {
            "success": [],
            "failed": [],
            "skipped": []
        }

        configs = config_data.get("configs", {})
        credentials = credentials or {}

        # selected_items 为空/None 时，自动展开为全部存在的配置项
        if not selected_items:
            selected_items = []
            if configs.get("providers"):
                selected_items.append("providers")
            if configs.get("siyuan_config"):
                selected_items.append("siyuan_config")
            if configs.get("webdav_config"):
                selected_items.append("webdav_config")
            if configs.get("obsidian_config"):
                selected_items.append("obsidian_config")
            # downloader_config 不自动加入（硬编码，必 skipped）

        # 导入 AI 模型设置
        if "providers" in selected_items:
            try:
                providers = configs.get("providers", [])
                provider_creds = credentials.get("providers", {})
                imported_count = 0

                for provider_data in providers:
                    provider_id = provider_data.get("id")
                    if not provider_id:
                        continue

                    # 检查是否已存在
                    existing = None
                    try:
                        from app.db.provider_dao import get_provider_by_id
                        existing = get_provider_by_id(provider_id)
                    except Exception:
                        pass

                    # 获取 API Key：优先用 credentials，其次用文件自带值
                    api_key = provider_creds.get(provider_id, "") or provider_data.get("api_key", "")

                    if _is_placeholder(api_key):
                        results["skipped"].append({
                            "type": "providers",
                            "id": provider_id,
                            "reason": "API Key 为空或占位符"
                        })
                        continue

                    if existing:
                        # 更新现有配置
                        update_provider(
                            provider_id,
                            name=provider_data.get("name"),
                            api_key=api_key,
                            base_url=provider_data.get("base_url"),
                            logo=provider_data.get("logo"),
                            type_=provider_data.get("type"),
                            enabled=provider_data.get("enabled", 1)
                        )
                    else:
                        # 创建新配置
                        insert_provider(
                            id=provider_id,
                            name=provider_data.get("name"),
                            api_key=api_key,
                            base_url=provider_data.get("base_url"),
                            logo=provider_data.get("logo"),
                            type_=provider_data.get("type"),
                            enabled=provider_data.get("enabled", 1)
                        )
                    imported_count += 1

                # 仅当至少有 1 个 provider 成功写入时才计入 success；
                # 否则不归 failed（占位符已逐个进 skipped），仅记日志
                if imported_count > 0:
                    results["success"].append({
                        "type": "providers",
                        "count": imported_count
                    })
                    logger.info(f"Imported {imported_count} providers")
                else:
                    logger.warning("No provider imported: all API Key are placeholder")
            except Exception as e:
                logger.error(f"Failed to import providers: {e}")
                results["failed"].append({
                    "type": "providers",
                    "error": str(e)
                })

        # 导入下载器配置（目前是硬编码的，跳过）
        if "downloader_config" in selected_items:
            results["skipped"].append({
                "type": "downloader_config",
                "reason": "下载器配置为硬编码，不支持导入"
            })

        # 导入思源笔记配置
        if "siyuan_config" in selected_items:
            try:
                siyuan_config = configs.get("siyuan_config")
                if not siyuan_config:
                    results["skipped"].append({
                        "type": "siyuan_config",
                        "reason": "配置为空"
                    })
                else:
                    # 获取 API Token：优先用 credentials，其次用文件自带值
                    siyuan_creds = credentials.get("siyuan_config", {})
                    api_token = siyuan_creds.get("api_token", "") or siyuan_config.get("api_token", "")

                    if _is_placeholder(api_token):
                        results["skipped"].append({
                            "type": "siyuan_config",
                            "reason": "API Token 为空或占位符"
                        })
                    else:
                        upsert_siyuan_config(
                            api_url=siyuan_config.get("api_url", ""),
                            api_token=api_token,
                            default_notebook=siyuan_config.get("default_notebook")
                        )
                        results["success"].append({
                            "type": "siyuan_config",
                            "count": 1
                        })
                        logger.info("Imported Siyuan config")
            except Exception as e:
                logger.error(f"Failed to import Siyuan config: {e}")
                results["failed"].append({
                    "type": "siyuan_config",
                    "error": str(e)
                })

        # 导入 WebDAV 配置
        if "webdav_config" in selected_items:
            try:
                webdav_config = configs.get("webdav_config")
                if not webdav_config:
                    results["skipped"].append({
                        "type": "webdav_config",
                        "reason": "配置为空"
                    })
                else:
                    # 获取密码：优先用 credentials，其次用文件自带值
                    webdav_creds = credentials.get("webdav_config", {})
                    password = webdav_creds.get("password", "") or webdav_config.get("password", "")

                    if _is_placeholder(password):
                        results["skipped"].append({
                            "type": "webdav_config",
                            "reason": "密码为空或占位符"
                        })
                    else:
                        upsert_webdav_config(
                            url=webdav_config.get("url", ""),
                            username=webdav_config.get("username", ""),
                            password=password,
                            path=webdav_config.get("path", "/"),
                            auto_backup_enabled=webdav_config.get("auto_backup_enabled", 0),
                            auto_backup_schedule=webdav_config.get("auto_backup_schedule", "0 2 * * *")
                        )
                        results["success"].append({
                            "type": "webdav_config",
                            "count": 1
                        })
                        logger.info("Imported WebDAV config")
            except Exception as e:
                logger.error(f"Failed to import WebDAV config: {e}")
                results["failed"].append({
                    "type": "webdav_config",
                    "error": str(e)
                })

        # 导入 Obsidian 配置
        if "obsidian_config" in selected_items:
            try:
                obsidian_config = configs.get("obsidian_config")
                if not obsidian_config:
                    results["skipped"].append({
                        "type": "obsidian_config",
                        "reason": "配置为空"
                    })
                else:
                    # 获取 API Key：优先用 credentials，其次用文件自带值
                    obsidian_creds = credentials.get("obsidian_config", {})
                    api_key = obsidian_creds.get("api_key", "") or obsidian_config.get("api_key", "")

                    # local 模式不需要 api_key，api 模式需要
                    export_mode = obsidian_config.get("export_mode", "local")
                    if export_mode == "api" and _is_placeholder(api_key):
                        results["skipped"].append({
                            "type": "obsidian_config",
                            "reason": "API Key 为空或占位符"
                        })
                    else:
                        upsert_obsidian_config(
                            export_mode=export_mode,
                            vault_path=obsidian_config.get("vault_path", ""),
                            folder_path=obsidian_config.get("folder_path", "videoNote/"),
                            attachments_folder=obsidian_config.get("attachments_folder", "attachments/"),
                            api_url=obsidian_config.get("api_url", ""),
                            api_key=api_key if export_mode == "api" else "",
                            enabled=obsidian_config.get("enabled", 1)
                        )
                        results["success"].append({
                            "type": "obsidian_config",
                            "count": 1
                        })
                        logger.info("Imported Obsidian config")
            except Exception as e:
                logger.error(f"Failed to import Obsidian config: {e}")
                results["failed"].append({
                    "type": "obsidian_config",
                    "error": str(e)
                })

        return results
