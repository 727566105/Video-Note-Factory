package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

// 注意：enabled 是 Int (0/1)，不是 Boolean
@Serializable
data class SiyuanConfigDto(
    val enabled: Int = 0,
    val server_url: String = "",
    val token: String = "",
    val box: String = ""
)

@Serializable
data class ObsidianConfigDto(
    val enabled: Int = 0,
    val vault_path: String = ""
)

@Serializable
data class HealthResponse(
    val status: String = "ok",
    val version: String = ""
)

@Serializable
data class UserPreferencesDto(
    val theme: String = "system",
    val default_style: String = "detailed",
    val default_smart_mode: Boolean = true
)
