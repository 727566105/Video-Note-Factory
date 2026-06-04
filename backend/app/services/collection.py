"""
收藏集服务模块

提供收藏集的 CRUD 操作和总结生成功能。
"""
import json
import logging
import uuid
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models.collection import Collection, CollectionItem, CollectionSummary
from app.db.models.video_tasks import VideoTask
from app.gpt.gpt_factory import GPTFactory
from app.gpt.prompt_builder import get_style_format
from app.models.model_config import ModelConfig
from app.services.provider import ProviderService
from app.utils.path_helper import find_note_file

logger = logging.getLogger(__name__)


def _uuid() -> str:
    """生成 UUID 字符串"""
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# 收藏集 CRUD
# ---------------------------------------------------------------------------

def get_user_collections(db: Session, user_id: int):
    """获取用户所有收藏集，按 sort_order 排序，附带笔记数量和封面"""
    # 子查询：每个收藏集的笔记数量
    item_count_sq = (
        db.query(
            CollectionItem.collection_id,
            func.count(CollectionItem.id).label("item_count"),
        )
        .group_by(CollectionItem.collection_id)
        .subquery()
    )

    # 子查询：每个收藏集第一条笔记的 task_id（取 position 最小的）
    first_item_sq = (
        db.query(
            CollectionItem.collection_id,
            func.min(CollectionItem.position).label("min_pos"),
        )
        .group_by(CollectionItem.collection_id)
        .subquery()
    )

    first_task_sq = (
        db.query(
            CollectionItem.collection_id,
            CollectionItem.task_id,
        )
        .join(
            first_item_sq,
            (CollectionItem.collection_id == first_item_sq.c.collection_id)
            & (CollectionItem.position == first_item_sq.c.min_pos),
        )
        .subquery()
    )

    rows = (
        db.query(
            Collection,
            func.coalesce(item_count_sq.c.item_count, 0).label("item_count"),
            VideoTask.cover_url.label("first_cover_url"),
        )
        .outerjoin(item_count_sq, Collection.id == item_count_sq.c.collection_id)
        .outerjoin(first_task_sq, Collection.id == first_task_sq.c.collection_id)
        .outerjoin(VideoTask, first_task_sq.c.task_id == VideoTask.task_id)
        .filter(Collection.user_id == user_id)
        .order_by(Collection.sort_order.asc(), Collection.created_at.desc())
        .all()
    )

    result = []
    for collection, item_count, first_cover_url in rows:
        d = _serialize_collection(collection)
        d["item_count"] = item_count
        # 封面优先使用收藏集自身 cover_url，否则取第一条笔记的封面
        d["cover_url"] = collection.cover_url or first_cover_url
        result.append(d)
    return result


def create_collection(
    db: Session,
    user_id: int,
    name: str,
    description: str = None,
    category: str = None,
    task_ids: list[str] = None,
) -> dict:
    """创建收藏集，可选同时添加笔记"""
    collection = Collection(
        id=_uuid(),
        user_id=user_id,
        name=name,
        description=description,
        category=category,
    )
    db.add(collection)
    db.flush()

    if task_ids:
        for idx, task_id in enumerate(task_ids):
            # 跳过不存在的 task
            if not db.query(VideoTask).filter(VideoTask.task_id == task_id).first():
                continue
            # 跳过重复
            exists = (
                db.query(CollectionItem)
                .filter(
                    CollectionItem.collection_id == collection.id,
                    CollectionItem.task_id == task_id,
                )
                .first()
            )
            if exists:
                continue
            item = CollectionItem(
                id=_uuid(),
                collection_id=collection.id,
                task_id=task_id,
                position=idx,
            )
            db.add(item)

    db.commit()
    db.refresh(collection)
    return _serialize_collection(collection)


def update_collection(db: Session, collection_id: str, **kwargs) -> Optional[dict]:
    """更新收藏集字段（name, description, cover_url, category, sort_order）"""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        return None

    allowed_fields = {"name", "description", "cover_url", "category", "sort_order"}
    for key, value in kwargs.items():
        if key in allowed_fields:
            setattr(collection, key, value)

    db.commit()
    db.refresh(collection)
    return _serialize_collection(collection)


def delete_collection(db: Session, collection_id: str, user_id: int) -> bool:
    """删除收藏集及其所有条目"""
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == user_id)
        .first()
    )
    if not collection:
        return False

    # 先删除子表（CASCADE 应该自动处理，但显式删除更安全）
    db.query(CollectionItem).filter(CollectionItem.collection_id == collection_id).delete()
    db.query(CollectionSummary).filter(CollectionSummary.collection_id == collection_id).delete()
    db.delete(collection)
    db.commit()
    return True


