package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.GenerateNoteRequest
import com.videonote.android.core.network.dto.GenerateNoteResponse
import com.videonote.android.core.network.dto.TaskStatusResponse
import com.videonote.android.core.network.dto.TaskListResponse
import com.videonote.android.core.network.dto.NoteMediaResponse
import com.videonote.android.core.network.dto.QuickViewResponse
import com.videonote.android.core.network.dto.CheckNoteRequest
import com.videonote.android.core.network.dto.CheckNoteResponse
import com.videonote.android.core.network.dto.TagsRequest
import com.videonote.android.core.network.dto.TaskIdRequest
import com.videonote.android.core.network.dto.UploadResponse
import okhttp3.MultipartBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming
import retrofit2.http.Url

interface NoteApi {

    @POST("api/generate_note")
    suspend fun generateNote(@Body request: GenerateNoteRequest): ApiResponse<GenerateNoteResponse>

    @GET("api/task_status/{taskId}")
    suspend fun getTaskStatus(@Path("taskId") taskId: String): ApiResponse<TaskStatusResponse>

    @GET("api/tasks")
    suspend fun getTasks(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20,
        @Query("platform") platform: String? = null,
        @Query("search") search: String? = null
    ): ApiResponse<TaskListResponse>

    @GET("api/quick_view/{taskId}")
    suspend fun getQuickView(@Path("taskId") taskId: String): ApiResponse<QuickViewResponse>

    @POST("api/check_note_availability")
    suspend fun checkNoteAvailability(@Body request: CheckNoteRequest): ApiResponse<CheckNoteResponse>

    @Multipart
    @POST("api/upload")
    suspend fun uploadFile(@Part file: MultipartBody.Part): ApiResponse<UploadResponse>

    @POST("api/cancel_task")
    suspend fun cancelTask(@Body request: TaskIdRequest): ApiResponse<Unit>

    @POST("api/delete_task")
    suspend fun deleteTask(@Body request: TaskIdRequest): ApiResponse<Unit>

    @PUT("api/notes/{taskId}/tags")
    suspend fun updateTags(
        @Path("taskId") taskId: String,
        @Body request: TagsRequest
    ): ApiResponse<Unit>

    @GET("api/image_proxy")
    suspend fun getImageProxy(@Query("url") url: String): okhttp3.ResponseBody

    /**
     * 笔记媒体列表 - 后端 GET /api/note_media/{taskId}
     * 返回 {content_type, images[], live_photos[{index, video_url}], cover_url}
     * - video 类型：images/live_photos 空数组
     * - article 类型：images 有图片，live_photos 空
     * - live_photo 类型：images 和 live_photos 都有，按 index 配对
     */
    @GET("api/note_media/{taskId}")
    suspend fun getNoteMedia(@Path("taskId") taskId: String): ApiResponse<NoteMediaResponse>

    /**
     * 通用流式下载（媒体文件、视频等）。复用 OkHttpClient，自动带 Authorization。
     * @param url 完整 URL（调用方先用 ImageProxyHelper.resolveUrl 拼绝对路径）
     */
    @Streaming
    @GET
    suspend fun downloadMedia(@Url url: String): Response<ResponseBody>
}
