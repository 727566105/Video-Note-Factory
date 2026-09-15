package com.videonote.android.feature.auth

import com.videonote.android.core.common.EncryptedDataStore
import com.videonote.android.core.network.SessionManager
import com.videonote.android.core.network.api.AuthApi
import com.videonote.android.core.network.dto.LoginRequest
import com.videonote.android.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val sessionManager: SessionManager,
    private val dataStore: EncryptedDataStore
) {
    suspend fun login(serverUrl: String, username: String, password: String): Result<String> {
        return try {
            sessionManager.setServerUrl(serverUrl.trimEnd('/'))
            val response = safeApiCall { authApi.login(LoginRequest(username, password, client = "android")) }
            val token = response.token
            sessionManager.setToken(token)
            dataStore.setServerUrl(serverUrl.trimEnd('/'))
            dataStore.setToken(token)
            dataStore.setUsername(username)
            Result.success(token)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restoreSession(): Boolean {
        // 从 DataStore 恢复 token 和 serverUrl（在 Application 启动时调用）
        return false // 实现见下方
    }

    suspend fun logout() {
        sessionManager.setToken(null)
        dataStore.setToken(null)
    }
}
