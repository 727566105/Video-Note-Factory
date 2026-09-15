package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * Feed 列表项 - 对应后端 GET /api/feed 返回的数组元素
 *
 * 后端实测字段：
 * id(int), subscription_id(int), platform, content_type, content_id,
 * content_url, title, cover_url, images(array|null), duration(float|null),
 * author, description(string|null), published_at, is_read(int 0/1),
 * task_id(string|null), note_available(bool), available_task_id(string|null)
 *
 * 关键修复点：
 * 1. id 后端是 Int，DTO 改成 Int? 兼容
 * 2. video_url -> content_url（字段名对齐）
 * 3. duration 后端是 float，用 AnyToStringSerializer
 * 4. is_read 后端是 Int(0/1)，用 AnyToBooleanStrictSerializer
 * 5. 补字段：subscription_id, content_id, content_type, task_id, images
 */
@Serializable
data class FeedItem(
    @Serializable(with = AnyToStringSerializer::class)
    val id: String? = null,
    val title: String = "",
    val description: String? = null,
    val cover_url: String? = null,
    val author: String = "",
    val platform: String = "",
    val content_type: String? = null,
    val content_id: String? = null,
    // 兼容旧字段名 video_url（后端实际叫 content_url）
    val content_url: String? = null,
    val video_url: String? = null,
    val published_at: String = "",
    @Serializable(with = AnyToStringSerializer::class)
    val duration: String? = null,
    @Serializable(with = AnyToBooleanStrictSerializer::class)
    val is_read: Boolean = false,
    val note_available: Boolean = false,
    val available_task_id: String? = null,
    val task_id: String? = null,
    @Serializable(with = AnyToStringSerializer::class)
    val subscription_id: String? = null,
    val images: List<String>? = null
) {
    /**
     * 视频内容 URL（统一接口，优先 content_url，回退 video_url）
     */
    val effectiveContentUrl: String? get() = content_url ?: video_url
}

/**
 * 后端 /api/feed 直接返回数组（不是 {items: [...]}）。
 * 此 DTO 保留作为兼容入口，但应配合自定义反序列化或改 API 签名使用 List<FeedItem>。
 *
 * 实际推荐做法：在 FeedApi 中把返回类型改为 List<FeedItem>，见 FeedApi.kt
 */
@Serializable
data class FeedListResponse(
    val items: List<FeedItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

@Serializable
data class UnreadCountResponse(
    val count: Int = 0
)
