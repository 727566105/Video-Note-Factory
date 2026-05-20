"""模型使用历史 DAO，用于智能优选的模型排序"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from app.db.engine import get_db
from app.db.models.model_usage_history import ModelUsageHistory
from app.db.models.models import Model
from app.db.models.providers import Provider
from app.utils.logger import get_logger

logger = get_logger(__name__)


def record_usage(
    user_id: int,
    model_id: int,
    provider_id: str,
    success: bool,
    error_type: Optional[str] = None,
):
    """记录模型使用历史"""
    db = next(get_db())
    try:
        record = ModelUsageHistory(
            user_id=user_id,
            model_id=model_id,
            provider_id=provider_id,
            success=success,
            error_type=error_type,
        )
        db.add(record)
        db.commit()
        logger.info(
            f"记录模型使用: model_id={model_id}, provider_id={provider_id}, success={success}"
        )
    except Exception as e:
        db.rollback()
        logger.error(f"记录模型使用历史失败: {e}")
    finally:
        db.close()


def get_sorted_models_for_user(user_id: int, limit: int = 10) -> List[Dict[str, Any]]:
    """
    获取按最近成功排序的模型列表（智能优选专用）

    排序策略：
    1. 最近成功时间 DESC（最近成功的排前面）
    2. 成功率 DESC（成功率高的排前面）
    3. 无历史记录的新模型排在最后（给新模型机会）

    :param user_id: 用户 ID
    :param limit: 返回模型数量上限
    :return: 排序后的模型列表，每个元素包含 model_id, provider_id, model_name, last_success_at, success_rate
    """
    db = next(get_db())
    try:
        # 1. 获取所有启用的供应商
        enabled_providers = db.query(Provider).filter_by(enabled=1).all()
        enabled_provider_ids = [p.id for p in enabled_providers]

        if not enabled_provider_ids:
            return []

        # 2. 获取这些供应商下的所有模型
        models = (
            db.query(Model)
            .filter(Model.provider_id.in_(enabled_provider_ids))
            .all()
        )

        if not models:
            return []

        result = []
        for m in models:
            # 查询该模型的使用历史
            history_records = (
                db.query(ModelUsageHistory)
                .filter(ModelUsageHistory.model_id == m.id)
                .filter(ModelUsageHistory.user_id == user_id)
                .order_by(ModelUsageHistory.created_at.desc())
                .all()
            )

            # 计算成功率
            total = len(history_records)
            success_count = sum(1 for r in history_records if r.success)
            success_rate = success_count / total if total > 0 else 0.5  # 无历史时默认0.5

            # 最近成功时间
            last_success = None
            for r in history_records:
                if r.success:
                    last_success = r.created_at
                    break

            # 获取供应商名称
            provider = next(
                (p for p in enabled_providers if p.id == m.provider_id), None
            )
            provider_name = provider.name if provider else "未知"

            result.append({
                "model_id": m.id,
                "provider_id": m.provider_id,
                "model_name": m.model_name,
                "provider_name": provider_name,
                "last_success_at": last_success.isoformat() if last_success else None,
                "success_rate": round(success_rate, 2),
                "total_usage": total,
            })

        # 排序：最近成功优先，然后成功率
        # 无历史记录的排在最后（last_success_at 为 None）
        sorted_result = sorted(
            result,
            key=lambda x: (
                x["last_success_at"] is not None,  # 有历史的排前面
                x["last_success_at"] or "",  # 最近成功时间
                x["success_rate"],  # 成功率
            ),
            reverse=True,
        )

        return sorted_result[:limit]

    finally:
        db.close()


def get_model_by_id(model_id: int) -> Optional[Dict[str, Any]]:
    """根据 ID 获取模型"""
    db = next(get_db())
    try:
        model = db.query(Model).filter_by(id=model_id).first()
        if model:
            return {
                "id": model.id,
                "provider_id": model.provider_id,
                "model_name": model.model_name,
            }
        return None
    finally:
        db.close()


def get_provider_by_id(provider_id: str) -> Optional[Dict[str, Any]]:
    """根据 ID 获取供应商（包含完整信息，含 api_key）"""
    db = next(get_db())
    try:
        provider = db.query(Provider).filter_by(id=provider_id).first()
        if provider:
            return {
                "id": provider.id,
                "name": provider.name,
                "api_key": provider.api_key,
                "base_url": provider.base_url,
                "type": provider.type,
                "logo": provider.logo,
                "logo_url": provider.logo_url,
                "enabled": provider.enabled,
            }
        return None
    finally:
        db.close()


def get_next_available_model(
    user_id: int, tried_model_ids: List[int]
) -> Optional[Dict[str, Any]]:
    """
    获取下一个可用模型（排除已尝试的）

    :param user_id: 用户 ID
    :param tried_model_ids: 已尝试过的模型 ID 列表
    :return: 下一个可用模型，或 None
    """
    sorted_models = get_sorted_models_for_user(user_id)
    for m in sorted_models:
        if m["model_id"] not in tried_model_ids:
            return m
    return None


def clear_old_history(days: int = 90):
    """清理超过指定天数的历史记录"""
    db = next(get_db())
    try:
        cutoff = datetime.now() - timedelta(days=days)
        deleted = (
            db.query(ModelUsageHistory)
            .filter(ModelUsageHistory.created_at < cutoff)
            .delete()
        )
        db.commit()
        logger.info(f"清理了 {deleted} 条过期模型使用历史")
    except Exception as e:
        db.rollback()
        logger.error(f"清理模型使用历史失败: {e}")
    finally:
        db.close()