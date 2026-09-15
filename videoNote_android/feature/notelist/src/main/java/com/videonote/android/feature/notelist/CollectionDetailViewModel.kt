package com.videonote.android.feature.notelist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.CollectionDetailDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CollectionDetailUiState(
    val collection: CollectionDetailDto? = null,
    val summary: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

/**
 * 收藏夹详情 ViewModel：独立于 NoteListViewModel
 * 负责加载收藏夹内容、摘要、添加/移除笔记
 */
@HiltViewModel
class CollectionDetailViewModel @Inject constructor(
    private val repository: NoteListRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CollectionDetailUiState())
    val uiState: StateFlow<CollectionDetailUiState> = _uiState.asStateFlow()

    fun loadCollection(collectionId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val detail = repository.getCollection(collectionId)
                _uiState.value = _uiState.value.copy(collection = detail, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun loadSummary(collectionId: String) {
        viewModelScope.launch {
            try {
                val summaryDto = repository.getSummary(collectionId)
                _uiState.value = _uiState.value.copy(summary = summaryDto.summary.ifBlank { null })
            } catch (_: Exception) { /* 摘要可选，静默失败 */ }
        }
    }

    fun removeNote(collectionId: String, taskId: String) {
        viewModelScope.launch {
            try {
                repository.removeFromCollection(collectionId, taskId)
                _uiState.value.collection?.let { col ->
                    _uiState.value = _uiState.value.copy(
                        collection = col.copy(
                            items = col.effectiveItems.filter { it.task_id != taskId }
                        )
                    )
                }
            } catch (_: Exception) {}
        }
    }
}
