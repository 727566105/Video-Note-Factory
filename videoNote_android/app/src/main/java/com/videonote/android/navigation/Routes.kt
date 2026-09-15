package com.videonote.android.navigation

import kotlinx.serialization.Serializable

// 底部导航 Tab 路由
@Serializable sealed class Route {
    @Serializable data object Login : Route()
    @Serializable data object Home : Route()
    @Serializable data object Notes : Route()
    @Serializable data object Feed : Route()
    @Serializable data object Settings : Route()
    @Serializable data class NoteDetail(val taskId: String) : Route()
    @Serializable data class CollectionDetail(val collectionId: String) : Route()
}
