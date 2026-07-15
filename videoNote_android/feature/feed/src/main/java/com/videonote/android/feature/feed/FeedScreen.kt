@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.feed

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.component.*
import com.videonote.android.core.designsystem.theme.*
import com.videonote.android.core.network.dto.FeedItem

@Composable
fun FeedScreen(
    onNavigateToNoteDetail: (String) -> Unit,
    viewModel: FeedViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showAddSubSheet by remember { mutableStateOf(false) }
    var subUrl by remember { mutableStateOf("") }

    Scaffold(
        containerColor = XaiBg,
        topBar = {
            XaiTopBar(
                title = if (uiState.unreadCount > 0) "动态 (${uiState.unreadCount})" else "动态",
                actions = {
                    XaiIconButton(onClick = viewModel::markAllRead, contentDescription = "全部已读") {
                        Icon(Icons.Default.Check, "全部已读", tint = XaiFg, modifier = Modifier.size(22.dp))
                    }
                    XaiIconButton(onClick = viewModel::refreshFeed, contentDescription = "刷新") {
                        Icon(Icons.Default.Refresh, "刷新", tint = XaiFg, modifier = Modifier.size(22.dp))
                    }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // ── 订阅频道横栏 ──
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(uiState.subscriptions) { sub ->
                    Column(
                        modifier = Modifier.width(60.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // 圆形头像
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(CircleShape)
                                .background(XaiSurfaceWarm)
                                .border(1.dp, XaiBorder, CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            sub.avatar?.let { url ->
                                AsyncImage(
                                    model = imageProxyHelper.getProxyUrl(url, sub.platform),
                                    contentDescription = null,
                                    modifier = Modifier.fillMaxSize().clip(CircleShape)
                                )
                            } ?: run {
                                // 显示首字
                                Text(
                                    text = sub.author.firstOrNull()?.toString() ?: "?",
                                    style = TextStyle(fontSize = 15.sp, fontFamily = FontFamily.Monospace),
                                    color = XaiFg
                                )
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = sub.author,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            style = TextStyle(fontSize = 11.sp),
                            color = XaiFg2,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
                // 添加订阅按钮
                item {
                    Column(
                        modifier = Modifier.width(60.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .border(1.dp, XaiBorderStrong, CircleShape)
                                .clickable { showAddSubSheet = true },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Add, "添加", tint = XaiFg, modifier = Modifier.size(18.dp))
                        }
                        Spacer(Modifier.height(8.dp))
                        Text("订阅", style = TextStyle(fontSize = 11.sp), color = XaiMuted)
                    }
                }
            }
            HorizontalDivider(color = XaiBorderSoft)

            // ── 最新动态 ──
            XaiSectionLabel("最新动态")

            // ── 动态列表 ──
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(uiState.items, key = { it.id }) { item ->
                    XaiFeedItem(
                        item = item,
                        imageProxyHelper = imageProxyHelper,
                        onClick = { viewModel.selectItem(item) }
                    )
                }
                if (uiState.hasMore && !uiState.isLoading) {
                    item { LaunchedEffect(Unit) { viewModel.loadFeed() } }
                }
                if (uiState.items.isEmpty() && !uiState.isLoading) {
                    item {
                        VNStateBox(
                            title = "还没有订阅",
                            description = "订阅 UP 主，第一时间看到新视频笔记",
                            action = {
                                XaiButton(
                                    text = "添加订阅",
                                    onClick = { showAddSubSheet = true },
                                    ghost = true,
                                    modifier = Modifier.padding(horizontal = 24.dp)
                                )
                            }
                        )
                    }
                }
            }
        }
    }

    // ── 详情 BottomSheet ──
    uiState.selectedItem?.let { item ->
        ModalBottomSheet(
            onDismissRequest = viewModel::clearSelectedItem,
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
                Spacer(Modifier.height(8.dp))

                // 大图
                AsyncImage(
                    model = imageProxyHelper.getProxyUrl(item.cover_url, item.platform),
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(16f / 9f)
                        .background(XaiSurfaceWarm)
                )

                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = item.title,
                        style = TextStyle(fontSize = 17.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium, lineHeight = 23.sp),
                        color = XaiFg
                    )
                    Spacer(Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(item.author, style = MaterialTheme.typography.bodySmall, color = XaiFg2)
                        PlatformDot(platform = item.platform)
                        Text(
                            text = platformName(item.platform),
                            style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace),
                            color = XaiMuted
                        )
                    }
                    item.description.takeIf { it.isNotBlank() }?.let {
                        Spacer(Modifier.height(14.dp))
                        Text(
                            text = it,
                            maxLines = 3,
                            overflow = TextOverflow.Ellipsis,
                            style = MaterialTheme.typography.bodySmall,
                            color = XaiFg2,
                            lineHeight = 22.sp
                        )
                    }
                    Spacer(Modifier.height(20.dp))
                    // 操作按钮
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        val taskId = item.available_task_id
                        if (item.note_available && taskId != null) {
                            XaiButton(
                                text = "查看笔记",
                                onClick = { onNavigateToNoteDetail(taskId) },
                                modifier = Modifier.weight(1f)
                            )
                        } else {
                            XaiButton(
                                text = "生成笔记",
                                onClick = { viewModel.generateNoteFromFeed(item.id) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                        if (!item.is_read) {
                            XaiButton(
                                text = "标记已读",
                                onClick = { viewModel.markRead(item.id) },
                                ghost = true,
                                modifier = Modifier.width(120.dp)
                            )
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }

    // ── 添加订阅 Sheet ──
    if (showAddSubSheet) {
        ModalBottomSheet(
            onDismissRequest = { showAddSubSheet = false },
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
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "添加订阅",
                    style = TextStyle(fontSize = 13.sp, fontFamily = FontFamily.Monospace, letterSpacing = 1.sp),
                    color = XaiFg,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 6.dp)
                )
                HorizontalDivider(color = XaiBorderSoft)

                Column(modifier = Modifier.padding(20.dp)) {
                    XaiTextField(
                        value = subUrl,
                        onValueChange = { subUrl = it },
                        label = "频道链接",
                        placeholder = "粘贴 UP 主主页或频道 URL"
                    )
                    Spacer(Modifier.height(14.dp))
                    XaiButton(
                        text = "解析并订阅",
                        onClick = {
                            if (subUrl.isNotBlank()) {
                                viewModel.addSubscription(subUrl)
                                subUrl = ""
                                showAddSubSheet = false
                            }
                        }
                    )
                    Spacer(Modifier.height(8.dp))
                    XaiButton(
                        text = "取消",
                        onClick = { showAddSubSheet = false },
                        ghost = true
                    )
                    Spacer(Modifier.height(24.dp))
                }
            }
        }
    }
}

@Composable
private fun XaiFeedItem(
    item: FeedItem,
    imageProxyHelper: ImageProxyHelper,
    onClick: () -> Unit
) {
    Column {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onClick() }
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // 缩略图
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(XaiSurfaceWarm)
                    .border(1.dp, XaiBorderSoft),
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = imageProxyHelper.getProxyUrl(item.cover_url, item.platform),
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize()
                )
            }
            // 标题 + 副信息
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.title,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.bodyMedium,
                    color = XaiFg,
                    lineHeight = 19.sp
                )
                Spacer(Modifier.height(6.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(item.author, style = TextStyle(fontSize = 12.sp), color = XaiMuted)
                    PlatformDot(platform = item.platform)
                }
            }
            // 状态 badge
            if (item.note_available) {
                XaiBadge(text = "已生成")
            } else if (!item.is_read) {
                XaiBadge(text = "未读", active = true)
            }
        }
        HorizontalDivider(color = XaiBorderSoft)
    }
}
