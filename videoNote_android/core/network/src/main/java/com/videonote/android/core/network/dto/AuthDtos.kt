package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
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
