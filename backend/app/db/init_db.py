from app.db.models.models import Model
from app.db.models.providers import Provider
from app.db.models.video_tasks import VideoTask
from app.db.models.siyuan_config import SiyuanConfig
from app.db.models.siyuan_export_history import SiyuanExportHistory
from app.db.models.webdav_config import WebDAVConfig
from app.db.models.backup_history import BackupHistory
from app.db.engine import get_engine, Base

def init_db():
    engine = get_engine()

    Base.metadata.create_all(bind=engine)