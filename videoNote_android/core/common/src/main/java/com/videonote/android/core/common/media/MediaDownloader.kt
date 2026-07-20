package com.videonote.android.core.common.media

import android.content.Context
import android.net.Uri
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.network.SessionManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.Result.Companion.failure
import kotlin.Result.Companion.success

/**
 * 媒体下载结果（Live Photo 场景）
 */
data class LivePhotoSaveResult(
    /** MotionPhoto 合成 Uri（Android 14+）。Android 14 以下为 null */
    val motionPhotoUri: Uri?,
    /** 降级方案的图片 Uri（Android 14 以下）。Android 14+ 为 null */
    val imageUri: Uri?,
    /** 降级方案的视频 Uri（Android 14 以下）。Android 14+ 为 null */
    val videoUri: Uri?
) {
    /** 任一 Uri 写入成功 */
    val isSuccess: Boolean get() = motionPhotoUri != null || (imageUri != null && videoUri != null)
}

/**
 * 媒体下载器：把后端媒体文件下载到本地，并写入系统相册（MediaStore）。
 *
 * 流程：
 *   1. OkHttp 流式下载到 cacheDir（带进度回调）
 *   2. 用 MediaStoreSaver 写入相册（Pictures/Movies 下的 VideoNote 子目录）
 *
 * 关键点：
 * - 复用 NetworkModule 的 OkHttpClient，自动带 AuthInterceptor（虽然大部分媒体接口无鉴权，但保险）
 * - 临时文件放 cacheDir/media_cache，下载成功后转存 MediaStore，最后删临时文件
 * - Live Photo：
 *   - Android 14+ 用 MotionPhotoWriter 合成单文件（JPEG+MP4+XMP）-> MediaStore.Images
 *   - Android 14 以下分别保存 JPEG 和 MP4 两份
 *
 * 注意：
 * - 调用方需先申请 READ_MEDIA_IMAGES / READ_MEDIA_VIDEO / POST_NOTIFICATIONS 权限
 * - 本类只负责文件写入，不负责权限请求（由 UI 层处理）
 */
@Singleton
class MediaDownloader @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val imageProxyHelper: ImageProxyHelper,
    private val sessionManager: SessionManager
) {

    /**
     * 流式下载文件到 cacheDir。
     *
     * @param url 相对路径或绝对 URL（内部用 imageProxyHelper.resolveUrl 转绝对）
     * @param filename 临时文件名（如 "video_xxx.mp4"）
     * @param onProgress 进度回调 0f..1f（每 100KB 回调一次）
     * @return 下载的 File，失败返回 Result.failure
     */
    suspend fun downloadToCache(
        url: String,
        filename: String,
        onProgress: (Float) -> Unit = {}
    ): Result<File> = withContext(Dispatchers.IO) {
        try {
            val absoluteUrl = imageProxyHelper.resolveUrl(url)
                ?: return@withContext failure(IllegalStateException("无法解析 URL：$url（serverUrl 未配置？）"))

            val cacheDir = File(System.getProperty("java.io.tmpdir") ?: "/tmp")
                .let { File(it, "videonote_media") }
            cacheDir.mkdirs()
            val destFile = File(cacheDir, filename)
            if (destFile.exists()) destFile.delete()

            val request = Request.Builder().url(absoluteUrl).build()
            val response = okHttpClient.newCall(request).execute()
            if (!response.isSuccessful) {
                return@withContext failure(RuntimeException("下载失败：HTTP ${response.code}"))
            }
            val body = response.body ?: return@withContext failure(RuntimeException("响应体为空"))

            body.byteStream().use { input ->
                destFile.outputStream().use { output ->
                    val buffer = ByteArray(8 * 1024)
                    var bytesRead: Int
                    var totalBytes = 0L
                    val contentLength = body.contentLength()
                    while (input.read(buffer).also { bytesRead = it } != -1) {
                        output.write(buffer, 0, bytesRead)
                        totalBytes += bytesRead
                        if (contentLength > 0) {
                            val progress = totalBytes.toFloat() / contentLength
                            onProgress(progress.coerceIn(0f, 1f))
                        }
                    }
                    output.flush()
                }
            }
            success(destFile)
        } catch (e: Exception) {
            failure(e)
        }
    }

    /**
     * 保存图片到系统相册。
     * @return content Uri
     */
    suspend fun saveImageToGallery(
        context: Context,
        file: File,
        filename: String,
        mimeType: String = "image/jpeg"
    ): Result<Uri> = withContext(Dispatchers.IO) {
        try {
            val uri = MediaStoreSaver.saveImage(context, file, filename, mimeType)
            success(uri)
        } catch (e: Exception) {
            failure(e)
        }
    }

    /**
     * 保存视频到系统相册。
     */
    suspend fun saveVideoToGallery(
        context: Context,
        file: File,
        filename: String,
        mimeType: String = "video/mp4"
    ): Result<Uri> = withContext(Dispatchers.IO) {
        try {
            val uri = MediaStoreSaver.saveVideo(context, file, filename, mimeType)
            success(uri)
        } catch (e: Exception) {
            failure(e)
        }
    }

    /**
     * 保存 Live Photo。
     *
     * Android 14+：合成 MotionPhoto 单文件（JPEG+MP4+XMP），写入 MediaStore.Images，
     *              Google Photos / Pixel 系统相册识别为 Live Photo。
     * Android 14 以下：分别保存 JPEG 和 MP4 到 MediaStore.Images / MediaStore.Video，
     *              文件名同前缀（如 live_photo_1.jpg + live_photo_1.mp4）。
     *
     * @param context Context
     * @param imageFile 静态图 JPEG（cacheDir 临时文件）
     * @param videoFile 实况视频 MP4（cacheDir 临时文件）
     * @param baseFilename 文件名（不含扩展名，如 "live_photo_1"）
     * @return LivePhotoSaveResult
     */
    suspend fun saveLivePhoto(
        context: Context,
        imageFile: File,
        videoFile: File,
        baseFilename: String
    ): Result<LivePhotoSaveResult> = withContext(Dispatchers.IO) {
        try {
            if (MotionPhotoWriter.isSupported()) {
                // Android 14+：合成 MotionPhoto 单文件
                val motionBytes = MotionPhotoWriter.write(imageFile, videoFile)
                val filename = "$baseFilename.jpg"
                val uri = MediaStoreSaver.saveMotionPhoto(context, motionBytes, filename)
                success(LivePhotoSaveResult(motionPhotoUri = uri, imageUri = null, videoUri = null))
            } else {
                // Android 14 以下：双文件保存
                val imageUri = MediaStoreSaver.saveImage(context, imageFile, "$baseFilename.jpg")
                val videoUri = MediaStoreSaver.saveVideo(context, videoFile, "$baseFilename.mp4")
                success(LivePhotoSaveResult(motionPhotoUri = null, imageUri = imageUri, videoUri = videoUri))
            }
        } catch (e: Exception) {
            failure(e)
        }
    }

    /**
     * 生成唯一临时文件名。
     */
    fun genFilename(prefix: String, ext: String): String {
        return "${prefix}_${UUID.randomUUID().toString().take(8)}.$ext"
    }
}
