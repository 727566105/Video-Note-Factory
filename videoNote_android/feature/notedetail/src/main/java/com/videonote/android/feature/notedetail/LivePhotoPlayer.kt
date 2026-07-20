package com.videonote.android.feature.notedetail

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.videonote.android.core.designsystem.theme.XaiBg
import com.videonote.android.core.designsystem.theme.XaiFg

/**
 * Live Photo 播放器：默认显示静态图，长按播放实况视频。
 *
 * 行为：
 * - 默认显示静态 JPEG（通过 Coil 加载）
 * - 长按图片 -> 切换到 ExoPlayer 播放实况视频（静音循环）
 * - 松手 -> 停止视频，回到静态图
 *
 * @param imageUrl 静态图 URL（经 ImageProxyHelper 处理）
 * @param videoUrl 实况视频 URL（绝对路径）
 * @param modifier Modifier
 */
@Composable
fun LivePhotoPlayer(
    imageUrl: String?,
    videoUrl: String?,
    modifier: Modifier = Modifier,
    onLongPressDownload: (() -> Unit)? = null
) {
    var isPlaying by remember { mutableStateOf(false) }
    var player by remember { mutableStateOf<ExoPlayer?>(null) }
    val context = LocalContext.current

    // 离开 Composition 时释放 ExoPlayer
    DisposableEffect(videoUrl) {
        onDispose {
            player?.release()
            player = null
        }
    }

    Box(
        modifier = modifier
            .pointerInput(videoUrl) {
                if (videoUrl != null) {
                    detectTapGestures(
                        onLongPress = {
                            isPlaying = true
                            // 创建/复用 ExoPlayer 播放视频
                            if (player == null) {
                                player = ExoPlayer.Builder(context).build().apply {
                                    setMediaItem(MediaItem.fromUri(videoUrl))
                                    repeatMode = Player.REPEAT_MODE_ONE
                                    volume = 0f  // 静音
                                    prepare()
                                }
                            }
                            player?.playWhenReady = true
                        },
                        onPress = {
                            try {
                                awaitRelease()
                                isPlaying = false
                                player?.playWhenReady = false
                            } catch (_: Exception) {}
                        }
                    )
                }
            }
    ) {
        // 底层：静态图
        if (imageUrl != null) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize()
            )
        }

        // 上层：视频播放器（仅长按时）
        if (isPlaying && player != null && videoUrl != null) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        this.player = player
                        useController = false  // 不显示播放控件
                        layoutParams = android.view.ViewGroup.LayoutParams(
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                            android.view.ViewGroup.LayoutParams.MATCH_PARENT
                        )
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Live 徽章（右下角，仅 videoUrl 不为空时显示）
        if (videoUrl != null) {
            Box(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(6.dp)
                    .background(XaiBg.copy(alpha = 0.7f), RoundedCornerShape(2.dp))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Text(
                    text = if (isPlaying) "LIVE" else "实况",
                    style = TextStyle(
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 0.4.sp
                    ),
                    color = XaiFg
                )
            }
        }
    }
}
