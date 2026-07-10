package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class CollectionDto(
    val id: String,
    val name: String,
    val description: String = "",
    val note_count: Int = 0,
    val updated_at: String = ""
)

@Serializable
data class CollectionDetailDto(
    val id: String,
    val name: String,
    val description: String = "",
    val tasks: List<TaskItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

@Serializable
data class CreateCollectionRequest(
    val name: String,
    val description: String = ""
)

@Serializable
data class UpdateCollectionRequest(
    val name: String? = null,
    val description: String? = null
)

@Serializable
data class AddToCollectionRequest(
    val task_id: String
)

@Serializable
data class CollectionSummaryDto(
    val summary: String = "",
    val generated_at: String = ""
)

@Serializable
data class TaskMapResponse(
    val task_collections: Map<String, List<String>> = emptyMap()
)
