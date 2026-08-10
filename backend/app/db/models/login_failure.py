from sqlalchemy import Column, String, Integer, DateTime

from app.db.engine import Base


class LoginFailure(Base):
    """登录失败记录（用于跨重启持久化暴力破解防护状态）。

    复合主键 (username, client_ip)，与 LoginRateLimiter._key() 一致。
    时间统一存 naive UTC（写入前 strip tzinfo），读取时按 UTC-aware 处理，
    避免 SQLite 丢时区导致比较错乱。
    """

    __tablename__ = "login_failures"

    username = Column(String, primary_key=True)
    client_ip = Column(String, primary_key=True)
    failure_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
