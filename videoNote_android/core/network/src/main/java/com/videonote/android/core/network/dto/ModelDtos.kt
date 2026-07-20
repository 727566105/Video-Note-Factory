package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * 模型项 - 对应后端 GET /api/model_list 返回的数组元素
 *
 * 后端实测返回：
 * {"id": 11, "provider_id": "467814bb-...", "model_name": "glm-5", "created_at": null}
 *
 * 关键修复点：
 * 1. id 后端是 Int，DTO 改成 String? 兼容
 * 2. name -> model_name（字段名对齐，保留 name 作旧别名）
 * 3. provider_id 后端是 String(UUID)，DTO 改成 String?
 * 4. 补字段 created_at
 *
 * 注意：后端 /api/model_list 实际返回的就是 ModelDto 列表，
 * 没有"Provider"概念（原 ProviderDto 字段 name/enabled 后端根本不返回）。
 * 保留 ProviderDto 类避免破坏太多调用方，但用 ModelDto 替代实际 API 调用。
 */
@Serializable
data class ModelDto(
    @Serializable(with = AnyToStringSerializer::class)
    val id: String? = null,
    // 后端字段名是 model_name，保留 name 作兼容别名
    val model_name: String = "",
    val name: String = "",
    @Serializable(with = AnyToStringSerializer::class)
    val provider_id: String? = null,
    val created_at: String? = null
) {
    /** 统一接口：模型名（优先 model_name） */
    val effectiveName: String get() = model_name.ifBlank { name }
}

/**
 * @deprecated 后端 /api/model_list 实际不返回 ProviderDto 结构，
 * 请改用 ModelDto。保留此类仅为兼容旧调用方。
 */
@Serializable
data class ProviderDto(
    @Serializable(with = AnyToIntSerializer::class)
    val id: Int? = null,
    val name: String = "",
    @Serializable(with = AnyToBooleanStrictSerializer::class)
    val enabled: Boolean = true
)
