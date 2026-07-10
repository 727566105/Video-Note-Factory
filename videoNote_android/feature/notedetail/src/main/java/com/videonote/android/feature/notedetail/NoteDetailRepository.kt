package com.videonote.android.feature.notedetail

import com.videonote.android.core.network.api.ConfigApi
import com.videonote.android.core.network.api.ExportApi
import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import com.videonote.android.core.network.safeStreamCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteDetailRepository @Inject constructor(
    private val noteApi: NoteApi,
    private val exportApi: ExportApi,
    private val configApi: ConfigApi
) {
    suspend fun getNoteDetail(taskId: String): QuickViewResponse {
        return safeApiCall { noteApi.getQuickView(taskId) }
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
