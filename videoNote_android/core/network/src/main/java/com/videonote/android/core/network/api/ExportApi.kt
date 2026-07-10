package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.ObsidianExportRequest
import okhttp3.ResponseBody
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Body
import retrofit2.http.Streaming
import retrofit2.Response

interface ExportApi {

    @Streaming
    @GET("api/export/pdf/{taskId}")
    suspend fun exportPdf(@Path("taskId") taskId: String): Response<ResponseBody>

    @Streaming
    @GET("api/export/image/{taskId}")
    suspend fun exportImage(@Path("taskId") taskId: String): Response<ResponseBody>

    @POST("api/siyuan/export/siyuan/{taskId}")
    suspend fun exportToSiyuan(@Path("taskId") taskId: String): ApiResponse<Unit>

    @POST("api/obsidian/export/obsidian/{taskId}")
    suspend fun exportToObsidian(
        @Path("taskId") taskId: String,
        @Body request: ObsidianExportRequest = ObsidianExportRequest()
    ): ApiResponse<Unit>
}
