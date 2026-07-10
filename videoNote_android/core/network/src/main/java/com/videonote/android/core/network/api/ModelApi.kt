package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.ProviderDto
import com.videonote.android.core.network.dto.ModelDto
import retrofit2.http.GET
import retrofit2.http.Path

interface ModelApi {

    @GET("api/model_list")
    suspend fun getModelList(): ApiResponse<List<ProviderDto>>

    @GET("api/model_list/{providerId}")
    suspend fun getModelsByProvider(@Path("providerId") providerId: Int): ApiResponse<List<ModelDto>>
}
