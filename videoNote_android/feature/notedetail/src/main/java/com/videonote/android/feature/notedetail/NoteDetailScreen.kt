@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.notedetail

import android.webkit.WebView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.component.*
import com.videonote.android.core.designsystem.theme.*
import com.videonote.android.core.network.dto.QuickViewResponse
import dev.jeziellago.compose.markdowntext.MarkdownText

@Composable
fun NoteDetailScreen(
    taskId: String,
    onBack: () -> Unit,
    viewModel: NoteDetailViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showExportSheet by remember { mutableStateOf(false) }
    var copyFeedback by remember { mutableStateOf(false) }

    LaunchedEffect(taskId) {
        viewModel.loadNote(taskId)
        viewModel.loadExportConfigs()
    }

    Scaffold(
        containerColor = XaiBg,
        topBar = {
            XaiTopBar(
                title = uiState.note?.title ?: "笔记详情",
                onBack = onBack
            )
        },
        bottomBar = {
            // 底部操作栏：复制 | 导出 | 重做（无圆角分割按钮行）
            Column {
                HorizontalDivider(thickness = 1.dp, color = XaiBorder)
                Row(modifier = Modifier.fillMaxWidth().height(48.dp)) {
                    // 复制
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                uiState.note?.summary?.let {
                                    // TODO: 复制到剪贴板
                                    copyFeedback = true
                                }
                            }
                            .fillMaxHeight(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (copyFeedback) "已复制" else "复制",
                            style = TextStyle(fontSize = 15.sp, fontFamily = FontFamily.Default),
                            color = XaiFg
                        )
                    }
                    VerticalDivider(thickness = 1.dp, color = XaiBorder)
                    // 导出
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { showExportSheet = true }
                            .fillMaxHeight(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("导出", style = TextStyle(fontSize = 15.sp, fontFamily = FontFamily.Default), color = XaiFg)
                    }
                    VerticalDivider(thickness = 1.dp, color = XaiBorder)
                    // 重做
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { /* TODO: 重做 */ }
                            .fillMaxHeight(),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("重做", style = TextStyle(fontSize = 15.sp, fontFamily = FontFamily.Default), color = XaiFg)
                    }
                }
            }
        }
    ) { padding ->
        if (uiState.isLoading) {
            VNLoading(modifier = Modifier.padding(padding))
            return@Scaffold
        }

        uiState.note?.let { note ->
            Column(modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
                // ── 媒体区 ──
                NoteMediaSection(note, imageProxyHelper)

                // ── 笔记信息 ──
                Column(modifier = Modifier.padding(horizontal = 20.dp).padding(top = 16.dp)) {
                    Text(
                        text = note.title,
                        style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Medium, lineHeight = 25.sp),
                        color = XaiFg
                    )
                    Spacer(Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(note.author, style = MaterialTheme.typography.bodySmall, color = XaiFg2)
                        Text("·", color = XaiMeta)
                        note.duration?.let {
                            Text(it, style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace), color = XaiMuted)
                        }
                        Text("·", color = XaiMeta)
                        PlatformDot(platform = note.platform)
                        Text(
                            text = platformName(note.platform),
                            style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace),
                            color = XaiMuted
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                // ── 4 Tab ──
                XaiTabRow(
                    tabs = listOf("摘要", "字幕", "导图", "原文"),
                    selectedIndex = uiState.selectedTab,
                    onSelected = { viewModel.selectTab(it) }
                )

                // ── Tab 内容 ──
                when (uiState.selectedTab) {
                    0 -> note.summary?.let {
                        MarkdownText(
                            markdown = it,
                            modifier = Modifier.padding(20.dp).fillMaxWidth(),
                            style = TextStyle(fontSize = 14.5.sp, color = XaiFg2, lineHeight = 24.sp)
                        )
                    }
                    1 -> note.subtitles?.let {
                        Text(
                            text = it,
                            modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                            style = TextStyle(fontSize = 14.sp, color = XaiFg2, lineHeight = 22.sp)
                        )
                    }
                    2 -> note.outline?.let {
                        MindMapCanvas(
                            markdown = it,
                            modifier = Modifier.fillMaxWidth().height(300.dp)
                        )
                    }
                    3 -> {
                        Column(modifier = Modifier.padding(20.dp)) {
                            note.raw_article?.let {
                                MarkdownText(
                                    markdown = it,
                                    modifier = Modifier.fillMaxWidth(),
                                    style = TextStyle(fontSize = 14.5.sp, color = XaiFg2, lineHeight = 24.sp)
                                )
                            }
                            if (note.screenshots.isNotEmpty()) {
                                Spacer(Modifier.height(16.dp))
                                XaiSectionLabel("关键截图")
                                note.screenshots.forEach { url ->
                                    AsyncImage(
                                        model = imageProxyHelper.getProxyUrl(url, note.platform),
                                        contentDescription = null,
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 6.dp)
                                            .border(1.dp, XaiBorder)
                                    )
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    // ── 导出 BottomSheet ──
    if (showExportSheet) {
        ModalBottomSheet(
            onDismissRequest = { showExportSheet = false },
            containerColor = XaiBg
        ) {
            Column {
                // 手柄
                Box(
                    modifier = Modifier
                        .width(36.dp)
                        .height(3.dp)
                        .background(XaiMuted)
                        .align(Alignment.CenterHorizontally)
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "导出",
                    style = TextStyle(fontSize = 13.sp, fontFamily = FontFamily.Monospace, letterSpacing = 1.sp),
                    color = XaiFg,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp)
                )
                HorizontalDivider(color = XaiBorderSoft)

                val exportItems = buildList {
                    add("复制 Markdown" to { copyFeedback = true })
                    add("导出为 PDF" to { /* TODO */ })
                    add("导出为长图" to { /* TODO */ })
                    if (uiState.siyuanConfig?.enabled == 1) {
                        add("导出到思源笔记" to { viewModel.exportToSiyuan(taskId) })
                    }
                    if (uiState.obsidianConfig?.enabled == 1) {
                        add("导出到 Obsidian" to { viewModel.exportToObsidian(taskId) })
                    }
                }
                exportItems.forEach { (label, _) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showExportSheet = false }
                            .padding(horizontal = 20.dp, vertical = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, style = MaterialTheme.typography.bodyLarge, color = XaiFg)
                    }
                    HorizontalDivider(color = XaiBorderSoft)
                }
                // 取消
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showExportSheet = false }
                        .padding(horizontal = 20.dp, vertical = 16.dp)
                ) {
                    Text("取消", style = MaterialTheme.typography.bodyLarge, color = XaiMuted)
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    // 复制反馈自动消失
    LaunchedEffect(copyFeedback) {
        if (copyFeedback) {
            kotlinx.coroutines.delay(1400)
            copyFeedback = false
        }
    }
}

@Composable
private fun NoteMediaSection(note: QuickViewResponse, imageProxyHelper: ImageProxyHelper) {
    var playerVisible by remember { mutableStateOf(false) }
    val videoUrl = note.video_url
    Box(modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)) {
        // 封面图
        AsyncImage(
            model = imageProxyHelper.getProxyUrl(note.cover_url, note.platform),
            contentDescription = null,
            modifier = Modifier.fillMaxSize().background(XaiSurfaceWarm)
        )
        // 播放按钮 FAB（圆形白色）
        if (!playerVisible && videoUrl != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.Center)
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(XaiAccent)
                    .clickable { playerVisible = true },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.PlayArrow,
                    contentDescription = "播放",
                    tint = XaiAccentOn,
                    modifier = Modifier.size(26.dp)
                )
            }
        }
        // 播放器
        if (playerVisible && videoUrl != null) {
            when (note.platform) {
                "local", "local_audio" -> {
                    AndroidView(factory = { ctx ->
                        androidx.media3.ui.PlayerView(ctx).apply {
                            player = androidx.media3.exoplayer.ExoPlayer.Builder(ctx).build().apply {
                                setMediaItem(androidx.media3.common.MediaItem.fromUri(videoUrl))
                                prepare()
                                playWhenReady = true
                            }
                        }
                    }, modifier = Modifier.fillMaxSize())
                }
                else -> {
                    AndroidView(factory = { ctx ->
                        WebView(ctx).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            settings.userAgentString = "Mozilla/5.0 (Linux; Android 12) Mobile"
                            loadUrl(videoUrl)
                        }
                    }, modifier = Modifier.fillMaxSize())
                }
            }
        }
    }
}
