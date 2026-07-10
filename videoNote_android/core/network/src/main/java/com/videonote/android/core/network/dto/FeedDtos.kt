package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class FeedListResponse(
    val items: List<FeedItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

@Serializable
data class FeedItem(
    val id: String,
    val title: String,
    val description: String = "",
    val cover_url: String? = null,
    val author: String = "",
    val platform: String = "",
    val published_at: String = "",
    val video_url: String? = null,
    val duration: String? = null,
    val is_read: Boolean = false,
    val note_available: Boolean = false,
    val available_task_id: String? = null
)

@Serializable
data class UnreadCountResponse(
    val count: Int
)
