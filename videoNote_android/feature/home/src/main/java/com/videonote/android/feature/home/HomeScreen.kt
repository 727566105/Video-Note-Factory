package com.videonote.android.feature.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.designsystem.component.PlatformChip
import com.videonote.android.core.designsystem.component.XaiButton
import com.videonote.android.core.designsystem.component.XaiCard
import com.videonote.android.core.designsystem.component.XaiEyebrow
import com.videonote.android.core.designsystem.component.XaiIconButton
import com.videonote.android.core.designsystem.component.XaiProgress
import com.videonote.android.core.designsystem.component.XaiSectionLabel
import com.videonote.android.core.designsystem.component.XaiSegmented
import com.videonote.android.core.designsystem.component.XaiSwitch
import com.videonote.android.core.designsystem.component.XaiTextField
import com.videonote.android.core.designsystem.component.XaiTopBar
import com.videonote.android.core.designsystem.theme.XaiBg
import com.videonote.android.core.designsystem.theme.XaiDanger
import com.videonote.android.core.designsystem.theme.XaiFg
import com.videonote.android.core.designsystem.theme.XaiFg2
import com.videonote.android.core.designsystem.theme.XaiMeta
import com.videonote.android.core.designsystem.theme.XaiMuted
import androidx.compose.material3.Text

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
        containerColor = XaiBg,
        topBar = {
            XaiTopBar(
                title = "VIDEONOTE",
                mono = true,
                actions = {
                    XaiIconButton(
                        onClick = onOpenUserMenu,
                        contentDescription = "账户",
                        icon = {
                            Icon(
                                Icons.Default.Person,
                                contentDescription = "账户",
                                tint = XaiFg,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    )
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(XaiBg)
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // ─── 内容区顶部：标题区 ─────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                XaiEyebrow(text = "新建视频笔记")
                Text(
                    text = "粘贴链接，AI 自动做笔记",
                    style = TextStyle(
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Medium,
                        color = XaiFg
                    )
                )
                Text(
                    text = "支持 B站 / YouTube / 抖音 / 小红书 / 快手 / 央视频 / 本地文件",
                    style = TextStyle(fontSize = 13.sp, color = XaiMuted)
                )
            }

            // ─── URL 输入区 ─────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                XaiTextField(
                    value = uiState.urlInput,
                    onValueChange = viewModel::updateUrl,
                    label = "视频链接",
                    placeholder = "粘贴或输入视频 URL",
                    trailingIcon = {
                        if (uiState.urlInput.isNotEmpty()) {
                            XaiIconButton(
                                onClick = viewModel::clearUrl,
                                contentDescription = "清除",
                                icon = {
                                    Icon(
                                        Icons.Default.Close,
                                        contentDescription = "清除",
                                        tint = XaiMuted,
                                        modifier = Modifier.size(16.dp)
                                    )
                                }
                            )
                        }
                    }
                )

                // 平台识别行：URL 非空时显示
                if (uiState.urlInput.isNotEmpty() && uiState.detectedPlatform != null) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        PlatformChip(platform = uiState.detectedPlatform!!)
                        Text(
                            text = "已识别平台",
                            style = TextStyle(fontSize = 12.sp, color = XaiMeta)
                        )
                    }
                }

                // 剪贴板提示行
                if (uiState.clipboardConsumed && uiState.urlInput.isNotEmpty()) {
                    Text(
                        text = "已从剪贴板自动填入",
                        style = TextStyle(fontSize = 12.sp, color = XaiMeta)
                    )
                }
            }

            // ─── 笔记风格 ───────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                XaiSectionLabelWithoutPadding(text = "笔记风格")
                XaiSegmented(
                    items = listOf("简洁", "详细", "要点"),
                    selectedIndex = when (uiState.style) {
                        "minimal" -> 0
                        "detailed" -> 1
                        "bullet" -> 2
                        else -> 1
                    },
                    onSelected = { index ->
                        val style = when (index) {
                            0 -> "minimal"
                            1 -> "detailed"
                            2 -> "bullet"
                            else -> "detailed"
                        }
                        viewModel.setStyle(style)
                    }
                )
            }

            // ─── 智能模式 ───────────────────────────────────────────
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(modifier = Modifier.weight(1f)) {
                        XaiSectionLabelWithoutPadding(text = "智能选择模型")
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "根据视频内容自动匹配最佳转写与总结模型",
                            style = TextStyle(fontSize = 12.sp, color = XaiMuted)
                        )
                    }
                    Spacer(modifier = Modifier.size(12.dp))
                    XaiSwitch(
                        checked = uiState.smartMode,
                        onCheckedChange = viewModel::setSmartMode
                    )
                }
            }

            // ─── 生成按钮 ───────────────────────────────────────────
            XaiButton(
                text = "生成笔记",
                onClick = viewModel::generateNote,
                enabled = !uiState.isGenerating && uiState.urlInput.isNotBlank(),
                isLoading = uiState.isGenerating,
                primary = true
            )

            // ─── 错误提示 ───────────────────────────────────────────
            uiState.error?.let { err ->
                Text(
                    text = err,
                    style = TextStyle(fontSize = 12.sp, color = XaiDanger)
                )
            }

            // ─── 笔记复用提示 ───────────────────────────────────────
            if (uiState.noteReused) {
                Text(
                    text = "该视频已有笔记，已复用",
                    style = TextStyle(fontSize = 12.sp, color = XaiFg2)
                )
            }

            // ─── 任务状态卡片 ───────────────────────────────────────
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
        }
    }
}

/// 无内边距版 SectionLabel（页面内已有自己的内边距，避免双重 padding）
@Composable
private fun XaiSectionLabelWithoutPadding(text: String) {
    Text(
        text = text.uppercase(),
        style = TextStyle(
            fontSize = 11.sp,
            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
            letterSpacing = 1.sp
        ),
        color = XaiMuted
    )
}

@Composable
private fun TaskStatusCard(
    status: com.videonote.android.core.network.dto.TaskStatusResponse,
    onCancel: () -> Unit,
    onViewNote: () -> Unit
) {
    XaiCard(warm = true, modifier = Modifier.fillMaxWidth()) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            // 状态标题行 + 百分比
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "任务状态：${status.status}",
                    style = TextStyle(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = XaiFg
                    ),
                    modifier = Modifier.weight(1f)
                )
                if (status.progress > 0) {
                    Text(
                        text = "${status.progress.toInt()}%",
                        style = TextStyle(
                            fontSize = 13.sp,
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace,
                            color = XaiFg2
                        )
                    )
                }
            }

            // 进度条
            if (status.progress > 0) {
                XaiProgress(progress = status.progress / 100f)
            }

            // 步骤文字
            status.step?.let {
                Text(
                    text = it,
                    style = TextStyle(fontSize = 12.sp, color = XaiMuted)
                )
            }

            // 失败错误信息
            if (status.status == "FAILED") {
                Text(
                    text = "失败：${status.error ?: "未知错误"}",
                    style = TextStyle(fontSize = 12.sp, color = XaiDanger)
                )
            }

            // 操作按钮
            if (status.status == "SUCCESS" || status.status !in listOf("SUCCESS", "FAILED", "CANCELLED")) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (status.status == "SUCCESS") {
                        XaiButton(
                            text = "查看笔记",
                            onClick = onViewNote,
                            primary = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    if (status.status !in listOf("SUCCESS", "FAILED", "CANCELLED")) {
                        XaiButton(
                            text = "取消",
                            onClick = onCancel,
                            ghost = true,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
    }
}
