package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * 收藏夹项 - 对应后端 GET /api/collections 返回的数组元素
 *
 * 后端实测字段：
 * id, user_id, name, description, cover_url, category(null), sort_order(int),
 * share_token(null), is_shared(int 0/1), created_at, updated_at, item_count(int)
 *
 * 关键修复点：
 * 1. note_count -> item_count（字段名对齐，保留 note_count 作旧别名）
 * 2. 补字段：cover_url, created_at, is_shared, sort_order, user_id, category, share_token
 */
@Serializable
data class CollectionDto(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    // 后端字段名是 item_count，保留 note_count 作兼容别名
    @Serializable(with = AnyToIntStrictSerializer::class)
    val item_count: Int = 0,
    @Serializable(with = AnyToIntStrictSerializer::class)
    val note_count: Int = 0,
    val cover_url: String? = null,
    val created_at: String = "",
    val updated_at: String = "",
    @Serializable(with = AnyToBooleanStrictSerializer::class)
    val is_shared: Boolean = false,
    @Serializable(with = AnyToIntStrictSerializer::class)
    val sort_order: Int = 0,
    @Serializable(with = AnyToStringSerializer::class)
    val user_id: String? = null,
    val category: String? = null,
    val share_token: String? = null
) {
    /** 统一接口：笔记数量（优先 item_count） */
    val effectiveCount: Int get() = if (item_count > 0) item_count else note_count
}

/**
 * 收藏夹内笔记项 - 对应后端 GET /api/collections/{id} 返回的 items 数组元素
 *
 * 后端实测字段：id, task_id, position, added_at, title, cover_url, platform,
 * author, author_id, video_id, duration(float)
 *
 * 这是简化版的 TaskItem，不含 note 对象，不能直接复用 TaskItem（字段不匹配）。
 */
@Serializable
data class CollectionItem(
    val id: String = "",
    val task_id: String = "",
    val title: String = "",
    val cover_url: String? = null,
    val platform: String = "",
    val author: String = "",
    val author_id: String? = null,
    val video_id: String? = null,
    @Serializable(with = AnyToStringSerializer::class)
    val duration: String? = null,
    @Serializable(with = AnyToIntStrictSerializer::class)
    val position: Int = 0,
    val added_at: String = ""
)

/**
 * 收藏夹详情 - 对应后端 GET /api/collections/{id} 返回
 *
 * 后端实测字段：id, user_id, name, description, cover_url, category, sort_order,
 * share_token, is_shared, created_at, updated_at, items(列表), summary(对象)
 *
 * 关键修复点：
 * 1. tasks -> items（字段名对齐，保留 tasks 作兼容别名，类型改为 CollectionItem）
 * 2. 移除 total/page/page_size（后端不返回分页字段）
 * 3. 补字段：summary, cover_url, created_at, is_shared 等
 */
@Serializable
data class CollectionDetailDto(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    // 后端字段名是 items，保留 tasks 作兼容别名
    val items: List<CollectionItem> = emptyList(),
    val tasks: List<CollectionItem> = emptyList(),
    val summary: CollectionSummary? = null,
    val cover_url: String? = null,
    val created_at: String = "",
    val updated_at: String = "",
    @Serializable(with = AnyToBooleanStrictSerializer::class)
    val is_shared: Boolean = false,
    @Serializable(with = AnyToIntStrictSerializer::class)
    val sort_order: Int = 0,
    @Serializable(with = AnyToStringSerializer::class)
    val user_id: String? = null,
    val category: String? = null,
    val share_token: String? = null
) {
    /** 统一接口：笔记列表（优先 items） */
    val effectiveItems: List<CollectionItem> get() = if (items.isNotEmpty()) items else tasks
}

/**
 * 收藏夹 AI 摘要 - 后端 GET /api/collections/{id} 的 summary 字段
 *
 * 后端实测字段：id, collection_id, content, style, summary_mode, model_name,
 * provider_id, extras, created_at, updated_at
 */
@Serializable
data class CollectionSummary(
    val id: String? = null,
    val collection_id: String? = null,
    val content: String = "",
    val style: String? = null,
    val summary_mode: String? = null,
    val model_name: String? = null,
    val provider_id: String? = null,
    val extras: String = "",
    val created_at: String = "",
    val updated_at: String = ""
)

@Serializable
data class CreateCollectionRequest(
    val name: String,
    val description: String = ""
)

@Serializable
data class UpdateCollectionRequest(
    val name: String? = null,
    val description: String? = null
)

@Serializable
data class AddToCollectionRequest(
    val task_id: String
)

/**
 * 收藏夹摘要响应 - GET /api/collections/{id}/summary
 */
@Serializable
data class CollectionSummaryDto(
    val summary: String = "",
    val content: String = "",
    val generated_at: String = "",
    val created_at: String = ""
)

@Serializable
data class TaskMapResponse(
    val task_collections: Map<String, List<String>> = emptyMap()
)
