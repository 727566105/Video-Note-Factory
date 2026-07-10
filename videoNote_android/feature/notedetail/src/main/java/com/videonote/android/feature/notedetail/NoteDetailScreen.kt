@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.notedetail

import android.webkit.WebView
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.component.VNLoading
import com.videonote.android.core.network.dto.QuickViewResponse
import dev.jeziellago.compose.markdowntext.MarkdownText

@Composable
fun NoteDetailScreen(
    taskId: String,
    onBack: () -> Unit,
    viewModel: NoteDetailViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()  // 通过 Hilt 注入
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(taskId) {
        viewModel.loadNote(taskId)
        viewModel.loadExportConfigs()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.note?.title ?: "笔记详情") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null) } },
                actions = { IconButton(onClick = { /* 更多操作 */ }) { Icon(Icons.Default.MoreVert, null) } }
            )
        },
        bottomBar = {
            // 底部操作栏：复制 | 导出 | 重做
            BottomAppBar {
                TextButton(onClick = { /* 复制 Markdown */ }) { Text("复制") }
                TextButton(onClick = { /* 显示导出 BottomSheet */ }) { Text("导出") }
                TextButton(onClick = { /* 重做 */ }) { Text("重做") }
            }
        }
    ) { padding ->
        if (uiState.isLoading) {
            VNLoading(modifier = Modifier.padding(padding))
            return@Scaffold
        }

        uiState.note?.let { note ->
            Column(modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
                // 封面图 / 视频播放区
                NoteMediaSection(note, imageProxyHelper)

                // 视频信息
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(note.title, style = MaterialTheme.typography.titleLarge)
                    Text(note.author, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                    Row {
                        Text(note.platform, style = MaterialTheme.typography.labelSmall)
                        note.duration?.let { Text(" · $it", style = MaterialTheme.typography.labelSmall) }
                    }
                }

                // 4 Tab
                TabRow(selectedTabIndex = uiState.selectedTab) {
                    listOf("摘要", "字幕", "导图", "原文").forEachIndexed { index, label ->
                        Tab(selected = uiState.selectedTab == index, onClick = { viewModel.selectTab(index) }, text = { Text(label) })
                    }
                }

                when (uiState.selectedTab) {
                    // 摘要：Markdown 渲染（使用 compose-markdown 库）
                    0 -> note.summary?.let {
                        MarkdownText(
                            markdown = it,
                            modifier = Modifier.padding(16.dp).fillMaxWidth()
                        )
                    }
                    // 字幕：带时间轴的纯文本
                    1 -> note.subtitles?.let { Text(it, modifier = Modifier.padding(16.dp)) }
                    // 导图：Kotlin Canvas 渲染树形图
                    2 -> note.outline?.let {
                        MindMapCanvas(markdown = it, modifier = Modifier.fillMaxWidth().height(300.dp))
                    }
                    // 原文：分段文本 + 截图
                    3 -> {
                        Column(modifier = Modifier.padding(16.dp)) {
                            note.raw_article?.let { MarkdownText(markdown = it, modifier = Modifier.fillMaxWidth()) }
                            if (note.screenshots.isNotEmpty()) {
                                Spacer(Modifier.height(16.dp))
                                note.screenshots.forEach { screenshotUrl ->
                                    AsyncImage(
                                        model = imageProxyHelper.getProxyUrl(screenshotUrl, note.platform),
                                        contentDescription = null,
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 笔记媒体区：封面图始终显示，点击播放按钮后懒加载 WebView/播放器
 * - B站/抖音：WebView 加载移动端页面
 * - YouTube：WebView 嵌入播放器（后续可替换为官方 YouTube Player API）
 * - 本地文件：ExoPlayer
 */
@Composable
private fun NoteMediaSection(note: QuickViewResponse, imageProxyHelper: ImageProxyHelper) {
    var playerVisible by remember { mutableStateOf(false) }
    val videoUrl = note.video_url
    Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
        // 封面图（通过代理加载）
        AsyncImage(
            model = imageProxyHelper.getProxyUrl(note.cover_url, note.platform),
            contentDescription = null,
            modifier = Modifier.fillMaxSize()
        )
        // 播放按钮覆盖层（懒加载：点击后才初始化播放器）
        if (!playerVisible && videoUrl != null) {
            FloatingActionButton(
                onClick = { playerVisible = true },
                modifier = Modifier.align(Alignment.Center)
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = "播放")
            }
        }
        // 播放器（用户点击后懒加载）
        if (playerVisible && videoUrl != null) {
            when (note.platform) {
                "local", "local_audio" -> {
                    // 本地文件用 ExoPlayer
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
                    // B站/抖音/YouTube：WebView 加载移动端页面
                    AndroidView(factory = { ctx ->
                        WebView(ctx).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            // 设置合理的 User-Agent（移动端）
                            settings.userAgentString = "Mozilla/5.0 (Linux; Android 12) Mobile"
                            loadUrl(videoUrl)
                        }
                    }, modifier = Modifier.fillMaxSize())
                }
            }
        }
    }
}
