import os
import re
from pathlib import Path
from urllib.parse import quote
from markdown_pdf import MarkdownPdf, Section
from dotenv import load_dotenv

load_dotenv()

# 使用统一的路径管理工具
from app.utils.path_helper import (
    PROJECT_ROOT,
    get_export_cache_path,
    IMAGE_BASE_URL,
)

# 静态文件基础路径
STATIC_BASE = PROJECT_ROOT / "static"


class ExportUtils:
    def __init__(self, **kwargs):
        # 路径由 path_helper 统一管理，不需要在这里创建
        print(f"静态文件路径: {STATIC_BASE}")
        print(f"图片基础URL: {IMAGE_BASE_URL}")

    def _embed_image_as_base64(self, img_path: str) -> str:
        """
        将图片转换为 base64 格式嵌入
        """
        import base64
        import mimetypes

        try:
            # 获取 MIME 类型
            mime_type, _ = mimetypes.guess_type(img_path)
            if not mime_type:
                # 根据扩展名推断
                ext = os.path.splitext(img_path)[1].lower()
                mime_map = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.bmp': 'image/bmp',
                    '.webp': 'image/webp',
                    '.svg': 'image/svg+xml'
                }
                mime_type = mime_map.get(ext, 'image/png')

            # 读取图片文件并转换为 base64
            with open(img_path, 'rb') as f:
                img_data = f.read()

            base64_data = base64.b64encode(img_data).decode('utf-8')
            return f"data:{mime_type};base64,{base64_data}"

        except Exception as e:
            print(f"图片 base64 编码失败 {img_path}: {str(e)}")
            return None

    def _get_normalized_path(self, path: str) -> str:
        """
        获取规范化的绝对路径
        """
        return os.path.normpath(os.path.abspath(path))

    def _replace_static_paths_with_absolute(self, content: str) -> str:
        """
        将 Markdown 中的图片路径替换为 base64 内嵌格式
        这样可以确保图片在 PDF 中正确显示
        """

        def repl(match):
            # 捕获 alt 文本和路径
            alt_text = match.group(1) if match.group(1) else ""
            img_path = match.group(2).strip()

            print(f"处理图片路径: {img_path}")

            # 处理 /static/ 开头的路径
            if img_path.startswith("/static/"):
                # 构建绝对路径
                relative_path = img_path.lstrip("/")  # 移除开头的 /
                abs_path = PROJECT_ROOT / relative_path
                abs_path = self._get_normalized_path(str(abs_path))

                # 检查文件是否存在并转换为 base64
                if os.path.exists(abs_path):
                    base64_uri = self._embed_image_as_base64(abs_path)
                    if base64_uri:
                        print(f"图片转换为 base64 成功: {img_path}")
                        return f"![{alt_text}]({base64_uri})"
                    else:
                        print(f"图片 base64 转换失败: {abs_path}")
                        return f"![{alt_text}](图片转换失败: {img_path})"
                else:
                    print(f"警告：图片文件不存在 {abs_path}")
                    return f"![{alt_text}](图片不存在: {img_path})"

            # 处理相对路径（相对于 STATIC_BASE）
            elif not img_path.startswith(('http://', 'https://', 'data:')):
                # 尝试多个可能的路径
                possible_paths = [
                    STATIC_BASE / img_path,
                    Path(img_path).resolve(),
                    PROJECT_ROOT / img_path
                ]

                for abs_path in possible_paths:
                    abs_path = self._get_normalized_path(str(abs_path))
                    if os.path.exists(abs_path):
                        base64_uri = self._embed_image_as_base64(abs_path)
                        if base64_uri:
                            print(f"相对路径图片转换为 base64 成功: {img_path}")
                            return f"![{alt_text}]({base64_uri})"
                        break

                print(f"警告：图片文件未找到 {img_path}")
                return f"![{alt_text}](图片未找到: {img_path})"

            # HTTP/HTTPS 和 data: 路径保持不变
            elif img_path.startswith(('http://', 'https://', 'data:')):
                print(f"网络图片或 data URI 保持不变: {img_path[:50]}...")
                return match.group(0)

            # 其他情况保持不变
            return match.group(0)

        # 使用更精确的正则表达式匹配图片语法
        # 匹配 ![alt text](path) 格式
        pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
        result = re.sub(pattern, repl, content)

        print("图片路径处理完成")
        return result

    def _to_pdf(self, content: str, title: str, task_id: str = None,
                author_id: str = None, author_name: str = None,
                video_id: str = None, platform: str = ""):
        """
        将 Markdown 内容转换为 PDF，存到四级目录

        :param content: Markdown 内容
        :param title: 标题
        :param task_id: 任务 ID
        :param author_id: 博主 ID（必须）
        :param author_name: 博主名称
        :param video_id: 视频 ID
        :param platform: 平台标识
        """
        if not author_id:
            raise ValueError("导出 PDF 需要 author_id 参数")

        try:
            pdf = MarkdownPdf(optimize=True)
            pdf.add_section(Section(content))

            save_path = get_export_cache_path(
                author_id, author_name, video_id, title,
                task_id, "default", "pdf", platform
            )

            pdf.save(str(save_path))
            print(f"PDF 导出成功: {save_path}")
            return str(save_path)

        except Exception as e:
            print(f"PDF 导出失败: {str(e)}")
            print("尝试使用基本配置...")
            try:
                pdf = MarkdownPdf()
                pdf.add_section(Section(content))

                save_path = get_export_cache_path(
                    author_id, author_name, video_id, title,
                    task_id, "default", "pdf", platform
                )

                pdf.save(str(save_path))
                print(f"基本配置 PDF 导出成功: {save_path}")
                return str(save_path)
            except Exception as e2:
                print(f"基本配置也失败: {str(e2)}")
                raise e2

    def export(self, output_format: str, title: str, content: str, task_id: str = None,
               author_id: str = None, author_name: str = None,
               video_id: str = None, platform: str = "") -> str:
        """
        导出内容为指定格式
        支持格式：pdf, html, word/docx, image/png
        
        :param output_format: 导出格式
        :param title: 标题
        :param content: 内容
        :param task_id: 任务 ID（用于确定保存路径）
        """
        content = content.strip()

        # 处理图片路径
        print("开始处理图片路径...")
        content = self._replace_static_paths_with_absolute(content)

        output_format = output_format.lower()

        try:
            if output_format == "pdf":
                save_path = self._to_pdf(content, title, task_id, author_id, author_name, video_id, platform)
            elif output_format == "html":
                save_path = self._to_html(content, title, task_id)
            elif output_format in ["word", "docx"]:
                save_path = self._to_word(content, title, task_id)
            elif output_format in ["image", "png"]:
                save_path = self._to_image(content, title, task_id)
            else:
                supported_formats = ["pdf", "html", "word/docx", "image/png"]
                raise ValueError(f"不支持的导出格式: {output_format}. 支持的格式: {', '.join(supported_formats)}")

            print(f"导出完成: {save_path}")
            return save_path

        except Exception as e:
            print(f"导出失败: {str(e)}")
            raise e

    def get_supported_formats(self):
        """
        返回支持的导出格式列表
        """
        return {
            "pdf": "PDF 文档",
            "html": "HTML 网页",
            "word": "Word 文档 (.docx)",
            "docx": "Word 文档 (.docx)",
            "image": "PNG 图片",
            "png": "PNG 图片"
        }
    def debug_paths(self):
        """
        调试方法：打印重要路径信息
        """
        print("=== 路径调试信息 ===")
        print(f"PROJECT_ROOT: {PROJECT_ROOT}")
        print(f"STATIC_BASE: {STATIC_BASE}")
        print(f"IMAGE_BASE_URL: {IMAGE_BASE_URL}")
        print("==================")

