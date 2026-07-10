package com.videonote.android.feature.notelist

import com.videonote.android.core.network.api.CollectionApi
import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteListRepository @Inject constructor(
    private val noteApi: NoteApi,
    private val collectionApi: CollectionApi
) {
    suspend fun getTasks(page: Int = 1, platform: String? = null, search: String? = null): TaskListResponse {
        return safeApiCall { noteApi.getTasks(page = page, platform = platform, search = search) }
    }

    suspend fun deleteTask(taskId: String) {
        safeApiCall { noteApi.deleteTask(TaskIdRequest(taskId)) }
    }

    // 收藏夹相关
    suspend fun getCollections(): List<CollectionDto> {
        return safeApiCall { collectionApi.getCollections() }
    }

    suspend fun createCollection(name: String, description: String = ""): CollectionDto {
        return safeApiCall { collectionApi.createCollection(CreateCollectionRequest(name, description)) }
    }

    suspend fun getCollection(id: String, page: Int = 1): CollectionDetailDto {
        return safeApiCall { collectionApi.getCollection(id, page = page) }
    }

    suspend fun deleteCollection(id: String) {
        safeApiCall { collectionApi.deleteCollection(id) }
    }

    suspend fun addToCollection(collectionId: String, taskId: String) {
        safeApiCall { collectionApi.addToCollection(collectionId, AddToCollectionRequest(taskId)) }
    }

    suspend fun removeFromCollection(collectionId: String, taskId: String) {
        safeApiCall { collectionApi.removeFromCollection(collectionId, taskId) }
    }

    suspend fun getTaskMap(taskIds: List<String>): TaskMapResponse {
        return safeApiCall { collectionApi.getTaskMap(taskIds.joinToString(",")) }
    }

    suspend fun generateSummary(collectionId: String) {
        safeApiCall { collectionApi.generateSummary(collectionId) }
    }

    suspend fun getSummary(collectionId: String): CollectionSummaryDto {
        return safeApiCall { collectionApi.getSummary(collectionId) }
    }
}
