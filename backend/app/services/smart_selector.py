"""智能模型选择器，支持模型自动切换和重试"""

import concurrent.futures
from dataclasses import dataclass
from typing import List, Optional, Tuple

from app.db.model_usage_history_dao import (
    get_sorted_models_for_user,
    get_model_by_id,
    get_provider_by_id,
    record_usage,
)
from app.gpt.gpt_factory import GPTFactory
from app.gpt.base import GPT
from app.models.model_config import ModelConfig
from app.models.gpt_model import GPTSource
from app.utils.logger import get_logger

logger = get_logger(__name__)

MAX_RETRY_COUNT = 3  # 最大重试次数
GPT_TIMEOUT_SECONDS = 120  # GPT 调用超时时间


@dataclass
class SmartSelectionResult:
    """智能优选结果"""
    markdown: str
    model_id: int
    provider_id: str
    model_name: str
    provider_name: str
    switched: bool  # 是否发生过模型切换
    tried_count: int  # 尝试的模型数量


class SmartSelectionError(Exception):
    """智能优选失败异常"""
    def __init__(self, message: str, tried_models: List[Tuple[int, str]], last_error: Exception):
        self.message = message
        self.tried_models = tried_models
        self.last_error = last_error
        super().__init__(message)


class SmartModelSelector:
    """智能模型选择器"""

    def __init__(self, user_id: int):
        self.user_id = user_id

    def get_sorted_models(self) -> List[dict]:
        """获取按最近成功排序的模型列表"""
        return get_sorted_models_for_user(self.user_id)

    def select_first_model(self) -> Optional[Tuple[int, str]]:
        """选择第一个（最优）模型"""
        models = self.get_sorted_models()
        if not models:
            return None
        first = models[0]
        return (first["model_id"], first["provider_id"])

    def summarize_with_retry(
        self,
        source: GPTSource,
        task_id: str,
        on_model_switch: Optional[callable] = None,
    ) -> SmartSelectionResult:
        """
        智能重试 GPT 总结

        :param source: GPT 输入源
        :param task_id: 任务 ID
        :param on_model_switch: 模型切换时的回调函数
        :return: SmartSelectionResult
        :raises: SmartSelectionError 当所有模型尝试均失败时
        """
        tried_models: List[Tuple[int, str]] = []
        switched = False
        last_error = None

        sorted_models = self.get_sorted_models()
        if not sorted_models:
            raise SmartSelectionError(
                "没有可用的模型，请先配置模型供应商",
                tried_models,
                Exception("No available models")
            )

        for attempt in range(MAX_RETRY_COUNT):
            # 选择模型（排除已尝试的）
            model_info = self._select_model_for_attempt(sorted_models, tried_models)
            if model_info is None:
                logger.warning(f"所有可用模型均已尝试，尝试次数: {len(tried_models)}")
                break

            model_id = model_info["model_id"]
            provider_id = model_info["provider_id"]
            model_name = model_info["model_name"]
            provider_name = model_info["provider_name"]

            tried_models.append((model_id, provider_id))

            # 判断是否发生切换
            if len(tried_models) > 1:
                switched = True
                logger.info(
                    f"智能优选切换模型: 尝试 #{attempt + 1}, "
                    f"model_id={model_id}, model_name={model_name}, provider={provider_name}"
                )
                if on_model_switch:
                    on_model_switch(model_id, provider_id, model_name)

            try:
                logger.info(
                    f"智能优选尝试 GPT: model_id={model_id}, "
                    f"model_name={model_name}, provider={provider_name}"
                )

                # 创建 GPT 实例
                gpt = self._create_gpt_instance(model_id, provider_id)

                # 调用 GPT（带超时）
                markdown = self._call_gpt_with_timeout(gpt, source)

                # 检查结果异常
                if self._is_result_anomaly(markdown):
                    raise ValueError("GPT 返回结果异常（过短或包含错误标记）")

                # 成功，记录历史
                record_usage(
                    user_id=self.user_id,
                    model_id=model_id,
                    provider_id=provider_id,
                    success=True,
                )
                logger.info(f"智能优选成功: model_id={model_id}, model_name={model_name}")

                return SmartSelectionResult(
                    markdown=markdown,
                    model_id=model_id,
                    provider_id=provider_id,
                    model_name=model_name,
                    provider_name=provider_name,
                    switched=switched,
                    tried_count=len(tried_models),
                )

            except Exception as exc:
                last_error = exc
                error_type = self._classify_error(exc)

                logger.error(
                    f"智能优选失败 (model_id={model_id}, model_name={model_name}): {exc}"
                )

                # 记录失败
                record_usage(
                    user_id=self.user_id,
                    model_id=model_id,
                    provider_id=provider_id,
                    success=False,
                    error_type=error_type,
                )

                # 继续尝试下一个模型
                continue

        # 所有模型都失败
        model_names = [self._get_model_display_name(m) for m in tried_models]
        raise SmartSelectionError(
            f"智能优选失败：尝试了 {len(tried_models)} 个模型均失败（{', '.join(model_names)}），"
            f"请检查模型配置或手动选择特定模型重试",
            tried_models,
            last_error,
        )

    def _select_model_for_attempt(
        self,
        sorted_models: List[dict],
        tried_models: List[Tuple[int, str]],
    ) -> Optional[dict]:
        """为当前尝试选择模型（排除已尝试的）"""
        tried_ids = [m[0] for m in tried_models]
        for m in sorted_models:
            if m["model_id"] not in tried_ids:
                return m
        return None

    def _create_gpt_instance(self, model_id: int, provider_id: str) -> GPT:
        """创建 GPT 实例"""
        model = get_model_by_id(model_id)
        provider = get_provider_by_id(provider_id)

        if not model or not provider:
            raise ValueError(
                f"模型或供应商不存在: model_id={model_id}, provider_id={provider_id}"
            )

        config = ModelConfig(
            api_key=provider["api_key"],
            base_url=provider["base_url"],
            model_name=model["model_name"],
            provider=provider["type"],
            name=provider["name"],
        )

        return GPTFactory().from_config(config)

    def _call_gpt_with_timeout(self, gpt: GPT, source: GPTSource) -> str:
        """带超时的 GPT 调用"""
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(gpt.summarize, source)
            try:
                return future.result(timeout=GPT_TIMEOUT_SECONDS)
            except concurrent.futures.TimeoutError:
                raise TimeoutError(
                    f"GPT 调用超时 ({GPT_TIMEOUT_SECONDS}秒)"
                )

    def _is_result_anomaly(self, markdown: str) -> bool:
        """检查结果是否异常"""
        # 结果过短
        if len(markdown) < 100:
            return True
        # 开头包含错误标记
        lower_start = markdown[:100].lower()
        if "error" in lower_start or "failed" in lower_start:
            return True
        return False

    def _classify_error(self, error: Exception) -> str:
        """分类错误类型"""
        error_str = str(error).lower()
        if "timeout" in error_str:
            return "timeout"
        elif "connection" in error_str or "network" in error_str:
            return "api_error"
        elif "rate" in error_str or "limit" in error_str or "429" in error_str:
            return "rate_limit"
        elif "401" in error_str or "403" in error_str:
            return "auth_error"
        elif "结果异常" in error_str:
            return "result_anomaly"
        else:
            return "unknown"

    def _get_model_display_name(self, model_tuple: Tuple[int, str]) -> str:
        """获取模型显示名称"""
        model_id, provider_id = model_tuple
        model = get_model_by_id(model_id)
        provider = get_provider_by_id(provider_id)
        if model and provider:
            return f"{provider['name']}/{model['model_name']}"
        return f"model_{model_id}"