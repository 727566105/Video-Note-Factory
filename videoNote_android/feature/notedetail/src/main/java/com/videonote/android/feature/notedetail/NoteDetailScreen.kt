@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.notedetail

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.webkit.WebView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.common.rememberImageProxyHelper
import com.videonote.android.core.designsystem.component.*
import com.videonote.android.core.designsystem.theme.*
import com.videonote.android.core.network.dto.LivePhotoItem
import com.videonote.android.core.network.dto.NoteMediaResponse
import com.videonote.android.core.network.dto.QuickViewResponse
import com.videonote.android.core.network.dto.formatDuration
import dev.jeziellago.compose.markdowntext.MarkdownText

@Composable
fun NoteDetailScreen(
    taskId: String,
    onBack: () -> Unit,
    viewModel: NoteDetailViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = rememberImageProxyHelper()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var showExportSheet by remember { mutableStateOf(false) }
    var copyFeedback by remember { mutableStateOf(false) }

    // 权限请求：下载时申请 READ_MEDIA_IMAGES / READ_MEDIA_VIDEO / POST_NOTIFICATIONS
    // 用户授权后自动执行缓存的下载动作
    val lastDownloadAction = remember { mutableStateOf<(() -> Unit)?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        // 权限申请完成后执行缓存的下载动作
        lastDownloadAction.value?.let { action ->
            if (result.values.all { it }) action.invoke()
            lastDownloadAction.value = null
        }
    }

    fun requestMediaPermissionsThen(action: () -> Unit) {
        // 只申请 POST_NOTIFICATIONS（API 33+），写入 MediaStore 不需要 READ_MEDIA_* 权限
        // READ_MEDIA_IMAGES / READ_MEDIA_VIDEO 是读取相册用的，我们不读只写
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val perm = Manifest.permission.POST_NOTIFICATIONS
            if (context.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED) {
                action()
            } else {
                lastDownloadAction.value = action
                permissionLauncher.launch(arrayOf(perm))
            }
        } else {
            // Android 12 以下无需运行时申请
            action()
        }
    }

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
            // 底部操作栏：复制 | 导出 | 保存
            Column {
                HorizontalDivider(thickness = 1.dp, color = XaiBorder)
                Row(modifier = Modifier.fillMaxWidth().height(48.dp)) {
                    // 复制
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                uiState.note?.markdown?.let { md ->
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    clipboard.setPrimaryClip(ClipData.newPlainText("note", md))
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
                    // 保存（原"重做"按钮改造）
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clickable {
                                val note = uiState.note
                                val media = uiState.media
                                if (note != null) {
                                    requestMediaPermissionsThen {
                                        when (note.content_type) {
                                            "video" -> {
                                                // 下载视频：拼 /api/video_file
                                                note.author_id?.let { aid ->
                                                    note.video_id?.let { vid ->
                                                        val url = "/api/video_file/${note.platform}/$aid/$vid"
                                                        val filename = "videonote_${note.video_id}.mp4"
                                                        viewModel.downloadVideo(url, filename)
                                                    }
                                                }
                                            }
                                            "article", "live_photo" -> {
                                                // 图文/Live Photo：下载所有图片
                                                media?.images?.forEachIndexed { idx, img ->
                                                    val filename = "videonote_${note.task_id}_img_${idx + 1}.jpg"
                                                    viewModel.downloadImage(img, filename)
                                                }
                                                // Live Photo：同时下载对应的实况视频合成
                                                media?.live_photos?.forEach { lp ->
                                                    val imageUrl = media.images.getOrNull(lp.index - 1)
                                                    if (imageUrl != null) {
                                                        val base = "videonote_${note.task_id}_live_${lp.index}"
                                                        viewModel.downloadLivePhoto(imageUrl, lp.video_url, base)
                                                    }
                                                }
                                            }
                                            else -> {
                                                // 未知类型，尝试下载视频
                                                note.author_id?.let { aid ->
                                                    note.video_id?.let { vid ->
                                                        val url = "/api/video_file/${note.platform}/$aid/$vid"
                                                        val filename = "videonote_${note.video_id}.mp4"
                                                        viewModel.downloadVideo(url, filename)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                            .fillMaxHeight(),
                        contentAlignment = Alignment.Center
                    ) {
                        if (uiState.isDownloading) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(16.dp),
                                strokeWidth = 2.dp,
                                color = XaiFg
                            )
                        } else {
                            Text("保存", style = TextStyle(fontSize = 15.sp, fontFamily = FontFamily.Default), color = XaiFg)
                        }
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
                // ── 媒体区（封面 + 视频播放器） ──
                NoteMediaSection(note, uiState.media, imageProxyHelper)

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
                        note.duration.formatDuration()?.let {
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

                // ── 媒体画廊（article/live_photo 类型，正文下方） ──
                NoteMediaGallery(
                    media = uiState.media,
                    imageProxyHelper = imageProxyHelper,
                    onDownloadImage = { url, idx ->
                        requestMediaPermissionsThen {
                            val filename = "videonote_${note.task_id}_img_${idx}.jpg"
                            viewModel.downloadImage(url, filename)
                        }
                    },
                    onDownloadLivePhoto = { img, vid, idx ->
                        requestMediaPermissionsThen {
                            val base = "videonote_${note.task_id}_live_${idx}"
                            viewModel.downloadLivePhoto(img, vid, base)
                        }
                    }
                )

                // ── 4 Tab ──
                XaiTabRow(
                    tabs = listOf("摘要", "字幕", "导图", "原文"),
                    selectedIndex = uiState.selectedTab,
                    onSelected = { viewModel.selectTab(it) }
                )

                // ── Tab 内容 ──
                when (uiState.selectedTab) {
                    0 -> (note.markdown ?: note.summary)?.let {
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
                    2 -> (note.outline ?: note.markdown)?.let {
                        MindMapCanvas(
                            markdown = it,
                            modifier = Modifier.fillMaxWidth().height(300.dp)
                        )
                    }
                    3 -> {
                        Column(modifier = Modifier.padding(20.dp)) {
                            (note.raw_article ?: note.markdown)?.let {
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
                    add("复制 Markdown" to {
                        uiState.note?.markdown?.let { md ->
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            clipboard.setPrimaryClip(ClipData.newPlainText("note", md))
                            copyFeedback = true
                        }
                    })
                    add("导出为 PDF" to { /* TODO */ })
                    add("导出为长图" to { /* TODO */ })
                    if (uiState.siyuanConfig?.enabled == 1) {
                        add("导出到思源笔记" to { viewModel.exportToSiyuan(taskId) })
                    }
                    if (uiState.obsidianConfig?.enabled == 1) {
                        add("导出到 Obsidian" to { viewModel.exportToObsidian(taskId) })
                    }
                }
                exportItems.forEach { (label, action) ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                action()
                                showExportSheet = false
                            }
                            .padding(horizontal = 20.dp, vertical = 16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, style = MaterialTheme.typography.bodyLarge, color = XaiFg)
                    }
                    HorizontalDivider(color = XaiBorderSoft)
                }
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

    // 下载/导出消息提示
    uiState.downloadMessage?.let { msg ->
        Snackbar(
            modifier = Modifier.padding(16.dp),
            containerColor = XaiFg,
            contentColor = XaiBg
        ) {
            Text(msg)
        }
        LaunchedEffect(msg) {
            kotlinx.coroutines.delay(2200)
            viewModel.clearMessage()
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

/**
 * 媒体区：视频笔记显示封面 + 播放器，图文笔记只显示封面。
 */
@Composable
private fun NoteMediaSection(
    note: QuickViewResponse,
    media: NoteMediaResponse?,
    imageProxyHelper: ImageProxyHelper
) {
    var playerVisible by remember { mutableStateOf(false) }
    // 视频源：/api/video_file/{platform}/{author_id}/{video_id}（无鉴权 + Range，ExoPlayer 可 seek）
    val videoFileUrl = remember(note.task_id, note.platform, note.author_id, note.video_id) {
        if (note.content_type == "video" && !note.author_id.isNullOrBlank() && !note.video_id.isNullOrBlank()) {
            imageProxyHelper.resolveUrl("/api/video_file/${note.platform}/${note.author_id}/${note.video_id}")
        } else null
    }

    val density = LocalDensity.current
    val screenWidthPx = with(density) { LocalConfiguration.current.screenWidthDp.dp.toPx() }
    val coverHeightPx = screenWidthPx * 9f / 16f
    val coverHeightDp = with(density) { coverHeightPx.toDp() }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(coverHeightDp)
    ) {
        // 封面图（live_photo/article 用 media.cover_url，video 用 note.cover_url）
        val coverUrl = media?.cover_url ?: note.cover_url
        AsyncImage(
            model = imageProxyHelper.getProxyUrl(coverUrl, note.platform),
            contentDescription = null,
            modifier = Modifier.fillMaxSize().background(XaiSurfaceWarm),
            contentScale = ContentScale.Crop
        )

        // 播放按钮 FAB（仅视频类型且有视频源）
        if (!playerVisible && videoFileUrl != null) {
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

        // ExoPlayer 播放视频（/api/video_file 直链 + Range）
        if (playerVisible && videoFileUrl != null) {
            ExoPlayerView(
                videoUrl = videoFileUrl,
                modifier = Modifier.fillMaxSize()
            )
        }

        // 下载按钮（右上角，仅视频类型）
        if (note.content_type == "video" && videoFileUrl != null) {
            // 这里仅显示图标，实际下载由底部"保存"按钮触发，避免重复入口
            // （也可加 IconButton 单独触发，但当前设计统一在底部保存）
        }
    }
}

/**
 * ExoPlayer 视频播放 Composable，自动管理生命周期（DisposableEffect 中 release）。
 */
@Composable
private fun ExoPlayerView(
    videoUrl: String,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var player by remember { mutableStateOf<ExoPlayer?>(null) }

    DisposableEffect(videoUrl) {
        val exo = ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(videoUrl))
            prepare()
            playWhenReady = true
        }
        player = exo
        onDispose {
            exo.release()
            player = null
        }
    }

    player?.let { p ->
        AndroidView(
            factory = { ctx ->
                PlayerView(ctx).apply {
                    this.player = p
                    useController = true
                    layoutParams = android.view.ViewGroup.LayoutParams(
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
            },
            modifier = modifier
        )
    }
}

/**
 * 媒体画廊：正文下方独立区块，展示所有图片缩略图。
 * - article 类型：纯图片缩略图横滑
 * - live_photo 类型：图片带"实况"徽章，长按播放实况视频，每张图带下载按钮
 */
@Composable
private fun NoteMediaGallery(
    media: NoteMediaResponse?,
    imageProxyHelper: ImageProxyHelper,
    onDownloadImage: (imageUrl: String, index: Int) -> Unit,
    onDownloadLivePhoto: (imageUrl: String, videoUrl: String, index: Int) -> Unit
) {
    if (media == null) return
    if (media.images.isEmpty()) return
    // 只对 article/live_photo 类型显示
    if (media.content_type != "article" && media.content_type != "live_photo") return

    Column(modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) {
        XaiSectionLabel(
            text = if (media.live_photos.isNotEmpty()) "实况图片（${media.images.size}）" else "原图（${media.images.size}）",
            modifier = Modifier.padding(horizontal = 20.dp)
        )
        Spacer(Modifier.height(10.dp))

        // 横滑图片列表
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            media.images.forEachIndexed { idx, imgPath ->
                val livePhoto = media.live_photos.firstOrNull { it.index == idx + 1 }
                val resolvedImg = imageProxyHelper.resolveUrl(imgPath)
                val resolvedVid = imageProxyHelper.resolveUrl(livePhoto?.video_url)

                // 单个缩略图（120x160 竖图比例）
                Box(
                    modifier = Modifier
                        .size(width = 120.dp, height = 160.dp)
                        .background(XaiSurfaceWarm)
                        .border(1.dp, XaiBorder)
                ) {
                    if (livePhoto != null && resolvedVid != null && resolvedImg != null) {
                        // Live Photo：长按播放
                        LivePhotoPlayer(
                            imageUrl = resolvedImg,
                            videoUrl = resolvedVid,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else if (resolvedImg != null) {
                        // 普通图片
                        AsyncImage(
                            model = resolvedImg,
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }

                    // 右上角下载按钮
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(4.dp)
                            .size(24.dp)
                            .background(XaiBg.copy(alpha = 0.7f), RoundedCornerShape(2.dp))
                            .clickable {
                                if (livePhoto != null && resolvedVid != null) {
                                    onDownloadLivePhoto(imgPath, livePhoto.video_url, idx + 1)
                                } else {
                                    onDownloadImage(imgPath, idx + 1)
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.Download,
                            contentDescription = "下载",
                            tint = XaiFg,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}
