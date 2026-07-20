package com.videonote.android.core.common

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.videonote.android.core.network.SessionManager
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 图片代理 URL 构造器
 *
 * B站、抖音等平台的封面图有 Referer 校验，直接加载会 403。
 * 通过后端图片代理 GET /api/image_proxy?url=... 加载，后端自动处理 Referer。
 *
 * 使用方式（Composable）：
 *   val imageProxyHelper = rememberImageProxyHelper()
 *   AsyncImage(model = imageProxyHelper.getProxyUrl(coverUrl, platform), ...)
 */
@Singleton
class ImageProxyHelper @Inject constructor(
    private val sessionManager: SessionManager
) {
    fun getProxyUrl(originalUrl: String?, platform: String?): String? {
        if (originalUrl == null) return null

        // 1. 后端返回的相对路径（如 /api/video_cover/bilibili/.../xxx）：
        //    需要拼接 serverUrl 让 Coil 能解析 host，否则 Coil 拿到 "/api/..." 没法加载
        if (originalUrl.startsWith("/")) {
            val serverUrl = sessionManager.serverUrl.value ?: return originalUrl
            return "${serverUrl.trimEnd('/')}$originalUrl"
        }

        // 2. 已经是绝对 URL（http/https），按平台判断是否需要代理
        // 不需要代理的平台直接返回原 URL
        if (!PlatformDetector.needsImageProxy(platform)) return originalUrl

        val serverUrl = sessionManager.serverUrl.value ?: return originalUrl
        val encoded = URLEncoder.encode(originalUrl, "UTF-8")
        return "${serverUrl}/api/image_proxy?url=$encoded"
    }

    /**
     * 把后端相对路径转成绝对 URL（用于下载、视频播放等场景）。
     *
     * 与 getProxyUrl 的区别：
     * - getProxyUrl 处理"图片显示"，对 Referer 敏感平台会走 image_proxy 包装
     * - resolveUrl 处理"文件下载/视频播放"，对相对路径仅做拼接，对绝对 URL 原样返回
     *
     * 后端 /api/note_media_file / /api/video_file / /api/video_cover 全部无鉴权 + 支持 Range，
     * 不需要走 image_proxy（直接访问更高效，且 ExoPlayer 能 seek）。
     *
     * @return 绝对 URL，url 为 null 或 serverUrl 未配置时返回 null
     */
    fun resolveUrl(url: String?): String? {
        if (url == null) return null
        if (url.startsWith("http://") || url.startsWith("https://")) return url
        if (url.startsWith("/")) {
            val serverUrl = sessionManager.serverUrl.value ?: return null
            return "${serverUrl.trimEnd('/')}$url"
        }
        val serverUrl = sessionManager.serverUrl.value ?: return url
        return "${serverUrl.trimEnd('/')}/$url"
    }

    /**
     * 静态版本（用于无 Hilt 注入的场景）
     */
    companion object {
        fun buildProxyUrl(serverUrl: String, originalUrl: String): String {
            val encoded = URLEncoder.encode(originalUrl, "UTF-8")
            return "${serverUrl}/api/image_proxy?url=$encoded"
        }
    }
}

/// Hilt EntryPoint：让非 ViewModel 的 Composable 也能拿到 ImageProxyHelper 单例。
/// 注意：不能用 hiltViewModel() 注入，因为 ImageProxyHelper 不是 ViewModel。
@EntryPoint
@InstallIn(SingletonComponent::class)
interface ImageProxyHelperEntryPoint {
    fun imageProxyHelper(): ImageProxyHelper
}

/**
 * 在 Composable 中获取 ImageProxyHelper 单例。
 * 用 remember 缓存，避免每次 recompose 都查容器。
 */
@Composable
fun rememberImageProxyHelper(): ImageProxyHelper {
    val context = LocalContext.current
    return remember(context) {
        val appContext = context.applicationContext
        EntryPointAccessors.fromApplication(
            appContext,
            ImageProxyHelperEntryPoint::class.java
        ).imageProxyHelper()
    }
}

