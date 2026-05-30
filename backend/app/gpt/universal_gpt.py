from app.gpt.base import GPT
from app.gpt.prompt_builder import generate_base_prompt
from app.models.gpt_model import GPTSource
from app.gpt.prompt import BASE_PROMPT, AI_SUM, SCREENSHOT, LINK
from app.gpt.utils import fix_markdown
from app.models.transcriber_model import TranscriptSegment
from datetime import timedelta
from typing import List

# 限制发送给 GPT 的最大图片数量，避免 413 Request Entity Too Large
MAX_IMAGES_FOR_GPT = 3

# 不支持视觉输入的供应商列表（纯文本模型）
NON_VISION_PROVIDERS = ['deepseek', 'DeepSeek']


class UniversalGPT(GPT):
    def __init__(self, client, model: str, temperature: float = 0.7, provider_name: str = None):
        self.client = client
        self.model = model
        self.temperature = temperature
        self.screenshot = False
        self.link = False
        self.provider_name = provider_name  # 供应商名称，用于判断是否支持视觉

    def _supports_vision(self) -> bool:
        """判断当前供应商是否支持视觉（图像输入）"""
        if self.provider_name and self.provider_name.lower() in [n.lower() for n in NON_VISION_PROVIDERS]:
            return False
        return True

    def _format_time(self, seconds: float) -> str:
        return str(timedelta(seconds=int(seconds)))[2:]

    def _build_segment_text(self, segments: List[TranscriptSegment]) -> str:
        return "\n".join(
            f"{self._format_time(seg.start)} - {seg.text.strip()}"
            for seg in segments
        )

    def ensure_segments_type(self, segments) -> List[TranscriptSegment]:
        return [TranscriptSegment(**seg) if isinstance(seg, dict) else seg for seg in segments]

    def create_messages(self, segments: List[TranscriptSegment], **kwargs):

        content_text = generate_base_prompt(
            title=kwargs.get('title'),
            segment_text=self._build_segment_text(segments),
            tags=kwargs.get('tags'),
            _format=kwargs.get('_format'),
            style=kwargs.get('style'),
            extras=kwargs.get('extras'),
            output_language=kwargs.get('output_language'),
        )

        # ⛳ 组装 content 数组，支持 text + image_url 混合
        content = [{"type": "text", "text": content_text}]
        video_img_urls = kwargs.get('video_img_urls', [])

        # 只有支持视觉的供应商才发送图片
        if self._supports_vision() and video_img_urls:
            # 限制图片数量，避免请求体过大导致 413 错误
            limited_urls = video_img_urls[:MAX_IMAGES_FOR_GPT]

            for url in limited_urls:
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": url,
                        "detail": "low"  # 使用低分辨率模式减少图片大小
                    }
                })

        #  正确格式：整体包在一个 message 里，role + content array
        messages = [{
            "role": "user",
            "content": content
        }]

        return messages

    def list_models(self):
        return self.client.models.list()

    def summarize(self, source: GPTSource) -> str:
        self.screenshot = source.screenshot
        self.link = source.link
        source.segment = self.ensure_segments_type(source.segment)

        messages = self.create_messages(
            source.segment,
            title=source.title,
            tags=source.tags,
            video_img_urls=source.video_img_urls,
            _format=source._format,
            style=source.style,
            extras=source.extras,
            output_language=source.output_language,
        )
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=0.7
        )
        return response.choices[0].message.content.strip()

    def chat(self, prompt: str) -> str:
        """简单的聊天方法，直接发送 prompt 获取响应"""
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self.temperature
        )
        return response.choices[0].message.content.strip()
