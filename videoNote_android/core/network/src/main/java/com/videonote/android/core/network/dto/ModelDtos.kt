package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class ProviderDto(
    val id: Int,
    val name: String,
    val enabled: Boolean = true
)

@Serializable
data class ModelDto(
    val id: String,
    val name: String,
    val provider_id: Int? = null
)
