package com.videonote.android.feature.notedetail

import android.util.Log
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
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import coil.compose.AsyncImage
import com.videonote.android.core.designsystem.theme.XaiBg
import com.videonote.android.core.designsystem.theme.XaiFg

private const val TAG = "LivePhotoPlayer"

/**
 * Live Photo 播放器：默认显示静态图，长按播放实况视频。
 *
 * 行为：
 * - 默认显示静态 JPEG（通过 Coil 加载）
 * - 长按图片 -> 创建 ExoPlayer 并播放实况视频（静音循环）
 * - 松手 -> 停止并释放 ExoPlayer，回到静态图
 *
 * ## 实现要点（修复历史 bug）
 *
 * ### Bug 1：闭包陷阱（核心）
 * 旧代码在 `pointerInput` 的 lambda 里直接读 `player` 变量：
 * ```kotlin
 * onLongPress = {
 *     if (player == null) { player = ExoPlayer.Builder(context).build() }
 *     player?.playWhenReady = true  // ← 这里 player 仍是旧值 null！
 * }
 * ```
 * `pointerInput(videoUrl)` 的 lambda 在 `videoUrl` 变化时才重建，lambda 内捕获的 `player`
 * 是 lambda 创建时的初值（null）。即使前一行 `player = ExoPlayer...` 赋值了，下一行读到的
 * `player` 仍是闭包捕获的旧值。修复方式：lambda 里只改 `isPlaying` Boolean 状态，
 * ExoPlayer 用 `remember(isPlaying, videoUrl)` 懒加载，松手时 isPlaying 变 false 自动释放。
 *
 * ### Bug 2：70 张实况图同时创建 ExoPlayer 导致 OOM
 * 一条 live_photo 笔记可能有 70 张实况图，每个 LivePhotoPlayer 实例都创建 ExoPlayer
 * 会导致 70 个 ExoPlayer 同时存在（即使不 prepare 也占大量内存）。改成懒加载：只在
 * `isPlaying=true` 时才创建 ExoPlayer，松手立即释放。
 *
 * ### Bug 3：awaitPointerEvent 阻塞导致长按检测失效
 * 旧版用 `awaitEachGesture + awaitPointerEvent` 自己实现长按检测，但 `awaitPointerEvent`
 * 会阻塞等待事件，adb swipe 期间没有中间事件，导致长按阈值检查无法触发。改回
 * `detectTapGestures(onLongPress=...)` 用系统标准长按检测（底层会发 ACTION_DOWN 后
 * 启动定时器，到时间自动触发 onLongPress）。松手检测用 `onPress` 的 `tryAwaitRelease()`，
 * 它会在 onLongPress 触发后继续阻塞直到真正松手。
 *
 * @param imageUrl 静态图 URL（经 ImageProxyHelper.resolveUrl 处理过的绝对 URL）
 * @param videoUrl 实况视频 URL（绝对路径），为 null 时退化为普通图片显示
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
    val context = LocalContext.current

    // 懒加载 ExoPlayer：只在 isPlaying=true 时才创建。
    // 松手时 isPlaying 变 false，remember 重建返回 null，旧 player 被 DisposableEffect 释放。
    // 一条笔记可能有 70 张实况图，必须懒加载避免 70 个 ExoPlayer 同时存在导致 OOM。
    val player = remember(isPlaying, videoUrl) {
        if (isPlaying && videoUrl != null) {
            Log.d(TAG, "creating ExoPlayer for $videoUrl")
            // 限制缓冲区大小，降低内存占用（实况视频通常很短，2MB 缓冲足够）
            val loadControl = DefaultLoadControl.Builder()
                .setBufferDurationsMs(1500, 5000, 1000, 1000)
                .setTargetBufferBytes(2 * 1024 * 1024)
                .build()
            ExoPlayer.Builder(context)
                .setLoadControl(loadControl)
                .build().apply {
                    setMediaItem(MediaItem.fromUri(videoUrl))
                    repeatMode = Player.REPEAT_MODE_ONE
                    volume = 0f  // 静音
                    playWhenReady = true
                    prepare()
                }
        } else null
    }

    // ExoPlayer 释放：player 变 null（松手）或 videoUrl 变化时释放旧 player
    DisposableEffect(player) {
        onDispose {
            Log.d(TAG, "releasing ExoPlayer")
            player?.release()
        }
    }

    Box(
        modifier = modifier
            .pointerInput(videoUrl) {
                if (videoUrl != null) {
                    detectTapGestures(
                        onLongPress = {
                            Log.d(TAG, "onLongPress -> isPlaying=true")
                            isPlaying = true
                        },
                        onPress = {
                            // 等待手指抬起（无论是否触发 onLongPress）。
                            // onLongPress 触发后，tryAwaitRelease 会继续阻塞直到真正松手。
                            tryAwaitRelease()
                            if (isPlaying) {
                                Log.d(TAG, "finger released -> isPlaying=false")
                                isPlaying = false
                            }
                        }
                    )
                }
            }
    ) {
        // 底层：静态图（始终渲染，视频覆盖在上面）
        if (imageUrl != null) {
            AsyncImage(
                model = imageUrl,
                contentDescription = null,
                modifier = Modifier.fillMaxSize()
            )
        }

        // 上层：视频播放器（仅长按时显示）。player 懒加载，松手后变 null 自动移除。
        if (player != null) {
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
                update = { view ->
                    if (view.player !== player) {
                        view.player = player
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
