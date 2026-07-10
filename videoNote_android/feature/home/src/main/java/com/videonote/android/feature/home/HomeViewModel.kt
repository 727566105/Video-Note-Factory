package com.videonote.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.common.ClipboardHelper
import com.videonote.android.core.common.PlatformDetector
import com.videonote.android.core.network.dto.GenerateNoteResponse
import com.videonote.android.core.network.dto.TaskStatusResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val urlInput: String = "",
    val detectedPlatform: String? = null,
    val clipboardConsumed: Boolean = false,
    val smartMode: Boolean = true,
    val style: String = "detailed",
    val selectedModelName: String = "auto",
    val selectedProviderId: String = "0",
    val isGenerating: Boolean = false,
    val currentTaskId: String? = null,
    val taskStatus: TaskStatusResponse? = null,
    val error: String? = null,
    val noteReused: Boolean = false,
    val reuseType: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val homeRepository: HomeRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null

    fun updateUrl(url: String) {
        val platform = PlatformDetector.detect(url)
        _uiState.value = _uiState.value.copy(urlInput = url, detectedPlatform = platform)
    }

    fun clearUrl() {
        _uiState.value = _uiState.value.copy(urlInput = "", detectedPlatform = null)
    }

    /**
     * 剪贴板自动填入：仅在输入框为空 + 未消费过时触发
     * 由 Composable 层传入 ClipboardManager 提取的文本，ViewModel 负责判断和标记
     *
     * 设计要求（零步操作）：
     * - 输入框为空 + 剪贴板有 URL -> 直接填入
     * - 输入框已有内容 -> 不覆盖
     * - clipboardConsumed 确保只自动填入一次
     */
    fun tryAutoFillFromClipboard(clipboardText: String?) {
        val state = _uiState.value
        if (state.urlInput.isNotEmpty() || state.clipboardConsumed || clipboardText.isNullOrBlank()) {
            return
        }
        // 使用 ClipboardHelper 从文本中提取 URL（支持分享文本、短链等）
        val url = extractUrlFromText(clipboardText)
        if (url != null) {
            val platform = PlatformDetector.detect(url)
            _uiState.value = state.copy(
                urlInput = url,
                detectedPlatform = platform,
                clipboardConsumed = true
            )
        }
    }

    /**
     * 从纯文本中提取视频 URL
     * 处理：纯 URL、分享文本中嵌入的 URL、短链
     */
    private fun extractUrlFromText(text: String): String? {
        val trimmed = text.trim()
        // 直接是 URL
        if (PlatformDetector.isVideoUrl(trimmed)) return trimmed
        // 从分享文本中提取 URL（如抖音分享文本："xxx https://v.douyin.com/xxx 复制打开抖音"）
        val urlRegex = Regex("""https?://[^\s<>"']+""")
        val match = urlRegex.find(trimmed)
        if (match != null && PlatformDetector.isVideoUrl(match.value)) return match.value
        // 短链检测（不带 http 前缀的短链）
        if (trimmed.contains("b23.tv") || trimmed.contains("xhslink.com") ||
            trimmed.contains("v.douyin.com") || trimmed.contains("v.kuaishou.com")) {
            return "https://$trimmed".let { if (PlatformDetector.isVideoUrl(it)) it else null }
        }
        return null
    }

    /**
     * 标记剪贴板已消费（Composable 在成功自动填入后调用）
     */
    fun markClipboardConsumed() {
        _uiState.value = _uiState.value.copy(clipboardConsumed = true)
    }

    fun setSmartMode(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(smartMode = enabled)
    }

    fun setStyle(style: String) {
        _uiState.value = _uiState.value.copy(style = style)
    }

    fun generateNote() {
        val state = _uiState.value
        val platform = state.detectedPlatform ?: run {
            _uiState.value = state.copy(error = "无法识别视频平台")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isGenerating = true, error = null)
            try {
                val response = homeRepository.generateNote(
                    videoUrl = state.urlInput.ifBlank { null },
                    platform = platform,
                    smartMode = state.smartMode,
                    style = state.style,
                    modelName = state.selectedModelName,
                    providerId = state.selectedProviderId
                )
                _uiState.value = _uiState.value.copy(
                    isGenerating = false,
                    currentTaskId = response.task_id,
                    noteReused = response.reused,
                    reuseType = response.reuse_type
                )
                // 开始轮询任务状态
                startPolling(response.task_id)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isGenerating = false, error = e.message)
            }
        }
    }

    private fun startPolling(taskId: String) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(3000) // 3 秒轮询
                try {
                    val status = homeRepository.getTaskStatus(taskId)
                    _uiState.value = _uiState.value.copy(taskStatus = status)
                    // 终止条件：SUCCESS, FAILED, CANCELLED
                    if (status.status in listOf("SUCCESS", "FAILED", "CANCELLED")) break
                } catch (e: Exception) {
                    _uiState.value = _uiState.value.copy(error = e.message)
                    break
                }
            }
        }
    }

    fun cancelCurrentTask() {
        val taskId = _uiState.value.currentTaskId ?: return
        viewModelScope.launch {
            try { homeRepository.cancelTask(taskId) } catch (_: Exception) {}
            pollingJob?.cancel()
            _uiState.value = _uiState.value.copy(taskStatus = null, currentTaskId = null)
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
