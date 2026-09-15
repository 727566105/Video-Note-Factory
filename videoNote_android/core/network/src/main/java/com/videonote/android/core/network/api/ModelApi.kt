package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.ModelDto
import retrofit2.http.GET
import retrofit2.http.Path

interface ModelApi {

    // 后端 /api/model_list 实际返回 ModelDto 列表（不是 ProviderDto）
    @GET("api/model_list")
    suspend fun getModelList(): ApiResponse<List<ModelDto>>

    @GET("api/model_list/{providerId}")
    suspend fun getModelsByProvider(@Path("providerId") providerId: Int): ApiResponse<List<ModelDto>>
}
