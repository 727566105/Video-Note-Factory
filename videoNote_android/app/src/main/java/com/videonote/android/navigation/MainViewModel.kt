package com.videonote.android.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.common.EncryptedDataStore
import com.videonote.android.core.network.SessionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 主 ViewModel：管理全局状态（token、主题），在 App 启动时恢复会话。
 */
@HiltViewModel
class MainViewModel @Inject constructor(
    private val dataStore: EncryptedDataStore,
    private val sessionRepository: SessionRepository
) : ViewModel() {

    val token: StateFlow<String?> = dataStore.token.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), null
    )

    val themeMode: StateFlow<String> = dataStore.themeMode.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), "system"
    )

    init {
        // 启动时恢复 token 和 serverUrl 到 SessionManager
        viewModelScope.launch { sessionRepository.restoreSession() }
    }
}
