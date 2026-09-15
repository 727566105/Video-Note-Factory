package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * 订阅项 - 对应后端 GET /api/subscriptions 返回的数组元素
 *
 * 后端实测字段：
 * id(int), channel_url, channel_name, platform, platform_id, unique_id(string|null),
 * avatar_url(string,可能空串), enabled(int 0/1), fetch_interval(int), fetch_at_hour(int),
 * fetch_at_day(int|null), auto_generate(int 0/1), generate_style(string|null),
 * last_checked_at, last_content_id(string|null), last_fetch_status(string),
 * last_fetch_count(int), last_fetch_error(string|null), last_fetch_at, created_at
 *
 * 关键修复点：
 * 1. id 后端是 Int，DTO 改成 String? 兼容
 * 2. author -> channel_name（字段名对齐，保留 author 作旧别名）
 * 3. avatar -> avatar_url（同上）
 * 4. enabled 后端是 Int(0/1)，用 AnyToBooleanStrictSerializer
 * 5. last_updated -> last_fetch_at（同上）
 * 6. 补字段：channel_url, fetch_interval, last_fetch_status, last_fetch_count, created_at 等
 */
@Serializable
data class SubscriptionDto(
    @Serializable(with = AnyToStringSerializer::class)
    val id: String? = null,
    val platform: String = "",
    val platform_id: String = "",
    // 后端字段名是 channel_name，保留 author 作兼容别名
    val channel_name: String = "",
    val author: String = "",
    // 后端字段名是 avatar_url，保留 avatar 作兼容别名
    val avatar_url: String? = null,
    val avatar: String? = null,
    @Serializable(with = AnyToBooleanStrictSerializer::class)
    val enabled: Boolean = true,
    val channel_url: String? = null,
    val unique_id: String? = null,
    @Serializable(with = AnyToIntStrictSerializer::class)
    val fetch_interval: Int = 60,
    @Serializable(with = AnyToIntStrictSerializer::class)
    val fetch_at_hour: Int = 0,
    val fetch_at_day: String? = null,
    @Serializable(with = AnyToBooleanStrictSerializer::class)
    val auto_generate: Boolean = false,
    val generate_style: String? = null,
    val last_checked_at: String = "",
    val last_content_id: String? = null,
    val last_fetch_status: String = "",
    @Serializable(with = AnyToIntStrictSerializer::class)
    val last_fetch_count: Int = 0,
    val last_fetch_error: String? = null,
    val last_fetch_at: String = "",
    // 兼容旧字段名 last_updated
    val last_updated: String = "",
    val created_at: String = ""
) {
    /** 统一接口：频道名（优先 channel_name） */
    val effectiveChannelName: String get() = channel_name.ifBlank { author }

    /** 统一接口：头像（优先 avatar_url） */
    val effectiveAvatar: String? get() = avatar_url ?: avatar

    /** 统一接口：最后更新时间（优先 last_fetch_at） */
    val effectiveLastUpdated: String get() = last_fetch_at.ifBlank { last_updated }
}

@Serializable
data class CreateSubscriptionRequest(
    val url: String,
    val platform: String
)

@Serializable
data class ChannelParseRequest(
    val url: String
)

@Serializable
data class ChannelParseResponse(
    val platform: String = "",
    val platform_id: String = "",
    val channel_name: String = "",
    val author: String = "",
    val avatar_url: String? = null,
    val avatar: String? = null
) {
    val effectiveChannelName: String get() = channel_name.ifBlank { author }
    val effectiveAvatar: String? get() = avatar_url ?: avatar
}

@Serializable
data class ChannelVideosResponse(
    val videos: List<FeedItem> = emptyList(),
    val total: Int = 0
)
