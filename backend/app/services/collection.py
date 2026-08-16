"""
收藏集服务模块

提供收藏集的 CRUD 操作和总结生成功能。
"""
import json
import logging
import re
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models.collection import Collection, CollectionItem, CollectionSummary, SmartCollection, CollectionFavorite
from app.db.models.video_tasks import VideoTask
from app.gpt.gpt_factory import GPTFactory
from app.gpt.prompt_builder import get_style_format
from app.models.model_config import ModelConfig
from app.services.provider import ProviderService
from app.utils.path_helper import find_note_file

logger = logging.getLogger(__name__)


_PLATFORM_LABELS = {
    "douyin": "抖音",
    "bilibili": "B站",
    "youtube": "YouTube",
    "xiaohongshu": "小红书",
    "kuaishou": "快手",
    "cctv": "CCTV",
}
_TIME_BUCKETS = (
    (0, 6, "凌晨(0-6)"),
    (6, 12, "上午(6-12)"),
    (12, 18, "下午(12-18)"),
    (18, 24, "晚上(18-24)"),
)


def _build_author_stats(note_entries: list[dict]) -> dict:
    """Build trajectory statistics from note metadata without database access."""
    dated = [entry["created_at"] for entry in note_entries if entry.get("created_at")]
    dates = [value.date() for value in dated]
    day_counts = {}
    for day in dates:
        day_counts[day] = day_counts.get(day, 0) + 1
    peak = max(day_counts.items(), key=lambda item: (item[1], item[0]), default=None)
    durations = [entry["duration"] for entry in note_entries
                 if isinstance(entry.get("duration"), (int, float))]
    span_days = (max(dates) - min(dates)).days if dates else 0
    frequency = len(note_entries) / max(span_days / 7, 1 / 7) if note_entries else 0.0
    time_buckets = {label: 0 for _, _, label in _TIME_BUCKETS}
    for value in dated:
        for start, end, label in _TIME_BUCKETS:
            if start <= value.hour < end:
                time_buckets[label] += 1
                break

    def counts(key, mapper=lambda value: value):
        result = {}
        for entry in note_entries:
            value = mapper(entry.get(key) or "")
            result[value] = result.get(value, 0) + 1
        return result

    return {
        "total": len(note_entries),
        "span_days": span_days,
        "span_text": f"{span_days}天" if dates else "未知",
        "frequency_per_week": round(frequency, 1),
        "peak_day": {"date": peak[0].isoformat(), "count": peak[1]} if peak else None,
        "active_days": len(day_counts),
        "time_buckets": time_buckets,
        "platforms": counts("platform", lambda value: _PLATFORM_LABELS.get(value, value)),
        "formats": counts("format"),
        "avg_duration_sec": round(sum(durations) / len(durations)) if durations else None,
    }


def _uuid() -> str:
    """生成 UUID 字符串"""
    return str(uuid.uuid4())


