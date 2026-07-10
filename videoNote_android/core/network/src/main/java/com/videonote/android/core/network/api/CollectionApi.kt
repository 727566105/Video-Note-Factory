package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.CollectionDto
import com.videonote.android.core.network.dto.CollectionDetailDto
import com.videonote.android.core.network.dto.CreateCollectionRequest
import com.videonote.android.core.network.dto.UpdateCollectionRequest
import com.videonote.android.core.network.dto.AddToCollectionRequest
import com.videonote.android.core.network.dto.CollectionSummaryDto
import com.videonote.android.core.network.dto.TaskMapResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.DELETE
import retrofit2.http.Path
import retrofit2.http.Query

interface CollectionApi {

    @GET("api/collections")
    suspend fun getCollections(): ApiResponse<List<CollectionDto>>

    @POST("api/collections")
    suspend fun createCollection(@Body request: CreateCollectionRequest): ApiResponse<CollectionDto>

    @GET("api/collections/{id}")
    suspend fun getCollection(
        @Path("id") id: String,
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20
    ): ApiResponse<CollectionDetailDto>

    @PUT("api/collections/{id}")
    suspend fun updateCollection(
        @Path("id") id: String,
        @Body request: UpdateCollectionRequest
    ): ApiResponse<CollectionDto>

    @DELETE("api/collections/{id}")
    suspend fun deleteCollection(@Path("id") id: String): ApiResponse<Unit>

    @POST("api/collections/{id}/items")
    suspend fun addToCollection(
        @Path("id") id: String,
        @Body request: AddToCollectionRequest
    ): ApiResponse<Unit>

    @DELETE("api/collections/{id}/items/{taskId}")
    suspend fun removeFromCollection(
        @Path("id") id: String,
        @Path("taskId") taskId: String
    ): ApiResponse<Unit>

    @GET("api/collections/task_map")
    suspend fun getTaskMap(@Query("task_ids") taskIds: String): ApiResponse<TaskMapResponse>

    @POST("api/collections/{id}/generate_summary")
    suspend fun generateSummary(@Path("id") id: String): ApiResponse<Unit>

    @GET("api/collections/{id}/summary")
    suspend fun getSummary(@Path("id") id: String): ApiResponse<CollectionSummaryDto>
}
