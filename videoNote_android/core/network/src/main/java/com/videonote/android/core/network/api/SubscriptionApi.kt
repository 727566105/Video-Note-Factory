package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.SubscriptionDto
import com.videonote.android.core.network.dto.CreateSubscriptionRequest
import com.videonote.android.core.network.dto.ChannelParseRequest
import com.videonote.android.core.network.dto.ChannelParseResponse
import com.videonote.android.core.network.dto.ChannelVideosResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.DELETE
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface SubscriptionApi {

    @GET("api/subscriptions")
    suspend fun getSubscriptions(): ApiResponse<List<SubscriptionDto>>

    @POST("api/subscriptions")
    suspend fun createSubscription(@Body request: CreateSubscriptionRequest): ApiResponse<SubscriptionDto>

    @DELETE("api/subscriptions/{id}")
    suspend fun deleteSubscription(@Path("id") id: String): ApiResponse<Unit>

    @PUT("api/subscriptions/{id}/toggle")
    suspend fun toggleSubscription(@Path("id") id: String): ApiResponse<Unit>

    @POST("api/subscriptions/{id}/refresh")
    suspend fun refreshSubscription(@Path("id") id: String): ApiResponse<Unit>

    @POST("api/channels/parse-url")
    suspend fun parseChannelUrl(@Body request: ChannelParseRequest): ApiResponse<ChannelParseResponse>

    @GET("api/channels/{platform}/{platformId}/videos")
    suspend fun getChannelVideos(
        @Path("platform") platform: String,
        @Path("platformId") platformId: String,
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20
    ): ApiResponse<ChannelVideosResponse>
}
