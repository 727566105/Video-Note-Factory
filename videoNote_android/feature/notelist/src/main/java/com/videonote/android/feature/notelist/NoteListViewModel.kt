package com.videonote.android.feature.notelist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.CollectionDto
import com.videonote.android.core.network.dto.TaskItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NoteListUiState(
    val selectedTab: Int = 0, // 0=全部笔记, 1=收藏夹
    val tasks: List<TaskItem> = emptyList(),
    val collections: List<CollectionDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedPlatform: String? = null,
    val searchQuery: String = "",
    val page: Int = 1,
    val hasMore: Boolean = true
)

@HiltViewModel
class NoteListViewModel @Inject constructor(
    private val repository: NoteListRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NoteListUiState())
    val uiState: StateFlow<NoteListUiState> = _uiState.asStateFlow()

    init { loadTasks() }

    fun loadTasks(refresh: Boolean = false) {
        if (refresh) {
            _uiState.value = _uiState.value.copy(page = 1, tasks = emptyList(), hasMore = true)
        }
        val state = _uiState.value
        if (!state.hasMore && !refresh) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = repository.getTasks(
                    page = state.page,
                    platform = state.selectedPlatform,
                    search = state.searchQuery.ifBlank { null }
                )
                _uiState.value = _uiState.value.copy(
                    tasks = if (refresh) response.tasks else state.tasks + response.tasks,
                    isLoading = false,
                    page = state.page + 1,
                    hasMore = response.tasks.size >= 20
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun selectPlatform(platform: String?) {
        _uiState.value = _uiState.value.copy(selectedPlatform = platform)
        loadTasks(refresh = true)
    }

    fun updateSearch(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun search() { loadTasks(refresh = true) }

    fun deleteTask(taskId: String) {
        viewModelScope.launch {
            try {
                repository.deleteTask(taskId)
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.filter { it.task_id != taskId }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun loadCollections() {
        viewModelScope.launch {
            try {
                val collections = repository.getCollections()
                _uiState.value = _uiState.value.copy(collections = collections)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun selectTab(tab: Int) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
        if (tab == 1 && _uiState.value.collections.isEmpty()) loadCollections()
    }
}
