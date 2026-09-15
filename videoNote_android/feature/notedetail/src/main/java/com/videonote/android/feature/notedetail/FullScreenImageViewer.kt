package com.videonote.android.feature.notedetail

import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Download
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.theme.XaiBg
import com.videonote.android.core.designsystem.theme.XaiFg
import com.videonote.android.core.designsystem.theme.XaiMuted
import com.videonote.android.core.network.dto.LivePhotoItem
import com.videonote.android.core.network.dto.NoteMediaResponse
import kotlinx.coroutines.launch

private const val TAG = "FullScreenImageViewer"

/**
 * 全屏图片查看器：
 * - 左右滑动切换图片（HorizontalPager）
 * - pinch-to-zoom 双指缩放
 * - 双击复位
 * - 实况图长按播放实况视频
 * - 顶部显示序号 "1 / 70"
 * - 右上角下载按钮
 *
 * @param media 媒体响应（含 images + live_photos）
 * @param initialIndex 初始显示的图片序号（从 1 开始）
 * @param imageProxyHelper 用于 resolveUrl
 * @param onDismiss 关闭回调
 * @param onDownloadImage 点击下载图片
 * @param onDownloadLivePhoto 点击下载实况图
 */
@Composable
fun FullScreenImageViewer(
    media: NoteMediaResponse,
    initialIndex: Int,
    imageProxyHelper: ImageProxyHelper,
    onDismiss: () -> Unit,
    onDownloadImage: (imageUrl: String, index: Int) -> Unit,
    onDownloadLivePhoto: (imageUrl: String, videoUrl: String, index: Int) -> Unit
) {
    val images = media.images
    if (images.isEmpty()) {
        onDismiss()
        return
    }

    // 确保 initialIndex 在有效范围内
    val startIndex = (initialIndex - 1).coerceIn(0, images.lastIndex)
    val pagerState = rememberPagerState(initialPage = startIndex, pageCount = { images.size })
    val scope = rememberCoroutineScope()
    var uiVisible by remember { mutableStateOf(true) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black)
    ) {
        // 图片 pager
        HorizontalPager(
            state = pagerState,
            modifier = Modifier.fillMaxSize()
        ) { page ->
            val imgPath = images[page]
            val imgIndex = extractImageIndex(imgPath) ?: (page + 1)
            val livePhoto = media.live_photos.firstOrNull { it.index == imgIndex }
            val resolvedImg = imageProxyHelper.resolveUrl(imgPath)
            val resolvedVid = imageProxyHelper.resolveUrl(livePhoto?.video_url)

            // 单张图片的 zoom + pan 状态
            var scale by remember(page) { mutableStateOf(1f) }
            var offsetX by remember(page) { mutableStateOf(0f) }
            var offsetY by remember(page) { mutableStateOf(0f) }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(page) {
                        detectTransformGestures { _, pan, zoom, _ ->
                            scale = (scale * zoom).coerceIn(1f, 5f)
                            if (scale > 1f) {
                                offsetX += pan.x
                                offsetY += pan.y
                            } else {
                                offsetX = 0f
                                offsetY = 0f
                            }
                        }
                    }
                    .pointerInput(page) {
                        detectTapGestures(
                            onDoubleTap = {
                                // 双击复位
                                scale = if (scale > 1f) 1f else 2f
                                if (scale == 1f) {
                                    offsetX = 0f
                                    offsetY = 0f
                                }
                            },
                            onTap = {
                                // 单击切换 UI 显隐
                                uiVisible = !uiVisible
                            }
                        )
                    }
            ) {
                if (livePhoto != null && resolvedVid != null && resolvedImg != null) {
                    // 实况图：长按播放
                    LivePhotoPlayer(
                        imageUrl = resolvedImg,
                        videoUrl = resolvedVid,
                        modifier = Modifier
                            .fillMaxSize()
                            .graphicsLayer(
                                scaleX = scale,
                                scaleY = scale,
                                translationX = offsetX,
                                translationY = offsetY
                            )
                    )
                } else if (resolvedImg != null) {
                    // 普通图片
                    AsyncImage(
                        model = ImageRequest.Builder(LocalContext.current)
                            .data(resolvedImg)
                            .crossfade(true)
                            .build(),
                        contentDescription = null,
                        modifier = Modifier
                            .fillMaxSize()
                            .graphicsLayer(
                                scaleX = scale,
                                scaleY = scale,
                                translationX = offsetX,
                                translationY = offsetY
                            ),
                        contentScale = ContentScale.Fit
                    )
                }
            }
        }

        // 顶部 UI：关闭按钮 + 序号（可隐藏）
        AnimatedVisibility(
            visible = uiVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.TopCenter)
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // 关闭按钮
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.2f))
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Close,
                        contentDescription = "关闭",
                        tint = Color.White,
                        modifier = Modifier.size(20.dp)
                    )
                }
                // 序号 "3 / 70"
                Text(
                    text = "${pagerState.currentPage + 1} / ${images.size}",
                    style = TextStyle(
                        fontSize = 14.sp,
                        fontFamily = FontFamily.Monospace
                    ),
                    color = Color.White
                )
                // 占位（保持序号居中）
                Spacer(Modifier.size(36.dp))
            }
        }

        // 底部下载按钮（可隐藏）
        AnimatedVisibility(
            visible = uiVisible,
            enter = fadeIn(),
            exit = fadeOut(),
            modifier = Modifier.align(Alignment.BottomCenter)
        ) {
            val currentPage = pagerState.currentPage
            val currentImgPath = images.getOrNull(currentPage)
            val currentImgIndex = currentImgPath?.let { extractImageIndex(it) } ?: (currentPage + 1)
            val currentLivePhoto = media.live_photos.firstOrNull { it.index == currentImgIndex }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.Black.copy(alpha = 0.5f))
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // 左侧：实况标识（如果是实况图）
                if (currentLivePhoto != null) {
                    Text(
                        text = "实况图 #${currentImgIndex}",
                        style = TextStyle(
                            fontSize = 12.sp,
                            fontFamily = FontFamily.Monospace
                        ),
                        color = XaiMuted
                    )
                } else {
                    Spacer(Modifier.size(80.dp))
                }

                // 右侧：下载按钮
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(2.dp))
                        .background(Color.White.copy(alpha = 0.2f))
                        .clickable {
                            if (currentImgPath != null) {
                                if (currentLivePhoto != null) {
                                    onDownloadLivePhoto(
                                        currentImgPath,
                                        currentLivePhoto.video_url,
                                        currentImgIndex
                                    )
                                } else {
                                    onDownloadImage(currentImgPath, currentImgIndex)
                                }
                            }
                        }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.Download,
                            contentDescription = "下载",
                            tint = Color.White,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "保存",
                            style = TextStyle(fontSize = 13.sp),
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

/**
 * 从图片 URL 中提取文件名里的数字索引。
 * 例如 "/api/note_media_file/.../image_42.jpg" -> 42
 *
 * 后端 images 数组按文件名字符串排序（image_1, image_10, image_11, ..., image_2），
 * 不能用数组下标配对 live_photos，必须用文件名里的数字。
 */
private fun extractImageIndex(imageUrl: String): Int? {
    val filename = imageUrl.substringAfterLast('/')
    val regex = Regex("image_(\\d+)\\.")
    val match = regex.find(filename)
    return match?.groupValues?.get(1)?.toIntOrNull()
}