# ---------------------------------------------------------------------------
# 收藏集条目操作
# ---------------------------------------------------------------------------

def add_items_to_collection(db: Session, collection_id: str, task_ids: list[str]) -> int:
    """
    向收藏集添加多条笔记，跳过重复。
    返回实际添加的数量。
    """
    # 获取当前最大 position
    max_pos = (
        db.query(func.coalesce(func.max(CollectionItem.position), -1))
        .filter(CollectionItem.collection_id == collection_id)
        .scalar()
    )

    added = 0
    for task_id in task_ids:
        # 跳过不存在的 task
        if not db.query(VideoTask).filter(VideoTask.task_id == task_id).first():
            logger.warning(f"add_items: task_id={task_id} 不存在，跳过")
            continue

        # 跳过重复
        exists = (
            db.query(CollectionItem)
            .filter(
                CollectionItem.collection_id == collection_id,
                CollectionItem.task_id == task_id,
            )
            .first()
        )
        if exists:
            continue

        max_pos += 1
        item = CollectionItem(
            id=_uuid(),
            collection_id=collection_id,
            task_id=task_id,
            position=max_pos,
        )
        db.add(item)
        added += 1

    db.commit()
    return added


def remove_item_from_collection(db: Session, collection_id: str, task_id: str) -> bool:
    """从收藏集中移除一条笔记"""
    item = (
        db.query(CollectionItem)
        .filter(
            CollectionItem.collection_id == collection_id,
            CollectionItem.task_id == task_id,
        )
        .first()
    )
    if not item:
        return False

    db.delete(item)
    db.commit()
    return True


def update_items_order(db: Session, collection_id: str, ordered_task_ids: list[str]) -> bool:
    """更新收藏集中条目的排列顺序"""
    for idx, task_id in enumerate(ordered_task_ids):
        item = (
            db.query(CollectionItem)
            .filter(
                CollectionItem.collection_id == collection_id,
                CollectionItem.task_id == task_id,
            )
            .first()
        )
        if item:
            item.position = idx

    db.commit()
    return True


# ---------------------------------------------------------------------------
# 收藏集详情
# ---------------------------------------------------------------------------

def get_collection_detail(db: Session, collection_id: str, user_id: int) -> Optional[dict]:
    """获取收藏集详情，包含所有笔记条目"""
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == user_id)
        .first()
    )
    if not collection:
        return None

    items = (
        db.query(CollectionItem, VideoTask)
        .outerjoin(VideoTask, CollectionItem.task_id == VideoTask.task_id)
        .filter(CollectionItem.collection_id == collection_id)
        .order_by(CollectionItem.position.asc())
        .all()
    )

    item_list = []
    for ci, task in items:
        item_dict = {
            "id": ci.id,
            "task_id": ci.task_id,
            "position": ci.position,
            "added_at": ci.added_at.isoformat() if ci.added_at else None,
        }
        if task:
            item_dict["title"] = task.title
            item_dict["cover_url"] = task.cover_url
            item_dict["platform"] = task.platform
            item_dict["author"] = task.author or task.author_name or ""
            item_dict["author_id"] = task.author_id
            item_dict["video_id"] = task.video_id
            item_dict["duration"] = task.duration
        item_list.append(item_dict)

    result = _serialize_collection(collection)
    result["items"] = item_list

    # 获取最新总结
    summary = (
        db.query(CollectionSummary)
        .filter(CollectionSummary.collection_id == collection_id)
        .first()
    )
    if summary:
        result["summary"] = _serialize_summary(summary)

    return result


# ---------------------------------------------------------------------------
# 收藏集总结
# ---------------------------------------------------------------------------

def get_collection_summary(db: Session, collection_id: str) -> Optional[dict]:
    """获取收藏集的总结"""
    summary = (
        db.query(CollectionSummary)
        .filter(CollectionSummary.collection_id == collection_id)
        .first()
    )
    if not summary:
        return None
    return _serialize_summary(summary)


