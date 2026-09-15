package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.LoginRequest
import com.videonote.android.core.network.dto.LoginResponse
import com.videonote.android.core.network.dto.UserDto
import com.videonote.android.core.network.dto.ChangePasswordRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT

interface AuthApi {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): ApiResponse<LoginResponse>

    @GET("api/auth/me")
    suspend fun getMe(): ApiResponse<UserDto>

    @PUT("api/auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): ApiResponse<Unit>
}
