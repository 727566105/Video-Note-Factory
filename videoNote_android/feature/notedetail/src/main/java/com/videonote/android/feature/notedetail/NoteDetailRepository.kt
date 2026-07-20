package com.videonote.android.feature.notedetail

import com.videonote.android.core.network.api.ConfigApi
import com.videonote.android.core.network.api.ExportApi
import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import com.videonote.android.core.network.safeStreamCall
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteDetailRepository @Inject constructor(
    private val noteApi: NoteApi,
    private val exportApi: ExportApi,
    private val configApi: ConfigApi
) {
    /**
     * 加载笔记详情。
     *
     * 后端 /api/quick_view/{taskId} 只返回 task_id/title/author/markdown/model_name 五个字段，
     * **不返回** cover_url/platform/video_url/duration/content_type 等元数据。
     * 因此并发拉 /api/tasks 列表找到该 task 的元数据并合并到 QuickViewResponse，
     * 否则 UI 显示不出封面图、平台色点、视频时长、内容类型徽章。
     *
     * 如果在 tasks 列表里找不到（被删除或分页靠后），仍返回 quick_view 内容，元数据字段保持默认空值。
     */
    suspend fun getNoteDetail(taskId: String): QuickViewResponse = coroutineScope {
        val quickViewDeferred = async { safeApiCall { noteApi.getQuickView(taskId) } }
        // 后端 /api/tasks 默认按 created_at 倒序，最新的在前。逐页拉找目标 task，最多拉 5 页（100 条）。
        val tasksDeferred = async { findTaskInList(taskId) }

        val quickView = quickViewDeferred.await()
        val task = tasksDeferred.await()

        if (task != null) {
            // 合并 tasks 列表里的元数据到 quick_view 结果
            quickView.copy(
                cover_url = task.cover_url,
                platform = task.platform,
                video_url = task.video_url,
                video_id = task.video_id,
                duration = task.duration,
                created_at = task.created_at.ifBlank { quickView.created_at },
                author = quickView.author.ifBlank { task.author },
                author_id = task.author_id,
                author_name = task.author_name,
                content_type = task.content_type
            )
        } else {
            quickView
        }
    }

    /**
     * 在 /api/tasks 列表中查找指定 task_id 的元数据，最多拉 5 页（100 条）。
     * 找到立即返回，找不到返回 null（不抛异常，让调用方继续用 quick_view 数据）。
     */
    private suspend fun findTaskInList(taskId: String, maxPages: Int = 5): TaskItem? {
        repeat(maxPages) { pageIdx ->
            val page = pageIdx + 1
            try {
                val response = safeApiCall { noteApi.getTasks(page = page, pageSize = 20) }
                val found = response.tasks.firstOrNull { it.task_id == taskId }
                if (found != null) return found
                // 没拉满一页说明没更多数据，提前退出
                if (response.tasks.size < 20) return null
            } catch (_: Exception) {
                return null
            }
        }
        return null
    }

    /**
     * 加载笔记的媒体列表（图片/实况视频）。
     * 对应后端 GET /api/note_media/{taskId}。
     * - video 类型：images/live_photos 都空
     * - article 类型：images 有，live_photos 空
     * - live_photo 类型：images 和 live_photos 都有，按 index 配对
     */
    suspend fun getNoteMedia(taskId: String): NoteMediaResponse {
        return safeApiCall { noteApi.getNoteMedia(taskId) }
    }

    suspend fun updateTags(taskId: String, tags: List<String>) {
        safeApiCall { noteApi.updateTags(taskId, TagsRequest(tags)) }
    }

    // 导出相关：流式接口使用 safeStreamCall 包装，调用方负责写入文件
    suspend fun exportPdf(taskId: String): okhttp3.ResponseBody = safeStreamCall { exportApi.exportPdf(taskId) }
    suspend fun exportImage(taskId: String): okhttp3.ResponseBody = safeStreamCall { exportApi.exportImage(taskId) }
    suspend fun exportToSiyuan(taskId: String) { safeApiCall { exportApi.exportToSiyuan(taskId) } }
    suspend fun exportToObsidian(taskId: String) {
        safeApiCall { exportApi.exportToObsidian(taskId, ObsidianExportRequest()) }
    }

    // 导出配置检查（动态菜单）
    suspend fun getSiyuanConfig(): SiyuanConfigDto = safeApiCall { configApi.getSiyuanConfig() }
    suspend fun getObsidianConfig(): ObsidianConfigDto = safeApiCall { configApi.getObsidianConfig() }
}
