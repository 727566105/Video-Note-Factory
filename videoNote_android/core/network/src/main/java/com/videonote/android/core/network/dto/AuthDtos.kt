package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String,
    // 客户端来源，声明为非 web 以跳过图形验证码门（仍受 429 锁定保护）
    val client: String = "web"
)

@Serializable
data class LoginResponse(
    val token: String,
    val user: UserDto? = null
)

@Serializable
data class UserDto(
    val id: Int,
    val username: String,
    val role: String = "user",
    val avatar: String? = null
)

@Serializable
data class ChangePasswordRequest(
    val old_password: String,
    val new_password: String
)
