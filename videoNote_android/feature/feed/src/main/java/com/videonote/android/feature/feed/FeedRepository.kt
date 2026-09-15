package com.videonote.android.feature.feed

import com.videonote.android.core.network.api.FeedApi
import com.videonote.android.core.network.api.SubscriptionApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedRepository @Inject constructor(
    private val feedApi: FeedApi,
    private val subscriptionApi: SubscriptionApi
) {
    suspend fun getFeed(page: Int = 1, unreadOnly: Boolean = false): List<FeedItem> {
        return safeApiCall { feedApi.getFeed(page = page, unreadOnly = unreadOnly) }
    }

    suspend fun markRead(itemId: String) {
        safeApiCall { feedApi.markRead(itemId) }
    }

    suspend fun markAllRead() {
        safeApiCall { feedApi.markAllRead() }
    }

    suspend fun refresh() {
        safeApiCall { feedApi.refresh() }
    }

    suspend fun getUnreadCount(): UnreadCountResponse {
        return safeApiCall { feedApi.getUnreadCount() }
    }

    suspend fun generateNoteFromFeed(itemId: String, smartMode: Boolean = true): GenerateNoteResponse {
        return safeApiCall { feedApi.generateNoteFromFeed(itemId, smartMode) }
    }

    // 订阅管理
    suspend fun getSubscriptions(): List<SubscriptionDto> {
        return safeApiCall { subscriptionApi.getSubscriptions() }
    }

    suspend fun createSubscription(request: CreateSubscriptionRequest): SubscriptionDto {
        return safeApiCall { subscriptionApi.createSubscription(request) }
    }

    suspend fun deleteSubscription(id: String) {
        safeApiCall { subscriptionApi.deleteSubscription(id) }
    }

    suspend fun toggleSubscription(id: String) {
        safeApiCall { subscriptionApi.toggleSubscription(id) }
    }

    suspend fun parseChannelUrl(url: String): ChannelParseResponse {
        return safeApiCall { subscriptionApi.parseChannelUrl(ChannelParseRequest(url)) }
    }
}
