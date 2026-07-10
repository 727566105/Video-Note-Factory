package com.videonote.android.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.common.EncryptedDataStore
import com.videonote.android.core.network.SessionManager
import com.videonote.android.core.network.api.AuthApi
import com.videonote.android.core.network.api.ConfigApi
import com.videonote.android.core.network.dto.ChangePasswordRequest
import com.videonote.android.core.network.safeApiCall
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val serverUrl: String = "",
    val username: String = "",
    val themeMode: String = "system",
    val healthStatus: String? = null,
    val oldPassword: String = "",
    val newPassword: String = "",
    val isChangingPassword: Boolean = false,
    val message: String? = null,
    val isLoggedOut: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authApi: AuthApi,
    private val configApi: ConfigApi,
    private val sessionManager: SessionManager,
    private val dataStore: EncryptedDataStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            dataStore.serverUrl.collect { url -> _uiState.value = _uiState.value.copy(serverUrl = url ?: "") }
        }
        viewModelScope.launch {
            dataStore.username.collect { name -> _uiState.value = _uiState.value.copy(username = name ?: "") }
        }
        viewModelScope.launch {
            dataStore.themeMode.collect { mode -> _uiState.value = _uiState.value.copy(themeMode = mode) }
        }
    }

    fun updateOldPassword(pwd: String) { _uiState.value = _uiState.value.copy(oldPassword = pwd) }
    fun updateNewPassword(pwd: String) { _uiState.value = _uiState.value.copy(newPassword = pwd) }

    fun changePassword() {
        val state = _uiState.value
        if (state.oldPassword.isBlank() || state.newPassword.isBlank()) {
            _uiState.value = state.copy(message = "请填写完整")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isChangingPassword = true, message = null)
            try {
                safeApiCall {
                    authApi.changePassword(ChangePasswordRequest(state.oldPassword, state.newPassword))
                }
                _uiState.value = _uiState.value.copy(isChangingPassword = false, message = "密码修改成功", oldPassword = "", newPassword = "")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isChangingPassword = false, message = "修改失败: ${e.message}")
            }
        }
    }

    fun setThemeMode(mode: String) {
        viewModelScope.launch { dataStore.setThemeMode(mode) }
    }

    fun checkHealth() {
        viewModelScope.launch {
            try {
                val health = safeApiCall { configApi.getHealth() }
                _uiState.value = _uiState.value.copy(healthStatus = "${health.status} (v${health.version})")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(healthStatus = "连接失败: ${e.message}")
            }
        }
    }

    fun updateServerUrl(url: String) {
        viewModelScope.launch {
            dataStore.setServerUrl(url)
            sessionManager.setServerUrl(url)
            _uiState.value = _uiState.value.copy(message = "服务器地址已更新，请重新登录")
        }
    }

    fun logout() {
        viewModelScope.launch {
            sessionManager.clearToken()
            dataStore.setToken(null)
            _uiState.value = _uiState.value.copy(isLoggedOut = true)
        }
    }
}