def _extract_note_summary(md_content: str, max_len: int = 200) -> str:
    """从笔记 markdown 中提取摘要（优先取 AI Summary，否则清理正文前段）"""
    # 优先提取 AI Summary 部分（笔记生成时自动产出的精华总结）
    ai_match = re.search(
        r'#{2,3}\s*(?:AI\s*Summary|AI\s*总结|AI总结)\s*\n+(.*?)(?=\n\s*#{1,3}\s|\n<!--|\Z)',
        md_content,
        re.S | re.I,
    )
    if ai_match:
        text = re.sub(r'[#>*`|]', '', ai_match.group(1))
        text = re.sub(r'\s+', ' ', text).strip()
        if len(text) > max_len:
            return text[:max_len] + '...'
        return text

    # 回退：清理正文前段（跳过标题/目录/图片/代码块/列表）
    text = re.sub(r'!\[.*?\]\(.*?\)', '', md_content, flags=re.S)
    text = re.sub(r'```.*?```', '', text, flags=re.S)
    text = re.sub(r'\[.*?\]\(.*?\)', '', text)
    text = re.sub(r'[#>*`|]', '', text)
    text = re.sub(r'[-–—]\s+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) > max_len:
        return text[:max_len] + '...'
    return text


def _read_note_summary(db: Session, task, user_id: int, max_len: int = 200) -> Optional[str]:
    """读取单条笔记的 markdown 并提取摘要"""
    try:
        note_path = find_note_file(
            task_id=task.task_id,
            author_id=task.author_id,
            author_name=task.author_name,
            video_id=task.video_id,
            title=task.title,
            file_type="note",
            platform=task.platform,
            user_id=user_id,
        )
        if not note_path or not note_path.exists():
            return None
        note_data = json.loads(note_path.read_text(encoding="utf-8"))
        md_content = note_data.get("markdown", "")
        if not md_content:
            return None
        summary = _extract_note_summary(md_content, max_len)
        return summary if summary else None
    except Exception as e:
        logger.warning(f"读取笔记摘要失败: task_id={getattr(task, 'task_id', '?')}, error={e}")
        return None


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
            item_dict["created_at"] = task.created_at.isoformat() if task.created_at else None
            note_summary = _read_note_summary(db, task, user_id)
            if note_summary:
                item_dict["note_summary"] = note_summary
        item_list.append(item_dict)

    result = _serialize_collection(collection)

    # 获取最新总结
    summary = (
        db.query(CollectionSummary)
        .filter(CollectionSummary.collection_id == collection_id)
        .first()
    )
    if summary:
        result["summary"] = _serialize_summary(summary)
        # 检测总结是否过期（当前条目数 != 生成时条目数）
        gen_count = getattr(summary, 'item_count_at_generation', None)
        result["summary_stale"] = gen_count is not None and gen_count != len(item_list)

    # items 始终按 position 返回（用户手动排序），时间轴组件内部自行按时间排序
    result["items"] = item_list

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
    mode: str = "overview",
) -> Optional[dict]:
    """
    生成收藏集总结

    流程：
    1. 获取收藏集下所有笔记的 task_id
    2. 读取每条笔记的 markdown 内容（单篇限长 + 标注元信息）
    3. 按 mode 决定排序方式（trajectory 按时间，其余按 position）
    4. 内容过长时分批生成摘要再汇总
    5. 调用 GPT 生成总结
    6. 保存到 collection_summaries 表（含 item_count_at_generation）
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

    # 2. 读取每条笔记的 markdown（带元信息 + 单篇限长）
    # trajectory 模式需要按 created_at 排序，先收集再排
    note_entries = []
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
            user_id=user_id,
        )
        if not note_path or not note_path.exists():
            logger.warning(f"笔记文件不存在: task_id={task.task_id}")
            continue

        try:
            note_data = json.loads(note_path.read_text(encoding="utf-8"))
            md_content = note_data.get("markdown", "")
            if not md_content:
                continue
            # 单篇限长 2000 字，避免拼接后超 token
            if len(md_content) > 2000:
                md_content = md_content[:2000] + "\n\n...(内容已截断)"
            entry = {
                "md": md_content,
                "title": task.title or "无标题",
                "platform": task.platform or "",
                "author": task.author or task.author_name or "",
                "created_at": task.created_at,
            }
            if mode == "trajectory":
                try:
                    tags = json.loads(task.tags or "{}") if isinstance(task.tags, str) else (task.tags or {})
                except (TypeError, json.JSONDecodeError):
                    tags = {}
                entry.update({
                    "duration": task.duration,
                    "description": task.description or "",
                    "tags": tags,
                    "format": "视频" if task.duration is not None else "图文/实况",
                })
            note_entries.append(entry)
        except Exception as e:
            logger.warning(f"读取笔记失败: task_id={task.task_id}, error={e}")

    if not note_entries:
        logger.error(f"收藏集没有可用的笔记内容: collection_id={collection_id}")
        return None

    # 3. trajectory 模式按笔记创建时间排序，其余按 position
    if mode == "trajectory":
        note_entries.sort(key=lambda x: x["created_at"] or datetime.min)

    # 4. 拼接 markdown（带元信息标注）
    total = len(note_entries)
    markdowns = []
    for i, entry in enumerate(note_entries, 1):
        if mode == "trajectory":
            date_str = entry["created_at"].strftime("%Y-%m-%d %H:%M") if entry["created_at"] else "未知日期"
            tags = entry.get("tags") or {}
            if isinstance(tags, dict):
                platform_tags = tags.get("platform_tags") or []
                ai_tags = tags.get("ai_tags") or []
            else:
                platform_tags = ai_tags = []
            tag_text = "、".join(str(tag) for tag in (list(platform_tags)[:5] + list(ai_tags)[:5]))
            description = entry.get("description") or ""
            description_text = f" | 描述：{description}" if description else ""
            metadata = f" | 标签：{tag_text}" if tag_text else ""
            header = f"### 笔记 {i}/{total} | [{date_str} | {entry.get('platform', '')} | {entry.get('format', '')}]{metadata} | {entry['author']}：{entry['title']}{description_text}"
        else:
            header = f"### 笔记 {i}/{total}：{entry['title']}"
        markdowns.append(f"{header}\n\n{entry['md']}")

    combined_text = "\n\n---\n\n".join(markdowns)

    # 5. 内容过长时分批生成摘要再汇总
    MAX_CHARS = 12000
    if len(combined_text) > MAX_CHARS:
        logger.info(f"合集内容过长({len(combined_text)}字)，启动分批总结模式")
        combined_text = _batch_summarize(combined_text, total, style, extras, mode, model_name, provider_id)
        if not combined_text:
            logger.error("分批总结失败")
            return None

    # 6. trajectory 使用生成时完整条目快照构建画像统计。
    stats = _build_author_stats(note_entries) if mode == "trajectory" else None
    author_name = None
    if mode == "trajectory":
        author_counts = {}
        for entry in note_entries:
            name = (entry.get("author") or "").strip()
            if name:
                author_counts[name] = author_counts.get(name, 0) + 1
        author_name = max(author_counts, key=author_counts.get) if author_counts else collection.name

    # 7. 构建 prompt 并调用 GPT
    prompt = _build_collection_summary_prompt(
        combined_text, total, style, extras, mode=mode, stats=stats, author_name=author_name,
    )

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

    # 去除 AI 可能返回的多余代码块包裹
    from app.services.note import strip_code_fence
    result_md = strip_code_fence(result_md)

    # 7. 保存到 collection_summaries 表
    existing = (
        db.query(CollectionSummary)
        .filter(CollectionSummary.collection_id == collection_id)
        .first()
    )

    if existing:
        existing.content = result_md
        existing.style = style
        existing.summary_mode = mode
        existing.model_name = model_name
        existing.provider_id = provider_id
        existing.extras = extras
        existing.item_count_at_generation = total
    else:
        existing = CollectionSummary(
            id=_uuid(),
            collection_id=collection_id,
            content=result_md,
            style=style,
            summary_mode=mode,
            model_name=model_name,
            provider_id=provider_id,
            extras=extras,
            item_count_at_generation=total,
        )
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return _serialize_summary(existing)


def get_task_collection_map(db: Session, user_id: int) -> dict:
    """获取 task_id → [{id, name}] 的映射，一次查询返回所有笔记所属的合集"""
    rows = (
        db.query(CollectionItem.task_id, Collection.id, Collection.name)
        .join(Collection, CollectionItem.collection_id == Collection.id)
        .filter(Collection.user_id == user_id)
        .all()
    )
    mapping: dict[str, list[dict]] = {}
    for task_id, coll_id, coll_name in rows:
        mapping.setdefault(task_id, []).append({"id": coll_id, "name": coll_name})
    return mapping


# ---------------------------------------------------------------------------
# 内部辅助函数
# ---------------------------------------------------------------------------

def _get_gpt(model_name: str = None, provider_id: str = None):
    """根据 provider_id 和 model_name 获取 GPT 实例，未指定时自动选择第一个可用供应商"""
    if not provider_id:
        from app.db.provider_dao import get_enabled_providers
        providers = get_enabled_providers()
        if not providers:
            raise ValueError("没有可用的模型供应商，请先在设置中配置")
        provider_id = providers[0].id
        logger.info(f"未指定供应商，自动选择: {providers[0].name} ({provider_id})")

    provider = ProviderService.get_provider_by_id(provider_id)
    if not provider:
        raise ValueError(f"未找到模型供应商: provider_id={provider_id}")

    if not model_name:
        from app.db.model_dao import get_models_by_provider
        # provider.id 是字符串，但 Model.provider_id 可能是 int，两种都试
        models = get_models_by_provider(provider_id)
        if not models:
            try:
                models = get_models_by_provider(int(provider_id))
            except (ValueError, TypeError):
                pass
        if models:
            model_name = models[0]["model_name"]
            logger.info(f"未指定模型，自动选择: {model_name}")
        else:
            model_name = provider.get("default_model") or "gpt-3.5-turbo"
            logger.info(f"未找到模型记录，使用默认: {model_name}")

    config = ModelConfig(
        api_key=provider["api_key"],
        base_url=provider["base_url"],
        model_name=model_name,
        provider=provider["name"],
        name=provider["name"],
    )
    return GPTFactory().from_config(config)


def _batch_summarize(
    combined_text: str, total: int, style: str, extras: str,
    mode: str, model_name: str, provider_id: str,
) -> Optional[str]:
    """内容过长时分批生成摘要，再拼接为浓缩版供最终总结使用"""
    parts = combined_text.split("\n\n---\n\n")
    batch_size = 3
    summaries = []

    for i in range(0, len(parts), batch_size):
        batch = "\n\n---\n\n".join(parts[i:i + batch_size])
        batch_prompt = f"""请将以下 {min(batch_size, len(parts) - i)} 篇笔记分别压缩为简洁摘要。
