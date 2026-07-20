package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class GenerateNoteRequest(
    val video_url: String? = null,
    val platform: String = "bilibili",
    val smart_mode: Boolean = true,
    val model_name: String = "auto",
    val provider_id: String = "0",
    val style: String = "detailed",
    val quality: String = "medium",
    val output_language: String = "zh",
    val format: List<String> = emptyList(),
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
    val ver_id: String? = null,
    val content: String? = null,
    val style: String? = null,
    val model_name: String? = null,
    val created_at: String? = null,
    val timestamp: String? = null
)

@Serializable
data class TaskListResponse(
    val tasks: List<TaskItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

/**
 * 笔记列表项 - 对应后端 GET /api/tasks 返回的 tasks 数组元素
 *
 * 后端实际返回字段（实测）：
 * task_id, video_id, platform, video_url, created_at, status, message,
 * content_type, title, cover_url, duration(float|null), author,
 * author_id, author_name, tags(JSON 字符串), note(对象，被 ignoreUnknownKeys 忽略)
 *
 * 注意：
 * - duration 后端是 float 秒数（如 45167.0），用 AnyToStringSerializer 转 String，UI 自行格式化
 * - has_note 后端不返回，永远拿默认值 true；UI 应改用 status == "SUCCESS" 判断
 * - tags 后端返回 JSON 字符串 '{"platform_tags":...,"ai_tags":...,"manual_tags":...}'
 */
@Serializable
data class TaskItem(
    val task_id: String,
    val title: String = "",
    val author: String = "",
    val author_id: String? = null,
    val author_name: String? = null,
    val platform: String = "",
    val video_id: String? = null,
    val video_url: String? = null,
    val cover_url: String? = null,
    val created_at: String = "",
    val status: String = "SUCCESS",
    val message: String? = null,
    val content_type: String? = null,
    @Serializable(with = AnyToStringSerializer::class)
    val duration: String? = null,
    val has_note: Boolean = true,
    val tags: String? = null
)

@Serializable
data class QuickViewResponse(
    val task_id: String = "",
    val title: String = "",
    val author: String = "",
    // 后端实测返回的笔记正文
    val markdown: String? = null,
    val model_name: String? = null,
    // 以下字段后端实测不返回，但保留为可空以兼容未来扩展
    val platform: String = "",
    val cover_url: String? = null,
    val video_url: String? = null,
    @Serializable(with = AnyToStringSerializer::class)
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
    val file_path: String = "",
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
