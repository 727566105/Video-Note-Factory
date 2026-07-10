package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class GenerateNoteRequest(
    val video_url: String? = null,
    val platform: String = "bilibili",
    val smart_mode: Boolean = true,
    val model_name: String? = null,
    val provider_id: Int? = null,
    val style: String = "detailed",
    val output_language: String = "zh",
    val format: String = "screenshot",
    val screenshot: Boolean = true,
    val link: Boolean = false,
    val file_path: String? = null
)

@Serializable
data class GenerateNoteResponse(
    val task_id: String,
    val status: String = "PENDING",
    val reused: Boolean = false,
    val reuse_type: String? = null,
    val message: String? = null
)

@Serializable
data class TaskStatusResponse(
    val task_id: String,
    val status: String,
    val progress: Int = 0,
    val step: String? = null,
    val error: String? = null,
    val result: TaskResult? = null
)

@Serializable
data class TaskResult(
    val versions: List<NoteVersion> = emptyList(),
    /**
     * tags 是 JSON 字符串（后端 task_status 返回格式）。
     * 使用时需解码：Json.decodeFromString<List<String>>(tags)
     * 注意：quick_view/{id} 返回的 QuickViewResponse.tags 直接是 List<String>，
     * 这是两个不同的 API，格式不同，此处仅 task_status 用字符串。
     */
    val tags: String? = null
)

/**
 * 解码 task_status 中的 tags JSON 字符串为 List
 */
fun TaskResult.decodeTags(json: Json = Json): List<String> {
    return tags?.let {
        try { json.decodeFromString<List<String>>(it) } catch (_: Exception) { emptyList() }
    } ?: emptyList()
}

@Serializable
data class NoteVersion(
    val version: String,
    val timestamp: String? = null
)

@Serializable
data class TaskListResponse(
    val tasks: List<TaskItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

@Serializable
data class TaskItem(
    val task_id: String,
    val title: String,
    val author: String = "",
    val platform: String = "",
    val cover_url: String? = null,
    val created_at: String = "",
    val status: String = "SUCCESS",
    val duration: String? = null,
    val has_note: Boolean = true
)

@Serializable
data class QuickViewResponse(
    val task_id: String,
    val title: String,
    val author: String = "",
    val platform: String = "",
    val cover_url: String? = null,
    val video_url: String? = null,
    val duration: String? = null,
    val created_at: String = "",
    val summary: String? = null,
    val subtitles: String? = null,
    val raw_article: String? = null,
    val outline: String? = null,
    val screenshots: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val author_id: String? = null,
    val subscribed: Boolean = false
)

@Serializable
data class CheckNoteRequest(
    val video_url: String,
    val platform: String
)

@Serializable
data class CheckNoteResponse(
    val exists: Boolean = false,
    val task_id: String? = null
)

@Serializable
data class UploadResponse(
    val file_path: String,
    val file_name: String? = null
)

@Serializable
data class TaskIdRequest(
    val task_id: String
)

@Serializable
data class TagsRequest(
    val tags: List<String>
)
