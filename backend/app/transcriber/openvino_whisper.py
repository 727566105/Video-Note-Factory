import os
import numpy as np
from pathlib import Path

from app.decorators.timeit import timeit
from app.models.transcriber_model import TranscriptSegment, TranscriptResult
from app.transcriber.base import Transcriber
from app.utils.logger import get_logger
from app.utils.path_helper import get_model_dir

logger = get_logger(__name__)

class OpenVINOWhisperTranscriber(Transcriber):
    def __init__(self, model_size: str = "base"):
        self.model_size = model_size
        self.model_dir = get_model_dir("openvino-whisper")
        self.device = self._detect_device()
        
        self._load_model()

    def _detect_device(self) -> str:
        try:
            import openvino as ov
            core = ov.Core()
            devices = core.available_devices
            logger.info(f"OpenVINO 可用设备: {devices}")
            if 'GPU' in devices:
                logger.info("使用 Intel GPU 加速")
                return 'GPU'
            logger.info("Intel GPU 不可用，使用 CPU")
            return 'CPU'
        except Exception as e:
            logger.warning(f"设备检测失败: {e}")
            return 'CPU'

    def _load_model(self):
        try:
            from optimum.intel.openvino import OVModelForSpeechSeq2Seq
            from transformers import WhisperProcessor, AutoProcessor
            
            model_name = f"openai/whisper-{self.model_size}"
            model_path = os.path.join(self.model_dir, f"whisper-{self.model_size}")
            
            if Path(model_path).exists() and any(Path(model_path).iterdir()):
                logger.info(f"从本地加载 OpenVINO Whisper 模型: {model_path}")
                self.ov_model = OVModelForSpeechSeq2Seq.from_pretrained(
                    model_path,
                    compile=False
                )
                self.processor = WhisperProcessor.from_pretrained(model_path)
            else:
                logger.info(f"下载并转换 OpenVINO Whisper 模型: {model_name}")
                os.makedirs(model_path, exist_ok=True)
                
                self.ov_model = OVModelForSpeechSeq2Seq.from_pretrained(
                    model_name,
                    export=True,
                    compile=False
                )
                self.processor = WhisperProcessor.from_pretrained(model_name)
                
                self.ov_model.save_pretrained(model_path)
                self.processor.save_pretrained(model_path)
                logger.info(f"模型已保存到: {model_path}")
            
            logger.info(f"编译模型到设备: {self.device}")
            self.ov_model.to(self.device)
            self.ov_model.compile()
            
            logger.info(f"OpenVINO Whisper 模型加载完成，设备: {self.device}")
            
        except ImportError as e:
            logger.error(f"缺少依赖: {e}")
            raise ImportError("请安装 optimum-intel: pip install optimum[openvino] transformers")
        except Exception as e:
            logger.error(f"加载模型失败: {e}")
            raise

    @timeit
    def transcript(self, file_path: str) -> TranscriptResult:
        try:
            import librosa
            
            logger.info(f"开始 OpenVINO 转写: {file_path}, 设备: {self.device}")
            
            audio, sr = librosa.load(file_path, sr=16000)
            
            input_features = self.processor(
                audio,
                sampling_rate=16000,
                return_tensors="pt"
            ).input_features
            
            forced_decoder_ids = self.processor.get_decoder_prompt_ids(
                language="zh",
                task="transcribe"
            )
            
            predicted_ids = self.ov_model.generate(
                input_features,
                forced_decoder_ids=forced_decoder_ids,
                max_new_tokens=448
            )
            
            transcription = self.processor.batch_decode(
                predicted_ids,
                skip_special_tokens=True
            )[0]
            
            segments = self._create_segments(audio, transcription)
            
            logger.info(f"转写完成，文本长度: {len(transcription)}")
            
            return TranscriptResult(
                language="zh",
                full_text=transcription.strip(),
                segments=segments,
                raw={
                    "device": self.device,
                    "model_size": self.model_size
                }
            )
            
        except Exception as e:
            logger.error(f"OpenVINO 转写失败: {e}")
            raise

    def _create_segments(self, audio: np.ndarray, text: str) -> list:
        duration = len(audio) / 16000
        words = text.split()
        
        if not words:
            return []
        
        duration_per_word = duration / len(words)
        segments = []
        
        for i, word in enumerate(words):
            segments.append(TranscriptSegment(
                start=i * duration_per_word,
                end=min((i + 1) * duration_per_word, duration),
                text=word
            ))
        
        return segments