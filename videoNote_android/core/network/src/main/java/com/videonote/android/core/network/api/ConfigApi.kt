package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.SiyuanConfigDto
import com.videonote.android.core.network.dto.ObsidianConfigDto
import com.videonote.android.core.network.dto.HealthResponse
import com.videonote.android.core.network.dto.UserPreferencesDto
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Body

interface ConfigApi {

    @GET("api/siyuan/config")
    suspend fun getSiyuanConfig(): ApiResponse<SiyuanConfigDto>

    @GET("api/obsidian/config")
    suspend fun getObsidianConfig(): ApiResponse<ObsidianConfigDto>

    @GET("api/health")
    suspend fun getHealth(): ApiResponse<HealthResponse>

    @GET("api/user/preferences")
    suspend fun getUserPreferences(): ApiResponse<UserPreferencesDto>

    @PUT("api/user/preferences")
    suspend fun updateUserPreferences(@Body request: UserPreferencesDto): ApiResponse<Unit>
}
