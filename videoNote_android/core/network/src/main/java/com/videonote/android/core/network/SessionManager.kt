package com.videonote.android.core.network

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 会话管理器：内存中保存 token 和服务器地址
 * 实际持久化在 core/common 的 EncryptedDataStore 中
 * 由 SessionRepository 在启动时注入
 */
@Singleton
class SessionManager @Inject constructor() {
    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token

    private val _serverUrl = MutableStateFlow<String?>(null)
    val serverUrl: StateFlow<String?> = _serverUrl

    fun setToken(token: String?) { _token.value = token }
    fun setServerUrl(url: String?) { _serverUrl.value = url }
    fun clearToken() { _token.value = null }
}
