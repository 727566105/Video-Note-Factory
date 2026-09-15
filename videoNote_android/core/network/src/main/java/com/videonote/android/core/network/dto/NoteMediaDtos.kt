package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * 笔记媒体列表响应 - 对应后端 GET /api/note_media/{task_id}
 *
 * 后端实测返回字段（按 content_type 分支）：
 * - video: 直接返回 {content_type:"video", images:[], live_photos:[]}，不扫目录，不带 cover_url
 * - article（纯图文）: images 有 image_*.jpg 列表，live_photos 空，带 cover_url
 * - live_photo（小红书图文+实况）: images 和 live_photos 都有，cover_url 有
 *
 * 关键点：
 * 1. images 是相对路径字符串数组（如 "/api/note_media_file/xhs/.../image_1.jpg"）
 * 2. live_photos 是对象数组，含 index + video_url
 * 3. live_photos[i].index 与 images 中 image_{index}.jpg 按 index 配对，不是按数组下标
 * 4. 所有 /api/note_media_file/xxx 路径无鉴权、支持 Range 请求
 */
@Serializable
data class NoteMediaResponse(
    val content_type: String = "video",
    val images: List<String> = emptyList(),
    val live_photos: List<LivePhotoItem> = emptyList(),
    val cover_url: String? = null
)

/**
 * Live Photo 项 - 后端 /api/note_media 的 live_photos 数组元素
 *
 * @param index 文件名中的数字索引，对应 image_{index}.jpg
 * @param video_url 实况视频相对路径，如 "/api/note_media_file/.../live_photo_1.mp4"
 */
@Serializable
data class LivePhotoItem(
    @Serializable(with = AnyToIntStrictSerializer::class)
    val index: Int = 0,
    val video_url: String = ""
)
