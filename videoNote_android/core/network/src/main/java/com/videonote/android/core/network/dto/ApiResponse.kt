package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * 后端统一响应格式 {code, msg, data}
 * code == 0 表示成功
 */
@Serializable
data class ApiResponse<T>(
    val code: Int,
    val msg: String,
    val data: T? = null
)

/**
 * HTTP 错误响应格式 {detail: "..."}
 */
@Serializable
data class ErrorResponse(
    val detail: String? = null
)

/**
 * 业务异常：code != 0
 */
class ApiException(val code: Int, override val message: String) : Exception(message)

/**
 * HTTP 异常：4xx/5xx
 */
class HttpException(val statusCode: Int, val detail: String) : Exception(detail)
