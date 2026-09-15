from openai import OpenAI

from app.gpt.base import GPT
from app.gpt.provider.OpenAI_compatible_provider import OpenAICompatibleProvider
from app.gpt.universal_gpt import UniversalGPT
from app.models.model_config import ModelConfig


class GPTFactory:
    # ⚠️ 所有供应商统一走 UniversalGPT（OpenAI 兼容协议），from_config 无 if 分支。
    # 新增供应商类型只需 providers 表支持该 type，不要在此添加分支（旧 DeepSeekGPT/OpenaiGPT/QwenGPT 已是死代码）。
    @staticmethod
    def from_config(config: ModelConfig) -> GPT:
        client = OpenAICompatibleProvider(api_key=config.api_key, base_url=config.base_url).get_client
        return UniversalGPT(
            client=client,
            model=config.model_name,
            provider_name=config.provider,  # 传递供应商名称用于判断是否支持视觉
        )