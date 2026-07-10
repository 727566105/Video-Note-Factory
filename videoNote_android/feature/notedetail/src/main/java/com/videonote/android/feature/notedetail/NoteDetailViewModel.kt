package com.videonote.android.feature.notedetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.ObsidianConfigDto
import com.videonote.android.core.network.dto.QuickViewResponse
import com.videonote.android.core.network.dto.SiyuanConfigDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NoteDetailUiState(
    val note: QuickViewResponse? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedTab: Int = 0, // 0=摘要 1=字幕 2=导图 3=原文
    val siyuanConfig: SiyuanConfigDto? = null,
    val obsidianConfig: ObsidianConfigDto? = null,
    val exportMessage: String? = null
)

@HiltViewModel
class NoteDetailViewModel @Inject constructor(
    private val repository: NoteDetailRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NoteDetailUiState())
    val uiState: StateFlow<NoteDetailUiState> = _uiState.asStateFlow()

    fun loadNote(taskId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val note = repository.getNoteDetail(taskId)
                _uiState.value = _uiState.value.copy(note = note, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun selectTab(tab: Int) { _uiState.value = _uiState.value.copy(selectedTab = tab) }

    fun loadExportConfigs() {
        viewModelScope.launch {
            try {
                val siyuan = repository.getSiyuanConfig()
                val obsidian = repository.getObsidianConfig()
                _uiState.value = _uiState.value.copy(siyuanConfig = siyuan, obsidianConfig = obsidian)
            } catch (_: Exception) {}
        }
    }

    fun exportToSiyuan(taskId: String) {
        viewModelScope.launch {
            try {
                repository.exportToSiyuan(taskId)
                _uiState.value = _uiState.value.copy(exportMessage = "已导出到思源笔记")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(exportMessage = "导出失败: ${e.message}")
            }
        }
    }

    fun exportToObsidian(taskId: String) {
        viewModelScope.launch {
            try {
                repository.exportToObsidian(taskId)
                _uiState.value = _uiState.value.copy(exportMessage = "已导出到 Obsidian")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(exportMessage = "导出失败: ${e.message}")
            }
        }
    }
}
