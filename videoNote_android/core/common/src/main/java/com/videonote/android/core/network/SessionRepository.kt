package com.videonote.android.core.network

import com.videonote.android.core.common.EncryptedDataStore
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 会话恢复：App 启动时从 EncryptedDataStore 恢复 token 和 serverUrl 到 SessionManager
 *
 * 注：本类放在 core:common 模块中（包名保持 com.videonote.android.core.network 以便与
 * SessionManager 同包）。core:common 依赖 core:network，因此可同时访问 SessionManager
 * 与 EncryptedDataStore，避免 core:network 反向依赖 core:common 造成循环依赖。
 */
@Singleton
class SessionRepository @Inject constructor(
    private val sessionManager: SessionManager,
    private val dataStore: EncryptedDataStore
) {
    suspend fun restoreSession(): Boolean {
        val token = dataStore.token.first()
        val serverUrl = dataStore.serverUrl.first()

        if (token != null && serverUrl != null) {
            sessionManager.setToken(token)
            sessionManager.setServerUrl(serverUrl)
            return true
        }
        return false
    }
}