if __name__ == '__main__':

    ExportUtils().export("pdf",title='测试',content='''# 视频笔记：Facial Recognition Forces My Coworkers to Do Their Dishes

## 简介
该视频展示了团队如何利用面部识别技术来监控和激励同事清洗餐具。通过结合硬件和软件，团队开发了一个“Dish Watcher”系统，旨在识别并提醒那些未清洁餐具的人。

## 背景
- 团队面临的问题是同事们不愿意清洗餐具。
- 为解决这一问题，团队决定在不告知的情况下使用技术来监控厨房区域。

## 实验设计
1\. **设备安装**
- 使用Raspberry Pi和隐藏摄像头来捕捉厨房水槽的活动。
- 摄像头只在有人在水槽附近活动时录制，以节省存储空间。

2\. **软件开发**
- 使用Cursor AI和Meta的项目来分析视频。
- 系统能识别人员特征如发型、服装，并将结果发送到Discord服务器以提醒团队。

3\. **面部识别**
- 通过视频流实时分析来判断是否有人留下了脏餐具。
- 系统能识别并记录下未清洗餐具的人的详细特征。

![](/static/screenshots/screenshot_000_a61be29d-06ae-42ee-ac38-2d0b1db394f3.jpg)* 展示了堆积的脏餐具，问题的严重性可见一斑。

## 实验过程
- 系统成功捕获了少数“罪犯”，并通过Discord进行了通知。
- 计划将摄像头隐藏在厨房的画作后，使其更加隐蔽。

![](/static/screenshots/screenshot_001_e9d1c7ad-509e-4c7d-a718-a09193e97724.jpg)* SAM 介绍了项目的背景。

## 结果
- 实验初期，系统有效地识别了不清洗餐具的同事。
- 由于摄像头的存在，同事们开始自觉清洗餐具，长时间未发现新的“罪犯”。

## 思考与改进
- 团队意识到仅仅通过惩罚来改变行为可能效果有限，考虑奖励来激励清洗餐具。
- 系统将改进为奖励机制，记录并表扬那些清洗餐具的人。

## 总结
这次实验展示了技术在工作场所行为管理中的应用潜力。通过实验，团队不仅解决了餐具清洗的问题，还对如何更有效地激励员工有了更深的认识。

![](/static/screenshots/screenshot_002_f1ca0c20-c657-417f-be78-7958bf0e7a4b.jpg)* 展示了系统对某位同事洗碗的实时面部识别。

## 结论
- 应用技术可以有效改善工作环境中的小问题。
- 积极的激励比惩罚更能驱动行为改变。

通过这次实验，团队不仅解决了餐具堆积的问题，还为未来更复杂的行为管理系统奠定了基础。 ''',)

