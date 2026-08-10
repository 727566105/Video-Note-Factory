"""自托管图形验证码生成与校验。

用于登录暴力破解防护：连续失败达到阈值后要求输入图形验证码。
- 内存存储（重启即失效），threading.Lock 保护
- 一次性使用：verify 校验通过后即删除，防重放
- 排除易混淆字符 0/O/1/I，避免人工识别困难
"""
import base64
import io
import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Dict, Tuple

from PIL import Image, ImageDraw, ImageFont

CAPTCHA_TTL_SECONDS = 300  # 5 分钟有效
CAPTCHA_LEN = 4
# 排除易混淆字符 0/O/1/I，全部大写便于识别
_CODE_CHARS = string.ascii_uppercase.replace("O", "").replace("I", "").replace(
    "0", ""
) + "23456789"
_CODE_CHARS = "".join(dict.fromkeys(_CODE_CHARS))  # 去重

# 连续失败达到该次数后要求验证码（渐进式）
CAPTCHA_REQUIRED_FAILURES = 2

_IMAGE_WIDTH = 140
_IMAGE_HEIGHT = 48


class CaptchaManager:
    """图形验证码管理器（内存存储 + 锁保护）。"""

    def __init__(self, ttl_seconds: int = CAPTCHA_TTL_SECONDS):
        self._ttl_seconds = ttl_seconds
        self._store: Dict[str, Tuple[str, datetime]] = {}
        self._lock = Lock()

    def generate(self) -> Tuple[str, str]:
        """生成一张验证码，返回 (captcha_id, 图片 base64)。"""
        code = "".join(random.choices(_CODE_CHARS, k=CAPTCHA_LEN))
        captcha_id = str(uuid.uuid4())
        image_b64 = self._render(code)

        now = datetime.now(timezone.utc)
        with self._lock:
            self._cleanup(now)
            self._store[captcha_id] = (
                code,
                now + timedelta(seconds=self._ttl_seconds),
            )
        return captcha_id, image_b64

    def verify(self, captcha_id: str, code: str) -> bool:
        """校验验证码（一次性）。大小写不敏感。"""
        if not captcha_id or not code:
            return False
        now = datetime.now(timezone.utc)
        # pop：无论对错都作废，防重放 / 防暴力遍历
        with self._lock:
            entry = self._store.pop(captcha_id, None)
        if not entry:
            return False
        answer, expires_at = entry
        if expires_at <= now:
            return False
        return code.strip().lower() == answer.lower()

    def _cleanup(self, now: datetime) -> None:
        """清理过期项。调用方需持有 self._lock。"""
        expired = [
            cid
            for cid, (_, expires_at) in self._store.items()
            if expires_at <= now
        ]
        for cid in expired:
            self._store.pop(cid, None)

    def _render(self, code: str) -> str:
        """用 Pillow 画一张带干扰线/点的验证码图片，返回 PNG base64。"""
        img = Image.new("RGB", (_IMAGE_WIDTH, _IMAGE_HEIGHT), "white")
        draw = ImageDraw.Draw(img)
        try:
            font = ImageFont.load_default(size=30)
        except TypeError:  # 旧版 Pillow 不支持 size 参数
            font = ImageFont.load_default()

        # 干扰线
        for _ in range(5):
            x0 = random.randint(0, _IMAGE_WIDTH)
            y0 = random.randint(0, _IMAGE_HEIGHT)
            x1 = random.randint(0, _IMAGE_WIDTH)
            y1 = random.randint(0, _IMAGE_HEIGHT)
            draw.line((x0, y0, x1, y1), fill=self._random_color(180), width=1)

        # 干扰点
        for _ in range(60):
            x = random.randint(0, _IMAGE_WIDTH - 1)
            y = random.randint(0, _IMAGE_HEIGHT - 1)
            draw.point((x, y), fill=self._random_color(220))

        # 字符（逐个带随机偏移/颜色/旋转，提高 OCR 难度）
        char_width = _IMAGE_WIDTH / CAPTCHA_LEN
        for i, ch in enumerate(code):
            color = self._random_color(100)
            char_img = Image.new("RGBA", (40, 40), (255, 255, 255, 0))
            c_draw = ImageDraw.Draw(char_img)
            c_draw.text((6, 4), ch, font=font, fill=(*color, 255))
            char_img = char_img.rotate(
                random.randint(-25, 25), expand=True, resample=Image.BICUBIC
            )
            x = int(i * char_width + char_width / 2 - 14 + random.randint(-4, 4))
            y = random.randint(0, _IMAGE_HEIGHT - 40)
            img.paste(char_img, (x, y), char_img)

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode()

    @staticmethod
    def _random_color(limit: int) -> Tuple[int, int, int]:
        return (
            random.randint(0, limit),
            random.randint(0, limit),
            random.randint(0, limit),
        )


captcha_manager = CaptchaManager()
