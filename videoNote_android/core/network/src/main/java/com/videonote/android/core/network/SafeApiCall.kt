package com.videonote.android.core.network

import com.videonote.android.core.network.dto.ApiException
import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.ErrorResponse
import com.videonote.android.core.network.dto.HttpException
import kotlinx.serialization.json.Json
import retrofit2.HttpException as RetrofitHttpException
import retrofit2.Response
import java.io.IOException

/**
 * 统一 API 调用包装器，处理两种错误格式：
 * 1. 业务错误：HTTP 200 + {code: 非0, msg: "..."}
 * 2. HTTP 错误：HTTP 4xx/5xx + {detail: "..."}
 *
 * 注意：Retrofit 在 HTTP 4xx/5xx 时会抛出 retrofit2.HttpException，
 * 此时响应体尚未被反序列化为 ApiResponse，需要手动解析 errorBody 获取 detail。
 */
suspend fun <T> safeApiCall(apiCall: suspend () -> ApiResponse<T>): T {
    return try {
        val response = apiCall()
        if (response.code == 0) {
            response.data ?: throw ApiException(-1, "响应数据为空")
        } else {
            throw ApiException(response.code, response.msg)
        }
    } catch (e: ApiException) {
        throw e
    } catch (e: RetrofitHttpException) {
        val errorBody = e.response()?.errorBody()?.string()
        val detail = try {
            errorBody?.let { Json.decodeFromString<ErrorResponse>(it).detail }
        } catch (_: Exception) { null }
        throw HttpException(e.code(), detail ?: e.message ?: "网络请求失败")
    } catch (e: IOException) {
        throw NetworkException("网络连接失败，请检查服务器地址")
    }
}

/**
 * 对返回 ResponseBody 的流式接口（如导出 PDF/图片）的包装器。
 * HTTP 错误时解析 {detail}，成功时返回 ResponseBody 供调用方写入文件。
 */
suspend fun safeStreamCall(streamCall: suspend () -> Response<okhttp3.ResponseBody>): okhttp3.ResponseBody {
    return try {
        val response = streamCall()
        if (response.isSuccessful) {
            response.body() ?: throw NetworkException("响应体为空")
        } else {
            val errorBody = response.errorBody()?.string()
            val detail = try {
                errorBody?.let { Json.decodeFromString<ErrorResponse>(it).detail }
            } catch (_: Exception) { null }
            throw HttpException(response.code(), detail ?: "HTTP ${response.code()}")
        }
    } catch (e: HttpException) {
        throw e
    } catch (e: IOException) {
        throw NetworkException("网络连接失败，请检查服务器地址")
    }
}

class NetworkException(override val message: String) : Exception(message)
