@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.feed

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.network.dto.FeedItem

@Composable
fun FeedScreen(
    onNavigateToNoteDetail: (String) -> Unit,
    viewModel: FeedViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("动态${if (uiState.unreadCount > 0) " (${uiState.unreadCount})" else ""}") },
                actions = {
                    IconButton(onClick = viewModel::markAllRead) { Icon(Icons.Default.Check, "全部已读") }
                    IconButton(onClick = viewModel::refreshFeed) { Icon(Icons.Default.Refresh, "刷新") }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // 订阅频道横栏
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.subscriptions) { sub ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        AsyncImage(
                            model = imageProxyHelper.getProxyUrl(sub.avatar, sub.platform),
                            contentDescription = null,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(sub.author, maxLines = 1, style = MaterialTheme.typography.labelSmall)
                    }
                }
                item {
                    IconButton(onClick = { /* 添加订阅对话框 */ }) { Icon(Icons.Default.Add, "添加") }
                }
            }

            // 动态列表
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(uiState.items, key = { it.id }) { item ->
                    FeedItemCard(
                        item = item,
                        imageProxyHelper = imageProxyHelper,
                        onClick = { viewModel.selectItem(item) }
                    )
                    HorizontalDivider()
                }
                if (uiState.hasMore && !uiState.isLoading) {
                    item { LaunchedEffect(Unit) { viewModel.loadFeed() } }
                }
            }
        }
    }

    // 详情 Bottom Sheet
    uiState.selectedItem?.let { item ->
        ModalBottomSheet(onDismissRequest = viewModel::clearSelectedItem) {
            Column(modifier = Modifier.padding(16.dp)) {
                AsyncImage(
                    model = imageProxyHelper.getProxyUrl(item.cover_url, item.platform),
                    contentDescription = null,
                    modifier = Modifier.fillMaxWidth().height(180.dp)
                )
                Spacer(Modifier.height(8.dp))
                Text(item.title, style = MaterialTheme.typography.titleMedium)
                Text(item.author, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                item.description.takeIf { it.isNotBlank() }?.let {
                    Text(it, maxLines = 3, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    val taskId = item.available_task_id
                    if (item.note_available && taskId != null) {
                        Button(onClick = { onNavigateToNoteDetail(taskId) }) { Text("查看笔记") }
                    } else {
                        Button(onClick = { viewModel.generateNoteFromFeed(item.id) }) { Text("生成笔记") }
                    }
                    if (!item.is_read) {
                        OutlinedButton(onClick = { viewModel.markRead(item.id) }) { Text("标记已读") }
                    }
                }
            }
        }
    }
}

@Composable
private fun FeedItemCard(item: FeedItem, imageProxyHelper: ImageProxyHelper, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(item.title, maxLines = 2, overflow = TextOverflow.Ellipsis) },
        supportingContent = { Text(item.author, style = MaterialTheme.typography.bodySmall) },
        leadingContent = {
            AsyncImage(
                model = imageProxyHelper.getProxyUrl(item.cover_url, item.platform),
                contentDescription = null,
                modifier = Modifier.size(56.dp)
            )
        },
        trailingContent = {
            if (item.note_available) Text("已生成", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.tertiary)
            else if (!item.is_read) Text("未读", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        },
        modifier = Modifier.clickable { onClick() }
    )
}
