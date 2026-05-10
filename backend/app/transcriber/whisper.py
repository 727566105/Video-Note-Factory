from faster_whisper import WhisperModel

from app.decorators.timeit import timeit
from app.models.transcriber_model import TranscriptSegment, TranscriptResult
from app.transcriber.base import Transcriber
from app.utils.env_checker import is_cuda_available, is_torch_installed, is_openvino_available, is_intel_gpu_available
from app.utils.logger import get_logger
from app.utils.path_helper import get_model_dir

from events import transcription_finished
from pathlib import Path
import os
from tqdm import tqdm
from modelscope import snapshot_download


'''
 Size of the model to use (tiny, tiny.en, base, base.en, small, small.en, distil-small.en, medium, medium.en, distil-medium.en, large-v1, large-v2, large-v3, large, distil-large-v2, distil-large-v3, large-v3-turbo, or turbo
'''
logger=get_logger(__name__)

MODEL_MAP={
    "tiny": "pengzhendong/faster-whisper-tiny",
    'base':'pengzhendong/faster-whisper-base',
    'small':'pengzhendong/faster-whisper-small',
    'medium':'pengzhendong/faster-whisper-medium',
    'large-v1':'pengzhendong/faster-whisper-large-v1',
    'large-v2':'pengzhendong/faster-whisper-large-v2',
    'large-v3':'pengzhendong/faster-whisper-large-v3',
    'large-v3-turbo':'pengzhendong/faster-whisper-large-v3-turbo',
}

class WhisperTranscriber(Transcriber):
    def __init__(
            self,
            model_size: str = "base",
            device: str = 'cpu',
            compute_type: str = None,
            cpu_threads: int = 1,
    ):
        self.original_device = device
        self.device = self._determine_device(device)
        self.compute_type = self._determine_compute_type(compute_type)
        
        model_dir = get_model_dir("whisper")
        model_path = os.path.join(model_dir, f"whisper-{model_size}")
        if not Path(model_path).exists():
            logger.info(f"模型 whisper-{model_size} 不存在，开始下载...")
            repo_id = MODEL_MAP[model_size]
            model_path = snapshot_download(
                repo_id,
                local_dir=model_path,
            )
            logger.info("模型下载完成")

        logger.info(f"初始化 WhisperModel: device={self.device}, compute_type={self.compute_type}")
        self.model = WhisperModel(
            model_size_or_path=model_path,
            device=self.device,
            compute_type=self.compute_type,
            download_root=model_dir,
            cpu_threads=cpu_threads if self.device == 'cpu' else None,
        )

    def _determine_device(self, device: str) -> str:
        if device == 'openvino':
            if is_openvino_available() and is_intel_gpu_available():
                logger.info("检测到 Intel GPU，使用 OpenVINO 加速")
                return 'openvino'
            else:
                logger.warning("OpenVINO 或 Intel GPU 不可用，回退到 CPU")
                return 'cpu'
        elif device == 'cuda':
            if is_cuda_available():
                logger.info("CUDA 可用，使用 GPU")
                return 'cuda'
            else:
                logger.warning('CUDA 不可用，回退到 CPU')
                return 'cpu'
        else:
            return 'cpu'

    def _determine_compute_type(self, compute_type: str = None) -> str:
        if compute_type:
            return compute_type
        
        if self.device == 'cuda':
            return 'float16'
        elif self.device == 'openvino':
            return 'int8'
        else:
            return 'int8'

    @staticmethod
    def is_torch_installed() -> bool:
        try:
            import torch
            return True
        except ImportError:
            return False

    @staticmethod
    def is_cuda() -> bool:
        try:
            if is_cuda_available():
                logger.info("CUDA 可用，使用 GPU")
                return True
            elif is_torch_installed():
                logger.info("只装了 torch，但没有 CUDA，用 CPU")
                return False
            else:
                logger.warning("还没有安装 torch，请先安装")
                return False
        except ImportError:
            return False

    @timeit
    def transcript(self, file_path: str) -> TranscriptResult:
        try:

            segments_raw, info = self.model.transcribe(file_path)

            segments = []
            full_text = ""

            for seg in segments_raw:
                text = seg.text.strip()
                full_text += text + " "
                segments.append(TranscriptSegment(
                    start=seg.start,
                    end=seg.end,
                    text=text
                ))

            result= TranscriptResult(
                language=info.language,
                full_text=full_text.strip(),
                segments=segments,
                raw=info
            )
            return result
        except Exception as e:
            logger.error(f"转写失败：{e}")


    def on_finish(self,video_path:str,result: TranscriptResult)->None:
        logger.info("转写完成")
        transcription_finished.send({
            "file_path": video_path,
        })