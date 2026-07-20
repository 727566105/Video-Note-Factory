@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.notelist

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.designsystem.component.*
import com.videonote.android.core.designsystem.theme.*

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
        containerColor = XaiBg,
        topBar = {
            XaiTopBar(
                title = uiState.collection?.name ?: "收藏夹",
                onBack = onBack,
                actions = {
                    XaiIconButton(onClick = { /* 更多操作 */ }, contentDescription = "更多") {
                        Icon(Icons.Default.MoreVert, "更多", tint = XaiFg, modifier = Modifier.size(22.dp))
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            // ── AI 摘要 ──
            uiState.summary?.let { summary ->
                item {
                    Column(modifier = Modifier.padding(horizontal = 20.dp).padding(top = 16.dp)) {
                        XaiCard {
                            XaiEyebrow(text = "AI 摘要")
                            Spacer(Modifier.height(10.dp))
                            Text(
                                text = summary,
                                style = TextStyle(fontSize = 14.sp, lineHeight = 22.sp),
                                color = XaiFg2
                            )
                        }
                    }
                }
            }

            // ── 笔记数量 ──
            uiState.collection?.effectiveItems?.let { tasks ->
                item {
                    XaiSectionLabel(text = "${tasks.size} 篇笔记")
                }

                // ── 笔记列表 ──
                items(tasks, key = { it.task_id }) { task ->
                    XaiListItem(
                        title = task.title,
                        subtitle = task.author,
                        onClick = { onNoteClick(task.task_id) },
                        leading = {
                            // 56dp 缩略图占位
                            Box(
                                modifier = Modifier
                                    .size(56.dp)
                                    .background(XaiSurfaceWarm)
                                    .border(1.dp, XaiBorderSoft),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "▶",
                                    style = TextStyle(fontSize = 14.sp),
                                    color = XaiMeta
                                )
                            }
                        },
                        trailing = {
                            Icon(
                                imageVector = androidx.compose.material.icons.Icons.Default.KeyboardArrowRight,
                                contentDescription = null,
                                tint = XaiMeta,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    )
                }
            }
        }
    }
}
