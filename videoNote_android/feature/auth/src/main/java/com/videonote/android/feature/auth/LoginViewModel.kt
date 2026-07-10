package com.videonote.android.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val serverUrl: String = "",
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun updateServerUrl(url: String) { _uiState.value = _uiState.value.copy(serverUrl = url) }
    fun updateUsername(name: String) { _uiState.value = _uiState.value.copy(username = name) }
    fun updatePassword(pwd: String) { _uiState.value = _uiState.value.copy(password = pwd) }

    fun login() {
        val state = _uiState.value
        if (state.serverUrl.isBlank()) {
            _uiState.value = state.copy(error = "请输入服务器地址")
            return
        }
        if (state.username.isBlank()) {
            _uiState.value = state.copy(error = "请输入用户名")
            return
        }
        if (state.password.isBlank()) {
            _uiState.value = state.copy(error = "请输入密码")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val result = authRepository.login(state.serverUrl, state.username, state.password)
            result.fold(
                onSuccess = { _uiState.value = _uiState.value.copy(isLoading = false, loginSuccess = true) },
                onFailure = { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message ?: "登录失败") }
            )
        }
    }
}
