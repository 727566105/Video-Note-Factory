from sqlalchemy import Column, Integer, String, DateTime, Boolean, func

from app.db.engine import Base


class ModelUsageHistory(Base):
    """模型使用历史表，用于记录模型的成功/失败调用，支持智能优选排序"""
    __tablename__ = "model_usage_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(Integer, nullable=False)  # 关联 models.id
    provider_id = Column(String, nullable=False)  # 关联 providers.id
    user_id = Column(Integer, nullable=False)  # 用户 ID
    success = Column(Boolean, default=True)  # 是否成功
    error_type = Column(String, nullable=True)  # 错误类型：api_error/timeout/result_anomaly/rate_limit
    created_at = Column(DateTime, server_default=func.now())