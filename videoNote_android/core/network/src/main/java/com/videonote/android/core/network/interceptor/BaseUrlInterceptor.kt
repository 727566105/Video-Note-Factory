package com.videonote.android.core.network.interceptor

import com.videonote.android.core.network.SessionManager
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 动态 BaseUrl 拦截器：从 SessionManager 读取用户配置的服务器地址
 * 服务器地址示例：http://192.168.1.100:8483
 */
@Singleton
class BaseUrlInterceptor @Inject constructor(
    private val sessionManager: SessionManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val serverUrl = sessionManager.serverUrl.value ?: return chain.proceed(originalRequest)

        // 解析一次服务器地址，提取 scheme/host/port
        val parsed = serverUrl.toHttpUrl()
        val newUrl = originalRequest.url.newBuilder()
            .scheme(parsed.scheme)
            .host(parsed.host)
            .port(parsed.port)
            .build()

        val newRequest = originalRequest.newBuilder()
            .url(newUrl)
            .build()
        return chain.proceed(newRequest)
    }
}
