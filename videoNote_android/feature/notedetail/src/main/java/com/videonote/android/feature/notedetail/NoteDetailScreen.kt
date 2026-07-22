@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.notedetail

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.common.rememberImageProxyHelper
import com.videonote.android.core.designsystem.component.*
import com.videonote.android.core.designsystem.theme.*
import com.videonote.android.core.network.dto.NoteMediaResponse
import com.videonote.android.core.network.dto.QuickViewResponse
import com.videonote.android.core.network.dto.formatDuration
import dev.jeziellago.compose.markdowntext.MarkdownText
import kotlinx.coroutines.launch

@Composable
fun NoteDetailScreen(
    taskId: String,
    onBack: () -> Unit,
    viewModel: NoteDetailViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = rememberImageProxyHelper()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var showExportSheet by remember { mutableStateOf(false) }
    var copyFeedback by remember { mutableStateOf(false) }
    var showFullScreenViewer by remember { mutableStateOf(false) }
    var fullScreenInitialIndex by remember { mutableStateOf(1) }

    // 权限请求：下载时申请 POST_NOTIFICATIONS（API 33+）
    val lastDownloadAction = remember { mutableStateOf<(() -> Unit)?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { result ->
        lastDownloadAction.value?.let { action ->
            if (result.values.all { it }) action.invoke()
            lastDownloadAction.value = null
        }
    }

    fun requestMediaPermissionsThen(action: () -> Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val perm = Manifest.permission.POST_NOTIFICATIONS
            if (context.checkSelfPermission(perm) == PackageManager.PERMISSION_GRANTED) {
                action()
            } else {
                lastDownloadAction.value = action
                permissionLauncher.launch(arrayOf(perm))
            }
        } else {
            action()
        }
    }

    LaunchedEffect(taskId) {
        viewModel.loadNote(taskId)
        viewModel.loadExportConfigs()
    }

    // Pager 状态：2 页（笔记 / 原图）
    val pagerState = rememberPagerState(pageCount = { 2 })

    // Pager 滑动 -> 同步 selectedTab（用于 XaiTabRow 高亮）
    LaunchedEffect(pagerState) {
        snapshotFlow { pagerState.currentPage }.collect { page ->
            viewModel.selectTab(page)
        }
    }

    Scaffold(
        containerColor = XaiBg,
        topBar = {
            // 沉浸式 TopBar：不显示标题（标题移到封面下方），只显示返回按钮
            XaiTopBar(
                title = "",
                onBack = onBack
            )
        },
        bottomBar = {
            // 底部操作栏：复制 | 导出 | 保存（保持不变）
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
                    // 保存
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
                                                note.author_id?.let { aid ->
                                                    note.video_id?.let { vid ->
                                                        val url = "/api/video_file/${note.platform}/$aid/$vid"
                                                        val filename = "videonote_${note.video_id}.mp4"
                                                        viewModel.downloadVideo(url, filename)
                                                    }
                                                }
                                            }
                                            "article", "live_photo" -> {
                                                val hasLivePhotos = media?.live_photos?.isNotEmpty() == true
                                                if (hasLivePhotos) {
                                                    media.live_photos.forEach { lp ->
                                                        val imageUrl = findImageByIndex(media.images, lp.index)
                                                        if (imageUrl != null) {
                                                            val base = "videonote_${note.task_id}_live_${lp.index}"
                                                            viewModel.downloadLivePhoto(imageUrl, lp.video_url, base)
                                                        }
                                                    }
                                                    media.images.forEachIndexed { idx, img ->
                                                        val imgIndex = extractImageIndex(img)
                                                        val hasMatchingLive = imgIndex != null &&
                                                            media.live_photos.any { it.index == imgIndex }
                                                        if (!hasMatchingLive) {
                                                            val filename = "videonote_${note.task_id}_img_${idx + 1}.jpg"
                                                            viewModel.downloadImage(img, filename)
                                                        }
                                                    }
                                                } else {
                                                    media?.images?.forEachIndexed { idx, img ->
                                                        val filename = "videonote_${note.task_id}_img_${idx + 1}.jpg"
                                                        viewModel.downloadImage(img, filename)
                                                    }
                                                }
                                            }
                                            else -> {
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
            Column(modifier = Modifier.fillMaxSize().padding(padding)) {
                // ── 沉浸式封面区 ──
                NoteCoverSection(
                    note = note,
                    media = uiState.media,
                    imageProxyHelper = imageProxyHelper
                )

                // ── 信息条：标题 + 作者·平台·数量 ──
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 16.dp)) {
                    Text(
                        text = note.title,
                        style = TextStyle(fontSize = 19.sp, fontWeight = FontWeight.Medium, lineHeight = 25.sp),
                        color = XaiFg
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(note.author, style = TextStyle(fontSize = 12.sp), color = XaiFg2)
                        Text("·", color = XaiMeta)
                        PlatformDot(platform = note.platform)
                        Text(
                            text = platformName(note.platform),
                            style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace),
                            color = XaiMuted
                        )
                        // 图文/实况图类型显示图片数量
                        uiState.media?.let { media ->
                            if (media.images.isNotEmpty()) {
                                Text("·", color = XaiMeta)
                                Text(
                                    text = "${media.images.size}张图",
                                    style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace),
                                    color = XaiMuted
                                )
                            }
                        }
                        note.duration.formatDuration()?.let {
                            Text("·", color = XaiMeta)
                            Text(it, style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace), color = XaiMuted)
                        }
                    }
                }

                HorizontalDivider(thickness = 1.dp, color = XaiBorder)

                // ── Tab 栏 ──
                XaiTabRow(
                    tabs = listOf("笔记", "原图"),
                    selectedIndex = pagerState.currentPage,
                    onSelected = { index ->
                        scope.launch { pagerState.animateScrollToPage(index) }
                    }
                )

                // ── HorizontalPager 内容区 ──
                // 注意：在 Column 中必须用 weight(1f) 让 Pager 占满剩余空间，
                // 不能用 fillMaxSize（会得到 0 高度，LazyColumn 不渲染）
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxWidth().weight(1f)
                ) { page ->
                    when (page) {
                        0 -> {
                            // Tab「笔记」：Markdown 正文
                            val mdContent = note.markdown ?: note.summary
                            if (mdContent != null) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxSize()
                                        .verticalScroll(rememberScrollState())
                                        .padding(20.dp)
                                ) {
                                    MarkdownText(
                                        markdown = mdContent,
                                        modifier = Modifier.fillMaxWidth(),
                                        style = TextStyle(fontSize = 14.5.sp, color = XaiFg2, lineHeight = 24.sp)
                                    )
                                    Spacer(Modifier.height(40.dp))
                                }
                            } else {
                                VNEmpty(message = "暂无笔记内容", modifier = Modifier.fillMaxSize())
                            }
                        }
                        1 -> {
                            // Tab「原图」：单列大图流
                            val media = uiState.media
                            if (media != null && media.images.isNotEmpty()) {
                                MediaGalleryTab(
                                    media = media,
                                    imageProxyHelper = imageProxyHelper,
                                    onImageClick = { index ->
                                        fullScreenInitialIndex = index
                                        showFullScreenViewer = true
                                    },
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
                            } else {
                                VNEmpty(message = "暂无图片", modifier = Modifier.fillMaxSize())
                            }
                        }
                    }
                }
            }
        }
    }

    // ── 全屏图片查看器 ──
    if (showFullScreenViewer && uiState.media != null) {
        FullScreenImageViewer(
            media = uiState.media!!,
            initialIndex = fullScreenInitialIndex,
            imageProxyHelper = imageProxyHelper,
            onDismiss = { showFullScreenViewer = false },
            onDownloadImage = { url, idx ->
                requestMediaPermissionsThen {
                    val filename = "videonote_${uiState.note?.task_id}_img_${idx}.jpg"
                    viewModel.downloadImage(url, filename)
                }
            },
            onDownloadLivePhoto = { img, vid, idx ->
                requestMediaPermissionsThen {
                    val base = "videonote_${uiState.note?.task_id}_live_${idx}"
                    viewModel.downloadLivePhoto(img, vid, base)
                }
            }
        )
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
 * 沉浸式封面区：16:9 全宽，video 类型叠播放按钮。
 */
@Composable
private fun NoteCoverSection(
    note: QuickViewResponse,
    media: NoteMediaResponse?,
    imageProxyHelper: ImageProxyHelper
) {
    var playerVisible by remember { mutableStateOf(false) }
    val videoFileUrl = remember(note.task_id, note.platform, note.author_id, note.video_id) {
        if (note.content_type == "video" && !note.author_id.isNullOrBlank() && !note.video_id.isNullOrBlank()) {
            imageProxyHelper.resolveUrl("/api/video_file/${note.platform}/${note.author_id}/${note.video_id}")
        } else null
    }

    val density = LocalDensity.current
    val screenWidthPx = with(density) { LocalConfiguration.current.screenWidthDp.dp.toPx() }
    val coverHeightDp = with(density) { (screenWidthPx * 9f / 16f).toDp() }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(coverHeightDp)
            .background(XaiSurfaceWarm)
    ) {
        // 封面图
        val coverUrl = media?.cover_url ?: note.cover_url
        val coverModel = imageProxyHelper.getProxyUrl(coverUrl, note.platform)
        AsyncImage(
            model = coverModel,
            contentDescription = null,
            modifier = Modifier.fillMaxSize(),
            contentScale = ContentScale.Crop
        )

        // 播放按钮（仅视频类型）
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

        // ExoPlayer 播放视频
        if (playerVisible && videoFileUrl != null) {
            ExoPlayerView(
                videoUrl = videoFileUrl,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

/**
 * ExoPlayer 视频播放 Composable，自动管理生命周期。
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
 * 从图片 URL 中提取文件名里的数字索引。
 */
private fun extractImageIndex(imageUrl: String): Int? {
    val filename = imageUrl.substringAfterLast('/')
    val regex = Regex("image_(\\d+)\\.")
    val match = regex.find(filename)
    return match?.groupValues?.get(1)?.toIntOrNull()
}

/**
 * 从 images 数组中按文件名里的数字索引查找对应的图片 URL。
 */
private fun findImageByIndex(images: List<String>, index: Int): String? {
    return images.firstOrNull { imgUrl ->
        extractImageIndex(imgUrl) == index
    }
}
