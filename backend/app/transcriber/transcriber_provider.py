import os
import platform
import asyncio
from enum import Enum
from concurrent.futures import ThreadPoolExecutor

from app.transcriber.groq import GroqTranscriber
from app.transcriber.whisper import WhisperTranscriber
from app.transcriber.bcut import BcutTranscriber
from app.transcriber.kuaishou import KuaishouTranscriber
from app.utils.logger import get_logger

logger = get_logger(__name__)

# 预热状态
_warm_up_status = {
    "in_progress": False,
    "completed": False,
    "error": None,
    "transcriber_type": None,
}

class TranscriberType(str, Enum):
    FAST_WHISPER = "fast-whisper"
    MLX_WHISPER = "mlx-whisper"
    BCUT = "bcut"
    KUAISHOU = "kuaishou"
    GROQ = "groq"

# 仅在 Apple 平台启用 MLX Whisper
MLX_WHISPER_AVAILABLE = False
if platform.system() == "Darwin" and os.environ.get("TRANSCRIBER_TYPE") == "mlx-whisper":
    try:
        from app.transcriber.mlx_whisper_transcriber import MLXWhisperTranscriber
        MLX_WHISPER_AVAILABLE = True
        logger.info("MLX Whisper 可用，已导入")
    except ImportError:
        logger.warning("MLX Whisper 导入失败，可能未安装或平台不支持")

logger.info('初始化转录服务提供器')

# 转录器单例缓存
_transcribers = {
    TranscriberType.FAST_WHISPER: None,
    TranscriberType.MLX_WHISPER: None,
    TranscriberType.BCUT: None,
    TranscriberType.KUAISHOU: None,
    TranscriberType.GROQ: None,
}

# 公共实例初始化函数
def _init_transcriber(key: TranscriberType, cls, *args, **kwargs):
    if _transcribers[key] is None:
        logger.info(f'创建 {cls.__name__} 实例: {key}')
        try:
            _transcribers[key] = cls(*args, **kwargs)
            logger.info(f'{cls.__name__} 创建成功')
        except Exception as e:
            logger.error(f"{cls.__name__} 创建失败: {e}")
            raise
    return _transcribers[key]

# 各类型获取方法
def get_groq_transcriber():
    return _init_transcriber(TranscriberType.GROQ, GroqTranscriber)

def get_whisper_transcriber(model_size="base", device="cuda"):
    return _init_transcriber(TranscriberType.FAST_WHISPER, WhisperTranscriber, model_size=model_size, device=device)

def get_bcut_transcriber():
    return _init_transcriber(TranscriberType.BCUT, BcutTranscriber)

def get_kuaishou_transcriber():
    return _init_transcriber(TranscriberType.KUAISHOU, KuaishouTranscriber)

def get_mlx_whisper_transcriber(model_size="base"):
    if not MLX_WHISPER_AVAILABLE:
        logger.warning("MLX Whisper 不可用，请确保在 Apple 平台且已安装 mlx_whisper")
        raise ImportError("MLX Whisper 不可用")
    return _init_transcriber(TranscriberType.MLX_WHISPER, MLXWhisperTranscriber, model_size=model_size)

# 通用入口
def get_transcriber(transcriber_type="fast-whisper", model_size="base", device="cuda"):
    """
    获取指定类型的转录器实例

    参数:
        transcriber_type: 支持 "fast-whisper", "mlx-whisper", "bcut", "kuaishou", "groq"
        model_size: 模型大小，适用于 whisper 类
        device: 设备类型（如 cuda / cpu），仅 whisper 使用

    返回:
        对应类型的转录器实例
    """
    logger.info(f'请求转录器类型: {transcriber_type}')

    try:
        transcriber_enum = TranscriberType(transcriber_type)
    except ValueError:
        logger.warning(f'未知转录器类型 "{transcriber_type}"，默认使用 fast-whisper')
        transcriber_enum = TranscriberType.FAST_WHISPER

    whisper_model_size = os.environ.get("WHISPER_MODEL_SIZE", model_size)

    if transcriber_enum == TranscriberType.FAST_WHISPER:
        return get_whisper_transcriber(whisper_model_size, device=device)

    elif transcriber_enum == TranscriberType.MLX_WHISPER:
        if not MLX_WHISPER_AVAILABLE:
            logger.warning("MLX Whisper 不可用，回退到 fast-whisper")
            return get_whisper_transcriber(whisper_model_size, device=device)
        return get_mlx_whisper_transcriber(whisper_model_size)

    elif transcriber_enum == TranscriberType.BCUT:
        return get_bcut_transcriber()

    elif transcriber_enum == TranscriberType.KUAISHOU:
        return get_kuaishou_transcriber()

    elif transcriber_enum == TranscriberType.GROQ:
        return get_groq_transcriber()

    # fallback
    logger.warning(f'未识别转录器类型 "{transcriber_type}"，使用 fast-whisper 作为默认')
    return get_whisper_transcriber(whisper_model_size, device=device)