每篇只保留核心观点（每篇不超过 100 字），不要复述细节。
必须让每篇摘要开头保留原笔记的元数据标记 `[YYYY-MM-DD HH | 平台 | 形式]`，不要改写、删除或猜测该标记。

--- 笔记内容 ---

{batch}

--- 笔记内容结束 ---

直接输出各篇摘要，用 `### 摘要 N` 标注序号。"""
        try:
            gpt = _get_gpt(model_name, provider_id)
            from app.models.gpt_model import GPTSource
            source = GPTSource(segment=[], title="batch", tags="", style=style, extras=batch_prompt)
            result = gpt.summarize(source)
            if result:
                from app.services.note import strip_code_fence
                summaries.append(strip_code_fence(result))
        except Exception as e:
            logger.warning(f"分批总结第 {i // batch_size + 1} 批失败: {e}")

    if not summaries:
        return None
    return "\n\n---\n\n".join(summaries)


def _build_collection_summary_prompt(
    combined_text: str, note_count: int, style: str, extras: str = None,
    mode: str = "overview", stats: dict = None, author_name: str = None,
) -> str:
    """构建收藏集总结的 prompt（支持多模式，强化重点提炼）"""
    mode_prompts = {
        "overview": f"""你是一个专业的内容分析师。请根据以下 {note_count} 篇笔记内容，生成一份高质量的综合总结。

