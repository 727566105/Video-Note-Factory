package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class SubscriptionDto(
    val id: String,
    val platform: String,
    val platform_id: String,
    val author: String,
    val avatar: String? = null,
    val enabled: Boolean = true,
    val last_updated: String = ""
)

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
    val platform: String,
    val platform_id: String,
    val author: String,
    val avatar: String? = null
)

@Serializable
data class ChannelVideosResponse(
    val videos: List<FeedItem> = emptyList(),
    val total: Int = 0
)
