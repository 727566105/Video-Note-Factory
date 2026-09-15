package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class ObsidianExportRequest(
    val content_sections: List<String> = listOf("summary", "raw_article", "subtitles", "outline", "screenshots")
)
