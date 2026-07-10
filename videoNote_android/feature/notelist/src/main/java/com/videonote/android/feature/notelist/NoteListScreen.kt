package com.videonote.android.feature.notelist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items as lazyItems
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.component.PlatformChip
import com.videonote.android.core.network.dto.CollectionDto
import com.videonote.android.core.network.dto.TaskItem

@Composable
fun NoteListScreen(
    onNoteClick: (String) -> Unit,
    onCollectionClick: (String) -> Unit,
    viewModel: NoteListViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        // Tab: 全部笔记 | 收藏夹
        TabRow(selectedTabIndex = uiState.selectedTab) {
            Tab(selected = uiState.selectedTab == 0, onClick = { viewModel.selectTab(0) }, text = { Text("全部笔记") })
            Tab(selected = uiState.selectedTab == 1, onClick = { viewModel.selectTab(1) }, text = { Text("收藏夹") })
        }

        when (uiState.selectedTab) {
            0 -> AllNotesTab(uiState, viewModel, onNoteClick, imageProxyHelper)
            1 -> CollectionsTab(uiState, viewModel, onCollectionClick)
        }
    }
}

@Composable
private fun AllNotesTab(
    uiState: NoteListUiState,
    viewModel: NoteListViewModel,
    onNoteClick: (String) -> Unit,
    imageProxyHelper: ImageProxyHelper
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // 搜索框
        OutlinedTextField(
            value = uiState.searchQuery,
            onValueChange = viewModel::updateSearch,
            placeholder = { Text("搜索笔记...") },
            trailingIcon = { IconButton(onClick = viewModel::search) { Icon(Icons.Default.Search, null) } },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
        )

        // 平台筛选 chips（横向滚动）
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(selected = uiState.selectedPlatform == null, onClick = { viewModel.selectPlatform(null) }, label = { Text("全部") })
            listOf("bilibili", "youtube", "douyin", "xiaohongshu", "kuaishou", "cctv").forEach { platform ->
                FilterChip(
                    selected = uiState.selectedPlatform == platform,
                    onClick = { viewModel.selectPlatform(platform) },
                    label = { Text(platform) }
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        // 笔记卡片网格（每行 2 张）
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            gridItems(uiState.tasks, key = { it.task_id }) { task ->
                NoteCard(task = task, imageProxyHelper = imageProxyHelper, onClick = { onNoteClick(task.task_id) })
            }
            if (uiState.hasMore && !uiState.isLoading) {
                item { LaunchedEffect(Unit) { viewModel.loadTasks() } }
            }
        }
    }
}

@Composable
private fun NoteCard(task: TaskItem, imageProxyHelper: ImageProxyHelper, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column {
            // 封面图：通过图片代理加载（B站/抖音等有 Referer 限制）
            AsyncImage(
                model = imageProxyHelper.getProxyUrl(task.cover_url, task.platform),
                contentDescription = null,
                modifier = Modifier.fillMaxWidth().height(100.dp).clip(MaterialTheme.shapes.medium)
            )
            Column(modifier = Modifier.padding(8.dp)) {
                Text(task.title, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(4.dp))
                Text(task.author, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                Spacer(Modifier.height(4.dp))
                PlatformChip(platform = task.platform)
            }
        }
    }
}

@Composable
private fun CollectionsTab(
    uiState: NoteListUiState,
    viewModel: NoteListViewModel,
    onCollectionClick: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Button(onClick = { /* 新建收藏夹对话框 */ }, modifier = Modifier.fillMaxWidth()) {
                Text("新建收藏夹")
            }
        }
        lazyItems(uiState.collections, key = { it.id }) { collection ->
            CollectionCard(collection = collection, onClick = { onCollectionClick(collection.id) })
        }
    }
}

@Composable
private fun CollectionCard(collection: CollectionDto, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(collection.name, style = MaterialTheme.typography.titleMedium)
                Text("${collection.note_count} 篇笔记", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            }
        }
    }
}
