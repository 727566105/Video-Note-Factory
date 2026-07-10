package com.videonote.android.feature.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.CreateSubscriptionRequest
import com.videonote.android.core.network.dto.FeedItem
import com.videonote.android.core.network.dto.SubscriptionDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FeedUiState(
    val items: List<FeedItem> = emptyList(),
    val subscriptions: List<SubscriptionDto> = emptyList(),
    val unreadCount: Int = 0,
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedItem: FeedItem? = null,
    val page: Int = 1,
    val hasMore: Boolean = true
)

@HiltViewModel
class FeedViewModel @Inject constructor(
    private val repository: FeedRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    init {
        loadFeed()
        loadSubscriptions()
        loadUnreadCount()
    }

    fun loadFeed(refresh: Boolean = false) {
        if (refresh) _uiState.value = _uiState.value.copy(page = 1, items = emptyList(), hasMore = true)
        val state = _uiState.value
        if (!state.hasMore && !refresh) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = repository.getFeed(page = state.page)
                _uiState.value = _uiState.value.copy(
                    items = if (refresh) response.items else state.items + response.items,
                    isLoading = false,
                    page = state.page + 1,
                    hasMore = response.items.size >= 20
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun loadSubscriptions() {
        viewModelScope.launch {
            try { _uiState.value = _uiState.value.copy(subscriptions = repository.getSubscriptions()) }
            catch (e: Exception) { /* 静默 */ }
        }
    }

    fun loadUnreadCount() {
        viewModelScope.launch {
            try { _uiState.value = _uiState.value.copy(unreadCount = repository.getUnreadCount().count) }
            catch (_: Exception) {}
        }
    }

    fun selectItem(item: FeedItem) { _uiState.value = _uiState.value.copy(selectedItem = item) }
    fun clearSelectedItem() { _uiState.value = _uiState.value.copy(selectedItem = null) }

    fun markRead(itemId: String) {
        viewModelScope.launch {
            try {
                repository.markRead(itemId)
                _uiState.value = _uiState.value.copy(
                    items = _uiState.value.items.map { if (it.id == itemId) it.copy(is_read = true) else it },
                    unreadCount = (_uiState.value.unreadCount - 1).coerceAtLeast(0)
                )
            } catch (_: Exception) {}
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            try {
                repository.markAllRead()
                _uiState.value = _uiState.value.copy(
                    items = _uiState.value.items.map { it.copy(is_read = true) },
                    unreadCount = 0
                )
            } catch (_: Exception) {}
        }
    }

    fun refreshFeed() {
        viewModelScope.launch {
            try {
                repository.refresh()
                loadFeed(refresh = true)
                loadUnreadCount()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun generateNoteFromFeed(itemId: String) {
        viewModelScope.launch {
            try {
                val response = repository.generateNoteFromFeed(itemId)
                // 通知 UI 导航到任务状态页或笔记详情
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun addSubscription(url: String) {
        viewModelScope.launch {
            try {
                val parsed = repository.parseChannelUrl(url)
                repository.createSubscription(CreateSubscriptionRequest(url, parsed.platform))
                loadSubscriptions()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun deleteSubscription(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteSubscription(id)
                _uiState.value = _uiState.value.copy(
                    subscriptions = _uiState.value.subscriptions.filter { it.id != id }
                )
            } catch (_: Exception) {}
        }
    }
}
