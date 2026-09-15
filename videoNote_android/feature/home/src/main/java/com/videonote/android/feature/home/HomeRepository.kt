package com.videonote.android.feature.home

import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import okhttp3.MultipartBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HomeRepository @Inject constructor(
    private val noteApi: NoteApi
) {
    suspend fun generateNote(
        videoUrl: String?,
        platform: String,
        smartMode: Boolean,
        style: String,
        modelName: String = "auto",
        providerId: String = "0",
        filePath: String? = null
    ): GenerateNoteResponse {
        return safeApiCall {
            noteApi.generateNote(
                GenerateNoteRequest(
                    video_url = videoUrl,
                    platform = platform,
                    smart_mode = smartMode,
                    model_name = if (!smartMode) modelName else "auto",
                    provider_id = if (!smartMode) providerId else "0",
                    style = style,
                    quality = "medium",
                    output_language = "zh",
                    format = emptyList(),
                    screenshot = true,
                    link = false,
                    file_path = filePath
                )
            )
        }
    }

    suspend fun getTaskStatus(taskId: String): TaskStatusResponse {
        return safeApiCall { noteApi.getTaskStatus(taskId) }
    }

    suspend fun checkNoteAvailability(videoUrl: String, platform: String): CheckNoteResponse {
        return safeApiCall { noteApi.checkNoteAvailability(CheckNoteRequest(videoUrl, platform)) }
    }

    suspend fun uploadFile(part: MultipartBody.Part): UploadResponse {
        return safeApiCall { noteApi.uploadFile(part) }
    }

    suspend fun cancelTask(taskId: String) {
        safeApiCall { noteApi.cancelTask(TaskIdRequest(taskId)) }
    }
}
