package com.videonote.android.core.designsystem.component

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * 加载状态组件
 */
@Composable
fun VNLoading(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

/**
 * 错误状态组件
 */
@Composable
fun VNError(
    message: String,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = message, style = MaterialTheme.typography.bodyLarge)
        if (onRetry != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onRetry) { Text("重试") }
        }
    }
}

/**
 * 空状态组件
 */
@Composable
fun VNEmpty(
    message: String = "暂无数据",
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
    }
}

/**
 * 平台标签
 */
@Composable
fun PlatformChip(platform: String, modifier: Modifier = Modifier) {
    val display = when (platform) {
        "bilibili" -> "B站"
        "youtube" -> "YouTube"
        "douyin" -> "抖音"
        "xiaohongshu" -> "小红书"
        "kuaishou" -> "快手"
        "cctv" -> "央视频"
        "local" -> "本地"
        "local_audio" -> "本地音频"
        else -> platform
    }
    AssistChip(
        onClick = {},
        label = { Text(display, style = MaterialTheme.typography.labelSmall) },
        modifier = modifier
    )
}