def _do_warm_up(transcriber_type: str, model_size: str = "base", device: str = "cuda"):
    """在后台线程中执行预热"""
    global _warm_up_status
    try:
        _warm_up_status["in_progress"] = True
        _warm_up_status["transcriber_type"] = transcriber_type
        logger.info(f"[预热] 开始预热转写器: {transcriber_type}")

        # 获取转写器实例（这会触发模型加载）
        transcriber = get_transcriber(transcriber_type, model_size=model_size, device=device)

        # 对于 Whisper 类型，可以尝试转写一个空的或小的测试音频来完全预热模型
        # 这里只初始化模型，不进行实际转写，避免创建测试文件
        if transcriber_type in [TranscriberType.FAST_WHISPER.value, TranscriberType.MLX_WHISPER.value]:
            logger.info(f"[预热] 模型 {model_size} 已加载完成")

        _warm_up_status["completed"] = True
        _warm_up_status["error"] = None
        logger.info(f"[预热] 转写器预热完成: {transcriber_type}")

    except Exception as e:
        _warm_up_status["completed"] = False
        _warm_up_status["error"] = str(e)
        logger.error(f"[预热] 转写器预热失败: {e}")
    finally:
        _warm_up_status["in_progress"] = False


async def warm_up_transcriber_async(
    transcriber_type: str = None,
    model_size: str = "base",
    device: str = "cuda"
):
    """
    异步预热转写器，不阻塞应用启动

    参数:
        transcriber_type: 转写器类型，默认从环境变量读取
        model_size: 模型大小，仅 whisper 类型使用
        device: 设备类型，仅 whisper 类型使用
    """
    global _warm_up_status

    # 从环境变量获取默认类型
    if transcriber_type is None:
        transcriber_type = os.getenv("TRANSCRIBER_TYPE", "fast-whisper")

    # 从环境变量获取默认模型大小
    whisper_model_size = os.environ.get("WHISPER_MODEL_SIZE", model_size)

    # API 类型的转写器不需要预热（模型在远程服务器）
    api_based_transcribers = [
        TranscriberType.GROQ.value,
        TranscriberType.BCUT.value,
        TranscriberType.KUAISHOU.value,
    ]

    if transcriber_type in api_based_transcribers:
        logger.info(f"[预热] {transcriber_type} 是 API 类型转写器，无需预热模型")
        _warm_up_status["completed"] = True
        _warm_up_status["transcriber_type"] = transcriber_type
        return

    # MLX Whisper 预热检查
    if transcriber_type == TranscriberType.MLX_WHISPER.value:
        if not MLX_WHISPER_AVAILABLE:
            logger.warning("[预热] MLX Whisper 不可用，跳过预热")
            return

    logger.info(f"[预热] 开始后台预热转写器: {transcriber_type} (模型大小: {whisper_model_size})")

    # 在后台线程执行预热
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=1)

    await loop.run_in_executor(
        executor,
        _do_warm_up,
        transcriber_type,
        whisper_model_size,
        device
    )

    executor.shutdown(wait=False)


def get_warm_up_status() -> dict:
    """获取预热状态"""
    return _warm_up_status.copy()


def is_transcriber_ready() -> bool:
    """检查转写器是否已准备好"""
    if _warm_up_status["completed"]:
        return True

    # 尝试获取当前配置的转写器类型
    transcriber_type_str = os.getenv("TRANSCRIBER_TYPE", "fast-whisper")
    try:
        transcriber_enum = TranscriberType(transcriber_type_str)
        return _transcribers.get(transcriber_enum) is not None
    except ValueError:
        # 如果环境变量值无效，检查默认的 fast-whisper
        return _transcribers.get(TranscriberType.FAST_WHISPER) is not None
