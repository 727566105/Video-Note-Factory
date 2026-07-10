@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.designsystem.component.PlatformChip

@Composable
fun HomeScreen(
    onNavigateToNoteDetail: (String) -> Unit,
    onOpenUserMenu: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val clipboardManager = LocalClipboardManager.current

    // 剪贴板自动填入（LaunchedEffect 只执行一次）
    // 设计要求：输入框为空 + 剪贴板有 URL -> 直接填入（零步操作）
    LaunchedEffect(Unit) {
        if (uiState.urlInput.isEmpty() && !uiState.clipboardConsumed) {
            val clipText = clipboardManager.getText()?.text
            // 委托给 ViewModel 处理：内部会判断 URL 有效性、提取 URL、标记 consumed
            viewModel.tryAutoFillFromClipboard(clipText)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("VideoNote") },
                actions = {
                    IconButton(onClick = onOpenUserMenu) {
                        Icon(Icons.Default.Person, contentDescription = "用户")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // URL 输入框
            OutlinedTextField(
                value = uiState.urlInput,
                onValueChange = viewModel::updateUrl,
                label = { Text("视频链接") },
                placeholder = { Text("粘贴或输入视频 URL") },
                singleLine = true,
                trailingIcon = {
                    if (uiState.urlInput.isNotEmpty()) {
                        IconButton(onClick = viewModel::clearUrl) {
                            Icon(Icons.Default.Clear, contentDescription = "清除")
                        }
                    }
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth()
            )

            // 平台检测结果
            if (uiState.detectedPlatform != null) {
                PlatformChip(platform = uiState.detectedPlatform!!)
            }

            // 笔记风格选择
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("minimal" to "简洁", "detailed" to "详细", "bullet" to "要点").forEach { (value, label) ->
                    FilterChip(
                        selected = uiState.style == value,
                        onClick = { viewModel.setStyle(value) },
                        label = { Text(label) }
                    )
                }
            }

            // 智能模式开关
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("智能选择模型")
                Spacer(Modifier.weight(1f))
                Switch(checked = uiState.smartMode, onCheckedChange = viewModel::setSmartMode)
            }

            Spacer(Modifier.height(8.dp))

            // 生成按钮
            Button(
                onClick = viewModel::generateNote,
                enabled = !uiState.isGenerating && uiState.urlInput.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                if (uiState.isGenerating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("生成笔记")
                }
            }

            // 错误提示
            uiState.error?.let { err ->
                Text(err, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            // 任务状态实时显示
            uiState.taskStatus?.let { status ->
                val currentTaskId = uiState.currentTaskId
                TaskStatusCard(
                    status = status,
                    onCancel = viewModel::cancelCurrentTask,
                    onViewNote = {
                        currentTaskId?.let { onNavigateToNoteDetail(it) }
                    }
                )
            }

            // 笔记复用提示
            if (uiState.noteReused) {
                Text("该视频已有笔记，已复用", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.tertiary)
            }
        }
    }
}

@Composable
private fun TaskStatusCard(
    status: com.videonote.android.core.network.dto.TaskStatusResponse,
    onCancel: () -> Unit,
    onViewNote: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("任务状态：${status.status}", style = MaterialTheme.typography.titleMedium)
            if (status.progress > 0) {
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(progress = { status.progress / 100f }, modifier = Modifier.fillMaxWidth())
            }
            status.step?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (status.status == "SUCCESS") {
                    Button(onClick = onViewNote) { Text("查看笔记") }
                }
                if (status.status !in listOf("SUCCESS", "FAILED", "CANCELLED")) {
                    OutlinedButton(onClick = onCancel) { Text("取消") }
                }
                if (status.status == "FAILED") {
                    Text("失败：${status.error ?: "未知错误"}", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