def generate_collection_summary(
    db: Session,
    collection_id: str,
    user_id: int,
    style: str = "minimal",
    model_name: str = None,
    provider_id: str = None,
    extras: str = None,
) -> Optional[dict]:
    """
    生成收藏集总结

    流程：
    1. 获取收藏集下所有笔记的 task_id
    2. 读取每条笔记的 markdown 内容
    3. 拼接所有 markdown 并构建 prompt
    4. 调用 GPT 生成总结
    5. 保存到 collection_summaries 表
    """
    # 1. 获取收藏集及条目
    collection = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == user_id)
        .first()
    )
    if not collection:
        logger.error(f"收藏集不存在: collection_id={collection_id}")
        return None

    items = (
        db.query(CollectionItem)
        .filter(CollectionItem.collection_id == collection_id)
        .order_by(CollectionItem.position.asc())
        .all()
    )
    if not items:
        logger.error(f"收藏集为空: collection_id={collection_id}")
        return None

    # 2. 读取每条笔记的 markdown
    markdowns = []
    for item in items:
        task = db.query(VideoTask).filter(VideoTask.task_id == item.task_id).first()
        if not task:
            continue

        note_path = find_note_file(
            task_id=task.task_id,
            author_id=task.author_id,
            author_name=task.author_name,
            video_id=task.video_id,
            title=task.title,
            file_type="note",
            platform=task.platform,
        )
        if not note_path or not note_path.exists():
            logger.warning(f"笔记文件不存在: task_id={task.task_id}")
            continue

        try:
            note_data = json.loads(note_path.read_text(encoding="utf-8"))
            md_content = note_data.get("markdown", "")
            if md_content:
                title = task.title or "无标题"
                markdowns.append(f"## {title}\n\n{md_content}")
        except Exception as e:
            logger.warning(f"读取笔记失败: task_id={task.task_id}, error={e}")

    if not markdowns:
        logger.error(f"收藏集没有可用的笔记内容: collection_id={collection_id}")
        return None

    # 3. 拼接 markdown 并构建 prompt
    combined_text = "\n\n---\n\n".join(markdowns)
    prompt = _build_collection_summary_prompt(combined_text, style, extras)

    # 4. 调用 GPT
    try:
        gpt = _get_gpt(model_name, provider_id)
        from app.models.gpt_model import GPTSource

        source = GPTSource(
            segment=[],
            title=collection.name,
            tags="",
            style=style,
            extras=prompt,
        )
        result_md = gpt.summarize(source)
    except Exception as e:
        logger.error(f"GPT 生成总结失败: {e}", exc_info=True)
        return None

    if not result_md:
        logger.error("GPT 返回空结果")
        return None

    # 5. 保存到 collection_summaries 表
    existing = (
        db.query(CollectionSummary)
        .filter(CollectionSummary.collection_id == collection_id)
        .first()
    )

    if existing:
        existing.content = result_md
        existing.style = style
        existing.model_name = model_name
        existing.provider_id = provider_id
        existing.extras = extras
    else:
        existing = CollectionSummary(
            id=_uuid(),
            collection_id=collection_id,
            content=result_md,
            style=style,
            model_name=model_name,
            provider_id=provider_id,
            extras=extras,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return _serialize_summary(existing)


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _get_gpt(model_name: str, provider_id: str):
    """根据 provider_id 和 model_name 获取 GPT 实例"""
    provider = ProviderService.get_provider_by_id(provider_id)
    if not provider:
        raise ValueError(f"未找到模型供应商: provider_id={provider_id}")

    config = ModelConfig(
        api_key=provider["api_key"],
        base_url=provider["base_url"],
        model_name=model_name,
        provider=provider["name"],
        name=provider["name"],
    )
    return GPTFactory().from_config(config)


def _build_collection_summary_prompt(combined_text: str, style: str, extras: str = None) -> str:
    """构建收藏集总结的 prompt"""
    prompt = f"""你是一个专业的内容分析师。请根据以下多篇笔记内容，生成一份综合总结。

要求：
1. 提炼所有笔记的核心主题和关键观点
2. 发现笔记之间的关联和共同主题
3. 生成一份结构清晰的综合总结
4. 使用 Markdown 格式输出

"""
    style_desc = get_style_format(style)
    if style_desc:
        prompt += f"\n风格要求：{style_desc}\n"

    if extras:
        prompt += f"\n额外要求：{extras}\n"

    prompt += f"""
--- 以下是 {len(combined_text.split('---'))} 篇笔记内容 ---

{combined_text}

--- 笔记内容结束 ---

请生成综合总结："""

    return prompt


def _serialize_collection(c: Collection) -> dict:
    """序列化收藏集对象"""
    return {
        "id": c.id,
        "user_id": c.user_id,
        "name": c.name,
        "description": c.description,
        "cover_url": c.cover_url,
        "category": c.category,
        "sort_order": c.sort_order,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }


def _serialize_summary(s: CollectionSummary) -> dict:
    """序列化收藏集总结对象"""
    return {
        "id": s.id,
        "collection_id": s.collection_id,
        "content": s.content,
        "style": s.style,
        "model_name": s.model_name,
        "provider_id": s.provider_id,
        "extras": s.extras,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }
