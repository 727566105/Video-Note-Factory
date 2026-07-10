package com.videonote.android.feature.notelist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.network.dto.CollectionDetailDto

/**
 * 收藏夹详情页：使用独立的 CollectionDetailViewModel
 */
@Composable
fun CollectionDetailScreen(
    collectionId: String,
    onBack: () -> Unit,
    onNoteClick: (String) -> Unit,
    viewModel: CollectionDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(collectionId) {
        viewModel.loadCollection(collectionId)
        viewModel.loadSummary(collectionId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.collection?.name ?: "收藏夹") },
                navigationIcon = { TextButton(onClick = onBack) { Text("返回") } }
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            // AI 摘要
            uiState.summary?.let { summary ->
                item {
                    Card(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Text(summary, modifier = Modifier.padding(16.dp))
                    }
                }
            }

            // 笔记列表
            uiState.collection?.tasks?.let { tasks ->
                items(tasks, key = { it.task_id }) { task ->
                    ListItem(
                        headlineContent = { Text(task.title, maxLines = 1) },
                        supportingContent = { Text(task.author, style = MaterialTheme.typography.bodySmall) },
                        modifier = Modifier.clickable { onNoteClick(task.task_id) }
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}
