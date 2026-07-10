package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.FeedListResponse
import com.videonote.android.core.network.dto.UnreadCountResponse
import com.videonote.android.core.network.dto.GenerateNoteResponse
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface FeedApi {

    @GET("api/feed")
    suspend fun getFeed(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20,
        @Query("unread_only") unreadOnly: Boolean = false
    ): ApiResponse<FeedListResponse>

    @PUT("api/feed/{itemId}/read")
    suspend fun markRead(@Path("itemId") itemId: String): ApiResponse<Unit>

    @PUT("api/feed/read-all")
    suspend fun markAllRead(): ApiResponse<Unit>

    @POST("api/feed/refresh")
    suspend fun refresh(): ApiResponse<Unit>

    @GET("api/feed/unread-count")
    suspend fun getUnreadCount(): ApiResponse<UnreadCountResponse>

    @POST("api/feed/{itemId}/generate-note")
    suspend fun generateNoteFromFeed(
        @Path("itemId") itemId: String,
        @Query("smart_mode") smartMode: Boolean = true
    ): ApiResponse<GenerateNoteResponse>
}