**核心要求：提炼重点，不要逐篇复述内容。**

1. 横跨所有笔记提炼 3-5 个核心主题，每个主题用 1-2 句话概括关键观点
2. 发现笔记之间的关联、共同点和分歧
3. 忽略细节和案例，只保留信息密度最高的观点
4. 总结不超过 800 字，使用 Markdown 格式输出""",
        "comparison": f"""你是一个专业的对比分析师。请根据以下 {note_count} 篇笔记内容，生成一份对比分析报告。

**核心要求：只对比关键差异，不展开细节。**

1. 找出各篇笔记讨论的对象/方法/观点
2. 用 Markdown 表格对比它们的关键差异（优缺点、适用场景、核心区别）
3. 表格后附一段综合分析（不超过 300 字）
4. 使用 Markdown 格式输出""",
        "timeline": f"""你是一个专业的时间线分析师。请根据以下 {note_count} 篇笔记内容，按时间顺序生成一份时间线总结。

**核心要求：只列关键时间节点，不展开背景。**

1. 按内容涉及的时间节点排列关键信息
2. 每个节点标注：时间 -> 关键事件/观点 -> 来源笔记标题
3. 最后附一段趋势分析（不超过 200 字）
4. 使用 Markdown 格式输出""",
        "mindmap": f"""你是一个专业的知识架构师。请根据以下 {note_count} 篇笔记内容，生成一份思维导图（Markdown 树状结构）。

**核心要求：每个节点只放关键词，不超过 10 字。**

1. 以合集主题为根节点
2. 一级分支为核心主题（3-6 个）
3. 二级分支为该主题下的关键点
4. 用 Markdown 列表格式（- / -- / ---）表示层级
5. 总节点数不超过 30 个""",
        "trajectory": f"""你是专业的博主内容画像分析师。请根据以下 {note_count} 篇按创建时间排序的笔记，为博主「{author_name or '未知'}」生成一份证据驱动的画像分析。

# 博主「{author_name or '未知'}」画像分析

先用一段简短摘要概括博主的内容方向与创作轨迹。随后必须严格包含以下五个维度，并为每个维度给出一个明确结论，以及 2-4 条以「依据」开头的要点。依据必须引用输入中的具体标题、日期、标签、平台、形式或系统统计值，不得只写抽象判断：

## 风格特征
## 内容偏好
## 发布规律
## 人设定位
## 个人特质

