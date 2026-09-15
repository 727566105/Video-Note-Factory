package com.videonote.android.core.network.interceptor

import com.videonote.android.core.network.SessionManager
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * JWT 认证拦截器：自动注入 Authorization header
 * 401 响应时清除 token（由上层处理跳转登录页）
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val sessionManager: SessionManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = sessionManager.token.value
        val authedRequest = if (token != null && request.header("Authorization") == null) {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }
        val response = chain.proceed(authedRequest)
        if (response.code == 401) {
            sessionManager.clearToken()
        }
        return response
    }
}
