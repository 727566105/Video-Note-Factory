package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * 思源笔记配置 - GET /api/siyuan/config
 *
 * 后端实测返回 data: null（未配置时），有配置时返回完整对象。
 * 关键修复：所有字段可空 + 默认值，避免 data:null 导致反序列化失败。
 *
 * 注意：enabled 是 Int (0/1)，不是 Boolean
 */
@Serializable
data class SiyuanConfigDto(
    @Serializable(with = AnyToIntStrictSerializer::class)
    val enabled: Int = 0,
    val server_url: String = "",
    val api_url: String = "",
    val token: String = "",
    val box: String = "",
    val box_id: String = "",
    val root_block_id: String = ""
)

/**
 * Obsidian 配置 - GET /api/obsidian/config
 *
 * 后端实测字段：id, export_mode, vault_path, folder_path, attachments_folder,
 * api_url, api_key, enabled(int), created_at, updated_at
 *
 * 关键修复：补字段 + enabled 保持 Int
 */
@Serializable
data class ObsidianConfigDto(
    @Serializable(with = AnyToIntStrictSerializer::class)
    val id: Int = 0,
    val export_mode: String = "local",
    val vault_path: String = "",
    val folder_path: String = "",
    val attachments_folder: String = "",
    val api_url: String? = null,
    val api_key: String? = null,
    @Serializable(with = AnyToIntStrictSerializer::class)
    val enabled: Int = 0,
    val created_at: String = "",
    val updated_at: String = ""
)

/**
 * 系统健康检查响应 - GET /api/health
 *
 * 后端实测字段：status, checks(对象，含 database/ffmpeg/ai_provider/cookie/transcriber/directories)
 * 后端不返回 version 字段（DTO 保留作占位，UI 应用 BuildConfig.VERSION_NAME 取版本）
 */
@Serializable
data class HealthResponse(
    val status: String = "ok",
    val version: String = "",
    val checks: HealthChecks? = null
)

@Serializable
data class HealthChecks(
    val database: HealthCheck? = null,
    val ffmpeg: HealthCheck? = null,
    val ai_provider: HealthCheck? = null,
    val cookie: HealthCheck? = null,
    val transcriber: HealthCheck? = null,
    val directories: HealthCheck? = null
)

@Serializable
data class HealthCheck(
    val ok: Boolean = false,
    val count: Int? = null,
    val type: String? = null,
    val platforms: Map<String, Boolean>? = null
)

/**
 * 用户偏好 - GET /api/user/preferences
 *
 * 后端实测返回：
 * {"summary": {"style":"academic","outputLanguage":"zh","videoUnderstanding":true,
 *              "videoInterval":4,"gridCols":3,"gridRows":3,"selectedFormats":["summary"],"extras":""},
 *  "model": {"selectedModel":19}}
 *
 * 关键修复：完全对齐后端结构，原 theme/default_style/default_smart_mode 后端不返回
 */
@Serializable
data class UserPreferencesDto(
    val summary: UserSummaryPrefs = UserSummaryPrefs(),
    val model: UserModelPrefs = UserModelPrefs()
)

@Serializable
data class UserSummaryPrefs(
    val style: String = "academic",
    val outputLanguage: String = "zh",
    val videoUnderstanding: Boolean = true,
    val videoInterval: Int = 4,
    val gridCols: Int = 3,
    val gridRows: Int = 3,
    val selectedFormats: List<String> = emptyList(),
    val extras: String = ""
)

@Serializable
data class UserModelPrefs(
    val selectedModel: Int? = null
)