最后附上「## 创作轨迹要点」，用简短时间线说明内容变化，并只基于输入证据。注意：`created_at` 是笔记记录时间戳，不一定是实际发布时间；证据不可用时必须明确报告「暂无证据」，不得推断或编造。系统统计仅供参考，禁止自行数数、重新统计或发明统计值。对于输入未提供的粉丝、点赞等数据不要分析。

**系统统计（由程序计算，禁止自行数数）**
{json.dumps(stats or {}, ensure_ascii=False, indent=2)}

使用 Markdown 格式输出，不超过 1200 字。""",
    }
    prompt = mode_prompts.get(mode, mode_prompts["overview"])
    style_desc = get_style_format(style)
    if style_desc:
        prompt += f"\n风格要求：{style_desc}\n"

    if extras:
        prompt += f"\n额外要求：{extras}\n"

    prompt += f"""
--- 以下是 {note_count} 篇笔记内容（或其摘要） ---

{combined_text}

--- 笔记内容结束 ---

请生成总结。

**重要**：直接以 Markdown 标题（`#` 或 `##`）开头输出内容，**绝对不要**将输出包裹在 ```` ```markdown ```` 或 ```` ``` ```` 代码块中。"""

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
        "share_token": c.share_token,
        "is_shared": getattr(c, 'is_shared', 0),
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
        "summary_mode": getattr(s, 'summary_mode', 'overview'),
        "model_name": s.model_name,
        "provider_id": s.provider_id,
        "extras": s.extras,
        "item_count_at_generation": getattr(s, 'item_count_at_generation', None),
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


# ── 分享 ──

def share_collection(db: Session, collection_id: str, user_id: int) -> Optional[dict]:
    """设置合集为公开，生成 share_token"""
    c = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user_id).first()
    if not c:
        return None
    if not c.share_token:
        c.share_token = str(uuid.uuid4())
    c.is_shared = 1
    db.commit()
    return {"share_token": c.share_token, "is_shared": 1}


def unshare_collection(db: Session, collection_id: str, user_id: int) -> bool:
    """取消合集公开"""
    c = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user_id).first()
    if not c:
        return False
    c.is_shared = 0
    db.commit()
    return True


def get_shared_collection(db: Session, share_token: str) -> Optional[dict]:
    """通过 share_token 获取公开合集内容（只读）"""
    c = db.query(Collection).filter(
        Collection.share_token == share_token, Collection.is_shared == 1
    ).first()
    if not c:
        return None
    result = _serialize_collection(c)
    items = db.query(CollectionItem).filter(CollectionItem.collection_id == c.id).all()
    task_ids = [item.task_id for item in items]
    result["item_count"] = len(task_ids)
    summary = db.query(CollectionSummary).filter(CollectionSummary.collection_id == c.id).first()
    result["summary"] = _serialize_summary(summary) if summary else None
    return result


def edit_summary(db: Session, collection_id: str, user_id: int, content: str) -> Optional[dict]:
    """编辑合集总结内容"""
    c = db.query(Collection).filter(Collection.id == collection_id, Collection.user_id == user_id).first()
    if not c:
        return None
    summary = db.query(CollectionSummary).filter(CollectionSummary.collection_id == collection_id).first()
    if summary:
        summary.content = content
    else:
        summary = CollectionSummary(id=_uuid(), collection_id=collection_id, content=content)
        db.add(summary)
    db.commit()
    db.refresh(summary)
    return _serialize_summary(summary)


# ── 广场 ──

def get_plaza_collections(db: Session, page: int = 1, limit: int = 20) -> dict:
    """获取公开合集广场"""
    offset = (page - 1) * limit
    query = db.query(Collection).filter(Collection.is_shared == 1)
    total = query.count()
    collections = query.order_by(Collection.updated_at.desc()).offset(offset).limit(limit).all()
    items = []
    for c in collections:
        item = _serialize_collection(c)
        item["item_count"] = db.query(CollectionItem).filter(CollectionItem.collection_id == c.id).count()
        fav_count = db.query(CollectionFavorite).filter(CollectionFavorite.collection_id == c.id).count()
        item["favorite_count"] = fav_count
        from app.db.models.users import User
        author = db.query(User).filter(User.id == c.user_id).first()
        item["author_name"] = author.username if author else "未知"
        items.append(item)
    return {"items": items, "total": total}


def toggle_favorite(db: Session, collection_id: str, user_id: int) -> dict:
    """收藏/取消收藏合集"""
    existing = db.query(CollectionFavorite).filter(
        CollectionFavorite.collection_id == collection_id,
        CollectionFavorite.user_id == user_id,
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"favorited": False}
    fav = CollectionFavorite(id=_uuid(), collection_id=collection_id, user_id=user_id)
    db.add(fav)
    db.commit()
    return {"favorited": True}


def get_user_favorites(db: Session, user_id: int) -> list[dict]:
    """获取用户收藏的合集列表"""
    favs = db.query(CollectionFavorite).filter(CollectionFavorite.user_id == user_id).all()
    result = []
    for fav in favs:
        c = db.query(Collection).filter(Collection.id == fav.collection_id).first()
        if not c:
            continue
        item = _serialize_collection(c)
        item["item_count"] = db.query(CollectionItem).filter(CollectionItem.collection_id == c.id).count()
        result.append(item)
    return result


def clone_collection(db: Session, collection_id: str, user_id: int, new_name: str = None) -> Optional[dict]:
    """克隆公开合集到自己的合集"""
    source = db.query(Collection).filter(Collection.id == collection_id).first()
    if not source:
        return None
    new = Collection(
        id=_uuid(),
        user_id=user_id,
        name=new_name or f"{source.name}（副本）",
        description=source.description,
        cover_url=source.cover_url,
        category=source.category,
    )
    db.add(new)
    # 复制条目
    items = db.query(CollectionItem).filter(CollectionItem.collection_id == collection_id).all()
    for item in items:
        new_item = CollectionItem(
            id=_uuid(), collection_id=new.id, task_id=item.task_id, position=item.position
        )
        db.add(new_item)
    db.commit()
    db.refresh(new)
    return _serialize_collection(new)


# ── 智能合集 ──

def create_smart_collection(
    db: Session, user_id: int, name: str, rule_type: str, rule_value: str,
    description: str = None,
) -> dict:
    """创建智能合集"""
    sc = SmartCollection(
        id=_uuid(),
        user_id=user_id,
        name=name,
        description=description,
        rule_type=rule_type,
        rule_value=rule_value,
    )
    db.add(sc)
    db.commit()
    db.refresh(sc)
    # 立即同步一次
    match_count = sync_smart_collection(db, sc.id, user_id)
    return {
        "id": sc.id,
        "name": sc.name,
        "rule_type": sc.rule_type,
        "rule_value": sc.rule_value,
        "match_count": match_count,
    }


def get_user_smart_collections(db: Session, user_id: int) -> list[dict]:
    """获取用户的智能合集列表"""
    scs = db.query(SmartCollection).filter(SmartCollection.user_id == user_id).all()
    result = []
    for sc in scs:
        result.append({
            "id": sc.id,
            "name": sc.name,
            "description": sc.description,
            "cover_url": sc.cover_url,
            "rule_type": sc.rule_type,
            "rule_value": sc.rule_value,
            "match_count": sc.match_count,
            "created_at": sc.created_at.isoformat() if sc.created_at else None,
        })
    return result


def sync_smart_collection(db: Session, sc_id: str, user_id: int) -> int:
    """同步智能合集：按规则匹配用户笔记"""
    sc = db.query(SmartCollection).filter(
        SmartCollection.id == sc_id, SmartCollection.user_id == user_id
    ).first()
    if not sc:
        return 0

    # 按规则类型查询匹配的 task（物理删除后已删除任务不在表内，无需过滤）
    query = db.query(VideoTask).filter(VideoTask.user_id == user_id)
    if sc.rule_type == "platform":
        matched = query.filter(VideoTask.platform == sc.rule_value).all()
    elif sc.rule_type == "tag":
        # 搜索 tags 字段（JSON 格式）包含 rule_value 的
        matched = query.filter(VideoTask.tags.contains(sc.rule_value)).all()
    elif sc.rule_type == "channel":
        matched = query.filter(VideoTask.author_id == sc.rule_value).all()
    else:
        matched = []

    match_count = len(matched)
    sc.match_count = match_count

    # 如果有目标合集，把匹配的 task 加入
    if sc.target_collection_id and matched:
        task_ids = [t.task_id for t in matched]
        add_items_to_collection(db, sc.target_collection_id, task_ids)

    db.commit()
    return match_count


def delete_smart_collection(db: Session, sc_id: str, user_id: int) -> bool:
    """删除智能合集"""
    sc = db.query(SmartCollection).filter(
        SmartCollection.id == sc_id, SmartCollection.user_id == user_id
    ).first()
    if not sc:
        return False
    db.delete(sc)
    db.commit()
    return True
