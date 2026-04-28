from app.db.engine import get_db
from app.db.models.models import Model


def get_model_by_provider_and_name(provider_id: int, model_name: str):
    db = next(get_db())
    try:
        model = db.query(Model).filter_by(provider_id=provider_id, model_name=model_name).first()
        if model:
            return {
                "id": model.id,
                "provider_id": model.provider_id,
                "model_name": model.model_name,
                "created_at": model.created_at,
            }
        return None
    finally:
        db.close()


def insert_model(provider_id: int, model_name: str):
    db = next(get_db())
    try:
        model = Model(provider_id=provider_id, model_name=model_name)
        db.add(model)
        db.commit()
        db.refresh(model)
        return {
            "id": model.id,
            "provider_id": model.provider_id,
            "model_name": model.model_name,
            "created_at": model.created_at,
        }
    finally:
        db.close()


def get_models_by_provider(provider_id: int):
    db = next(get_db())
    try:
        models = db.query(Model).filter_by(provider_id=provider_id).all()
        return [{"id": m.id, "model_name": m.model_name} for m in models]
    finally:
        db.close()


def delete_model(model_id: int):
    db = next(get_db())
    try:
        model = db.query(Model).filter_by(id=model_id).first()
        if model:
            db.delete(model)
            db.commit()
    finally:
        db.close()


def get_all_models():
    db = next(get_db())
    try:
        models = db.query(Model).all()
        return [
            {"id": m.id, "provider_id": m.provider_id, "model_name": m.model_name}
            for m in models
        ]
    finally:
        db.close()


def get_models_by_provider_ids(provider_ids: list):
    """获取指定供应商 ID 列表下的所有模型"""
    if not provider_ids:
        return []
    db = next(get_db())
    try:
        models = db.query(Model).filter(Model.provider_id.in_(provider_ids)).all()
        return [
            {"id": m.id, "provider_id": m.provider_id, "model_name": m.model_name}
            for m in models
        ]
    finally:
        db.close()