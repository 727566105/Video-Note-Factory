package com.videonote.android

import android.app.Application
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.disk.DiskCache
import coil.memory.MemoryCache
import com.videonote.android.core.network.interceptor.AuthInterceptor
import dagger.hilt.android.HiltAndroidApp
import okhttp3.OkHttpClient
import javax.inject.Inject
import java.util.concurrent.TimeUnit

/**
 * 自定义 Application：Hilt 入口 + Coil 全局 ImageLoader 工厂。
 *
 * 实现 ImageLoaderFactory 接口让 AsyncImage 默认用我们的 ImageLoader（带 AuthInterceptor），
 * 否则 AsyncImage 会用 Coil 的默认 ImageLoader（没 OkHttp 配置 + 没 Auth header），
 * 导致所有 /api/video_cover/... 和 /api/image_proxy?url=... 请求 401 失败，图片不显示。
 */
@HiltAndroidApp
class VideoNoteApp : Application(), ImageLoaderFactory {

    @Inject
    lateinit var authInterceptor: AuthInterceptor

    override fun newImageLoader(): ImageLoader {
        // 必须带 AuthInterceptor，因为后端 /api/video_cover 和 /api/image_proxy 都需要 Bearer token
        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()

        return ImageLoader.Builder(this)
            .okHttpClient(client)
            .memoryCache {
                MemoryCache.Builder(this).maxSizePercent(0.25).build()
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(cacheDir.resolve("image_cache"))
                    .maxSizeBytes(100L * 1024 * 1024)
                    .build()
            }
            .crossfade(true)
            .build()
    }
}
