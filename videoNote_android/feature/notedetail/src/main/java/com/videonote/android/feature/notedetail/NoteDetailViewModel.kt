package com.videonote.android.feature.notedetail

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.common.media.LivePhotoSaveResult
import com.videonote.android.core.common.media.MediaDownloader
import com.videonote.android.core.network.dto.NoteMediaResponse
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
    val media: NoteMediaResponse? = null,
    val isLoading: Boolean = false,
    val isLoadingMedia: Boolean = false,
    val error: String? = null,
    val selectedTab: Int = 0, // 0=摘要 1=字幕 2=导图 3=原文
    val siyuanConfig: SiyuanConfigDto? = null,
    val obsidianConfig: ObsidianConfigDto? = null,
    val exportMessage: String? = null,
    // 下载状态
    val downloadProgress: Map<String, Float> = emptyMap(),  // key=url or tag
    val downloadMessage: String? = null,
    val isDownloading: Boolean = false
)

@HiltViewModel
class NoteDetailViewModel @Inject constructor(
    private val repository: NoteDetailRepository,
    private val mediaDownloader: MediaDownloader,
    private val application: Application
) : ViewModel() {

    private val _uiState = MutableStateFlow(NoteDetailUiState())
    val uiState: StateFlow<NoteDetailUiState> = _uiState.asStateFlow()

    fun loadNote(taskId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val note = repository.getNoteDetail(taskId)
                _uiState.value = _uiState.value.copy(note = note, isLoading = false)
                // 加载笔记后并发拉媒体列表（article/live_photo 才有内容）
                loadMedia(taskId)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun loadMedia(taskId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingMedia = true)
            try {
                val media = repository.getNoteMedia(taskId)
                _uiState.value = _uiState.value.copy(media = media, isLoadingMedia = false)
            } catch (_: Exception) {
                // 媒体加载失败不阻塞主流程
                _uiState.value = _uiState.value.copy(isLoadingMedia = false)
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

    fun clearMessage() {
        _uiState.value = _uiState.value.copy(exportMessage = null, downloadMessage = null)
    }

    // ============ 媒体下载 ============

    /**
     * 下载视频到相册。
     * @param videoFileUrl 视频文件 URL（可以是 /api/video_file/... 相对路径，也可以是绝对 URL）
     * @param filename 文件名（如 "note_xxx.mp4"）
     */
    fun downloadVideo(videoFileUrl: String, filename: String) {
        if (_uiState.value.downloadProgress.containsKey(filename)) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(downloadMessage = null)
            updateProgress(filename, 0f)
            try {
                val file = mediaDownloader.downloadToCache(videoFileUrl, filename) { progress ->
                    updateProgress(filename, progress)
                }.getOrThrow()
                val uri = mediaDownloader.saveVideoToGallery(application, file, filename).getOrThrow()
                file.delete()
                _uiState.value = _uiState.value.copy(
                    downloadMessage = "视频已保存到相册",
                    downloadProgress = _uiState.value.downloadProgress - filename
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    downloadMessage = "下载失败: ${e.message}",
                    downloadProgress = _uiState.value.downloadProgress - filename
                )
            }
        }
    }

    /**
     * 下载图片到相册。
     */
    fun downloadImage(imageUrl: String, filename: String) {
        if (_uiState.value.downloadProgress.containsKey(filename)) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(downloadMessage = null)
            updateProgress(filename, 0f)
            try {
                val file = mediaDownloader.downloadToCache(imageUrl, filename) { progress ->
                    updateProgress(filename, progress)
                }.getOrThrow()
                val uri = mediaDownloader.saveImageToGallery(application, file, filename).getOrThrow()
                file.delete()
                _uiState.value = _uiState.value.copy(
                    downloadMessage = "图片已保存到相册",
                    downloadProgress = _uiState.value.downloadProgress - filename
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    downloadMessage = "下载失败: ${e.message}",
                    downloadProgress = _uiState.value.downloadProgress - filename
                )
            }
        }
    }

    /**
     * 下载 Live Photo：串行下载图片和实况视频，合成 MotionPhoto 写入相册。
     *
     * @param imageUrl 静态图 URL
     * @param videoUrl 实况视频 URL
     * @param baseFilename 文件名（不含扩展名，如 "live_photo_1"）
     */
    fun downloadLivePhoto(imageUrl: String, videoUrl: String, baseFilename: String) {
        if (_uiState.value.downloadProgress.containsKey(baseFilename)) return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(downloadMessage = null)
            updateProgress(baseFilename, 0f)
            try {
                val imgName = mediaDownloader.genFilename("img_$baseFilename", "jpg")
                val vidName = mediaDownloader.genFilename("vid_$baseFilename", "mp4")

                // 串行下载图片和视频
                val imgFile = mediaDownloader.downloadToCache(imageUrl, imgName) { p ->
                    updateProgress(baseFilename, p * 0.5f)
                }.getOrThrow()
                val vidFile = mediaDownloader.downloadToCache(videoUrl, vidName) { p ->
                    updateProgress(baseFilename, 0.5f + p * 0.5f)
                }.getOrThrow()

                val result = mediaDownloader.saveLivePhoto(application, imgFile, vidFile, baseFilename).getOrThrow()
                imgFile.delete()
                vidFile.delete()

                val msg = if (result.motionPhotoUri != null) {
                    "实况图已保存到相册（MotionPhoto 格式）"
                } else {
                    "实况图已保存到相册（图片+视频两份）"
                }
                _uiState.value = _uiState.value.copy(
                    downloadMessage = msg,
                    downloadProgress = _uiState.value.downloadProgress - baseFilename
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    downloadMessage = "下载失败: ${e.message}",
                    downloadProgress = _uiState.value.downloadProgress - baseFilename
                )
            }
        }
    }

    private fun updateProgress(key: String, progress: Float) {
        _uiState.value = _uiState.value.copy(
            downloadProgress = _uiState.value.downloadProgress + (key to progress)
        )
    }
}
