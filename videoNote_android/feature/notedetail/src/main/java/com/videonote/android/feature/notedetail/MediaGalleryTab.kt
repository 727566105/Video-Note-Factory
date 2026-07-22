package com.videonote.android.feature.notedetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.theme.XaiBg
import com.videonote.android.core.designsystem.theme.XaiBorder
import com.videonote.android.core.designsystem.theme.XaiFg
import com.videonote.android.core.designsystem.theme.XaiFg2
import com.videonote.android.core.designsystem.theme.XaiMuted
import com.videonote.android.core.designsystem.theme.XaiSurfaceWarm
import com.videonote.android.core.network.dto.NoteMediaResponse

/**
 * 原图 Tab 内容：单列大图流。
 *
 * 每项布局：
 * - 全宽大图（高度按屏幕宽度的 4:3 比例，实况图可长按播放）
 * - 图下方：序号（#1）+ 实况标识（如有）+ 下载按钮
 *
 * 点击图片打开 FullScreenImageViewer 全屏查看。
 *
 * @param media 媒体响应（含 images + live_photos）
 * @param imageProxyHelper 用于 resolveUrl
 * @param onImageClick 点击图片（参数：图片序号从 1 开始）
 * @param onDownloadImage 下载图片
 * @param onDownloadLivePhoto 下载实况图
 */
@Composable
fun MediaGalleryTab(
    media: NoteMediaResponse,
    imageProxyHelper: ImageProxyHelper,
    onImageClick: (index: Int) -> Unit,
    onDownloadImage: (imageUrl: String, index: Int) -> Unit,
    onDownloadLivePhoto: (imageUrl: String, videoUrl: String, index: Int) -> Unit
) {
    val images = media.images
    if (images.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize().padding(40.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "暂无图片",
                style = TextStyle(fontSize = 14.sp, fontFamily = FontFamily.Monospace),
                color = XaiMuted
            )
        }
        return
    }

    val density = LocalDensity.current
    val screenWidthPx = with(density) { LocalConfiguration.current.screenWidthDp.dp.toPx() }
    // 图片高度按 4:3 比例（横图）或 3:4（竖图）。抖音/小红书图文多为竖图，用 4:5 比例更合适
    val imageHeightDp = with(density) { (screenWidthPx * 5f / 4f).toDp() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp)
    ) {
        itemsIndexed(images, key = { idx, url -> url }) { idx, imgPath ->
            val imgIndex = extractImageIndex(imgPath) ?: (idx + 1)
            val livePhoto = media.live_photos.firstOrNull { it.index == imgIndex }
            val resolvedImg = imageProxyHelper.resolveUrl(imgPath)
            val resolvedVid = imageProxyHelper.resolveUrl(livePhoto?.video_url)

            Column(modifier = Modifier.fillMaxWidth()) {
                // 大图（全宽，固定比例）
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(imageHeightDp)
                        .background(XaiSurfaceWarm)
                        .border(1.dp, XaiBorder)
                        .clickable { onImageClick(imgIndex) }
                ) {
                    if (livePhoto != null && resolvedVid != null && resolvedImg != null) {
                        // 实况图：长按播放
                        LivePhotoPlayer(
                            imageUrl = resolvedImg,
                            videoUrl = resolvedVid,
                            modifier = Modifier.fillMaxSize()
                        )
                    } else if (resolvedImg != null) {
                        // 普通图片
                        AsyncImage(
                            model = ImageRequest.Builder(LocalContext.current)
                                .data(resolvedImg)
                                .crossfade(true)
                                .build(),
                            contentDescription = null,
                            modifier = Modifier.fillMaxSize(),
                            contentScale = ContentScale.Crop
                        )
                    }
                }

                // 图下方信息条：序号 + 实况标识 + 下载按钮
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // 左侧：序号 + 实况标识
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "#${imgIndex}",
                            style = TextStyle(
                                fontSize = 13.sp,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Medium
                            ),
                            color = XaiFg
                        )
                        if (livePhoto != null) {
                            Spacer(Modifier.width(8.dp))
                            Text(
                                text = "实况",
                                style = TextStyle(
                                    fontSize = 11.sp,
                                    fontFamily = FontFamily.Monospace
                                ),
                                color = XaiMuted
                            )
                        }
                    }

                    // 右侧：下载按钮
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(2.dp))
                            .clickable {
                                if (livePhoto != null && resolvedVid != null) {
                                    onDownloadLivePhoto(imgPath, livePhoto.video_url, imgIndex)
                                } else {
                                    onDownloadImage(imgPath, imgIndex)
                                }
                            }
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Download,
                            contentDescription = "下载",
                            tint = XaiFg2,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(
                            text = "保存",
                            style = TextStyle(fontSize = 12.sp),
                            color = XaiFg2
                        )
                    }
                }
            }
        }

        // 底部留白
        item { Spacer(Modifier.height(40.dp)) }
    }
}

/**
 * 从图片 URL 中提取文件名里的数字索引。
 */
private fun extractImageIndex(imageUrl: String): Int? {
    val filename = imageUrl.substringAfterLast('/')
    val regex = Regex("image_(\\d+)\\.")
    val match = regex.find(filename)
    return match?.groupValues?.get(1)?.toIntOrNull()
}
