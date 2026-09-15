package com.videonote.android.core.common

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 加密数据存储：保存 token 和服务器地址
 *
 * 使用 EncryptedSharedPreferences（AES256-GCM）加密敏感数据。
 * 对于 token 这类敏感凭证，不使用明文 DataStore。
 *
 * 通过 StateFlow 暴露数据，方便 Compose 收集。
 */
@Singleton
class EncryptedDataStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "videonote_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    // StateFlow 缓存：避免每次读取都走 SP IO
    private val _token = MutableStateFlow<String?>(prefs.getString(KEY_TOKEN, null))
    val token: Flow<String?> = _token.asStateFlow()

    private val _serverUrl = MutableStateFlow(prefs.getString(KEY_SERVER_URL, null))
    val serverUrl: Flow<String?> = _serverUrl.asStateFlow()

    private val _username = MutableStateFlow(prefs.getString(KEY_USERNAME, null))
    val username: Flow<String?> = _username.asStateFlow()

    private val _themeMode = MutableStateFlow(prefs.getString(KEY_THEME_MODE, "system") ?: "system")
    val themeMode: Flow<String> = _themeMode.asStateFlow()

    fun setToken(token: String?) {
        if (token != null) prefs.edit().putString(KEY_TOKEN, token).apply()
        else prefs.edit().remove(KEY_TOKEN).apply()
        _token.value = token
    }

    fun setServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, url).apply()
        _serverUrl.value = url
    }

    fun setUsername(username: String) {
        prefs.edit().putString(KEY_USERNAME, username).apply()
        _username.value = username
    }

    fun setThemeMode(mode: String) {
        prefs.edit().putString(KEY_THEME_MODE, mode).apply()
        _themeMode.value = mode
    }

    fun clearAll() {
        prefs.edit().clear().apply()
        _token.value = null
        _serverUrl.value = null
        _username.value = null
        _themeMode.value = "system"
    }

    companion object {
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_USERNAME = "username"
        private const val KEY_THEME_MODE = "theme_mode"
    }
}
