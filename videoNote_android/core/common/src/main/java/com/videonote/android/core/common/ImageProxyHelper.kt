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
        // 不需要代理的平台直接返回原 URL
        if (!PlatformDetector.needsImageProxy(platform)) return originalUrl

        val serverUrl = sessionManager.serverUrl.value ?: return originalUrl
        val encoded = URLEncoder.encode(originalUrl, "UTF-8")
        return "${serverUrl}/api/image_proxy?url=$encoded"
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

