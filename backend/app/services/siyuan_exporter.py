import requests
import re
from pathlib import Path
from app.utils.logger import get_logger
from app.db.siyuan_config_dao import get_config
from app.db.siyuan_export_history_dao import add_export_record

logger = get_logger(__name__)

# 笔记输出目录
NOTE_OUTPUT_DIR = Path(__file__).parent.parent.parent / "note_results"


class SiyuanExporter:
    """思源笔记导出服务"""

    def __init__(self, config=None):
        self.config = config or get_config()

    def _get_headers(self):
        """获取请求头"""
        return {
            "Authorization": f"Token {self.config.api_token}",
            "Content-Type": "application/json"
        }

    def get_notebooks(self):
        """获取笔记本列表"""
        try:
            url = f"{self.config.api_url.rstrip('/')}/api/notebook/lsNotebooks"
            # 思源API需要使用POST方法，并传递空的JSON body
            response = requests.post(url, headers=self._get_headers(), json={}, timeout=10)
            
            # 检查响应是否为空
            if not response.text or response.text.strip() == "":
                logger.error("Empty response from Siyuan API")
                raise Exception("思源笔记返回空响应")
            
            result = response.json()

            if result.get("code") != 0:
                raise Exception(result.get("msg", "获取笔记本列表失败"))

            # 注意：返回的数据结构是 {"notebooks": [...]}
            notebooks_data = result.get("data", {})
            notebooks = notebooks_data.get("notebooks", []) if isinstance(notebooks_data, dict) else notebooks_data
            logger.info(f"获取到 {len(notebooks)} 个笔记本")
            return notebooks
        except requests.exceptions.RequestException as e:
            logger.error(f"获取笔记本列表网络错误: {e}")
            raise Exception(f"网络错误: {str(e)}")
        except ValueError as e:
            logger.error(f"JSON parse error: {e}, response: {response.text[:200]}")
            raise Exception("响应格式错误")
        except Exception as e:
            logger.error(f"获取笔记本列表失败: {e}")
            raise

    def export_note(self, task_id: str, title: str = None):
        """
        导出笔记到思源笔记

        Args:
            task_id: BiliNote 任务 ID
            title: 笔记标题（可选）

        Returns:
            dict: 包含思源笔记文档 ID 和路径
        """
        try:
            # 读取 Markdown 内容
            markdown_file = NOTE_OUTPUT_DIR / f"{task_id}_markdown.md"
            if not markdown_file.exists():
                raise FileNotFoundError(f"笔记文件不存在: {task_id}")

            markdown_content = markdown_file.read_text(encoding="utf-8")
            if not markdown_content.strip():
                raise ValueError("笔记内容为空")

            # 适配 Markdown 内容
            adapted_content = self._adapt_markdown(markdown_content)

            # 生成文档路径
            doc_title = title or f"笔记_{task_id[:8]}"
            safe_title = re.sub(r'[\\/*?:"<>|]', '', doc_title).strip()
            doc_path = f"/BiliNote/{safe_title}.md"

            # 调用思源笔记官方 API
            url = f"{self.config.api_url.rstrip('/')}/api/filetree/createDocWithMd"
            payload = {
                "notebook": self.config.default_notebook,
                "path": doc_path,
                "markdown": adapted_content
            }

            response = requests.post(url, headers=self._get_headers(), json=payload, timeout=30)
            result = response.json()

            if result.get("code") != 0:
                error_msg = result.get("msg", "导出失败")
                logger.error(f"思源笔记 API 返回错误: {error_msg}")
                raise Exception(error_msg)

            # 成功：提取返回的数据
            data = result.get("data", {})
            logger.info(f"思源API返回的data类型: {type(data)}, 内容: {data}")
            
            # 处理data可能是字符串的情况
            if isinstance(data, str):
                siyuan_doc_id = data  # 如果data直接是文档ID字符串
            elif isinstance(data, dict):
                siyuan_doc_id = data.get("id") or data.get("root_id")  # 根据官方 API 返回
            else:
                siyuan_doc_id = str(data) if data else None

            # 记录导出历史
            add_export_record(
                task_id=task_id,
                siyuan_doc_id=siyuan_doc_id,
                notebook_id=self.config.default_notebook,
                doc_path=doc_path,
                status="success"
            )

            logger.info(f"笔记导出成功: task_id={task_id}, siyuan_doc_id={siyuan_doc_id}")
            return {
                "siyuan_doc_id": siyuan_doc_id,
                "doc_path": doc_path,
                "notebook_id": self.config.default_notebook
            }

        except FileNotFoundError as e:
            logger.error(f"笔记文件不存在: {e}")
            add_export_record(task_id=task_id, status="failed", error_message=str(e))
            raise
        except ValueError as e:
            logger.error(f"笔记内容无效: {e}")
            add_export_record(task_id=task_id, status="failed", error_message=str(e))
            raise
        except Exception as e:
            logger.error(f"导出笔记失败: task_id={task_id}, error: {e}")
            add_export_record(task_id=task_id, status="failed", error_message=str(e))
            raise

    def _adapt_markdown(self, content: str) -> str:
        """适配 Markdown 内容为思源笔记格式"""
        # 移除内部锚点链接
        content = re.sub(r'\[([^\]]+)\]\(#([^\)]+)\)', r'\1', content)
        # 替换其他不兼容格式（如有需要）
        return content

    def _remove_anchors(self, content: str) -> str:
        """移除内部锚点（已合并到 _adapt_markdown）"""
        return self._adapt_markdown(content)

    def test_connection(self):
        """测试连接"""
        try:
            # 尝试获取笔记本列表
            self.get_notebooks()
            return True, "连接成功"
        except Exception as e:
            return False, str(e)
