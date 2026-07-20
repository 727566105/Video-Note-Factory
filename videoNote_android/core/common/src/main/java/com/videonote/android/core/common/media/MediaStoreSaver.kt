package com.videonote.android.core.common.media

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File

/**
 * MediaStore 写入封装：把文件写入系统相册（Pictures/VideoNote 或 Movies/VideoNote）。
 *
 * 关键点：
 * - minSdk 31 用 MediaStore 写入不需要 WRITE_EXTERNAL_STORAGE 权限
 * - API 29+ 调用 ContentResolver.insert + openOutputStream 写入
 * - 写入完成后返回 content Uri，系统相册会自动扫描识别
 * - **异常安全**：任何写入失败都会 delete 已插入的 Uri，避免 IS_PENDING=1 孤儿条目（修复 B3）
 *
 * 文件路径：
 * - 图片：Pictures/VideoNote/{filename}
 * - 视频：Movies/VideoNote/{filename}
 */
object MediaStoreSaver {

    private const val IMAGE_DIR = "VideoNote"
    private const val VIDEO_DIR = "VideoNote"

    /**
     * 保存图片到相册。
     *
     * @param context 任意 Context
     * @param file 源文件（JPEG/PNG/WebP）
     * @param filename 文件名（如 "note_xxx_1.jpg"），不含路径
     * @param mimeType 如 "image/jpeg"
     * @return 写入后的 content Uri
     * @throws RuntimeException 如果 MediaStore 插入失败或写入失败（已清理半成品）
     */
    fun saveImage(context: Context, file: File, filename: String, mimeType: String = "image/jpeg"): Uri {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, mimeType)
            // minSdk 31 > Q=29，RELATIVE_PATH 和 IS_PENDING 无条件可用
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$IMAGE_DIR")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val itemUri = resolver.insert(collection, values)
            ?: throw RuntimeException("MediaStore 插入图片失败（可能权限被拒）")

        try {
            resolver.openOutputStream(itemUri)?.use { out ->
                file.inputStream().use { it.copyTo(out) }
            } ?: throw RuntimeException("打开 MediaStore 输出流失败")
        } catch (e: Exception) {
            // 修复 B3：写入失败时删除半成品 Uri，避免 IS_PENDING=1 孤儿条目
            resolver.delete(itemUri, null, null)
            throw RuntimeException("图片写入失败: ${e.message}", e)
        }

        // 写入成功，置 IS_PENDING=0 让相册扫描
        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(itemUri, values, null, null)
        return itemUri
    }

    /**
     * 保存视频到相册。
     */
    fun saveVideo(context: Context, file: File, filename: String, mimeType: String = "video/mp4"): Uri {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, filename)
            put(MediaStore.Video.Media.MIME_TYPE, mimeType)
            put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/$VIDEO_DIR")
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
        val collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        val itemUri = resolver.insert(collection, values)
            ?: throw RuntimeException("MediaStore 插入视频失败（可能权限被拒）")

        try {
            resolver.openOutputStream(itemUri)?.use { out ->
                file.inputStream().use { it.copyTo(out) }
            } ?: throw RuntimeException("打开 MediaStore 输出流失败")
        } catch (e: Exception) {
            resolver.delete(itemUri, null, null)
            throw RuntimeException("视频写入失败: ${e.message}", e)
        }

        values.clear()
        values.put(MediaStore.Video.Media.IS_PENDING, 0)
        resolver.update(itemUri, values, null, null)
        return itemUri
    }

    // ==================== vivo OriginOS 实况照片方案 ====================
    //
    // 技术文档（独家逆向，开源社区无此资料，2026-07-21 确认可用）
    //
    // vivo OriginOS 的实况照片与 Google MotionPhoto / Apple Live Photo 完全不同：
    //
    // 1. 文件结构：两份独立文件
    //    - xxx.jpg（纯 JPEG 静态图）
    //    - xxx.mp4（纯 MP4 实况视频）
    //    - 必须在同一目录，文件名前缀相同（仅扩展名不同）
    //
    // 2. MediaStore live_photo 字段（vivo 自定义隐藏列）
    //    - 格式：<13位毫秒时间戳>000000000000000（28 位）
    //    - 图片记录和视频记录都要写，且值必须完全相同
    //    - 缺一不可：只写图片 -> 相册显示 2 份；都写且值相同 -> 相册合并为 1 个实况照片
    //
    // 3. 写入坑：live_photo 是隐藏列，ContentValues.put("live_photo", ...) 在 insert 时
    //    会被 MediaStore 过滤（不报错但不写入）。必须先 insert + 写文件 + IS_PENDING=0，
    //    然后用 ContentResolver.update() 单独写入 live_photo 字段。
    //
    // 适配其他厂商时参考：
    // - OPPO：可能也有类似 live_photo 自定义列，调研方法见 vivo-live-photo-spec.md
    // - 小米：支持 Google MotionPhoto XMP 格式（GCamera:MicroVideoOffset）
    // - 华为：有自己的 LivePhoto API
    // ===================================================================

    /**
     * 保存实况照片的图片部分，并写入 vivo OriginOS 的 live_photo 标识字段。
     *
     * vivo 实况照片机制（与 Google MotionPhoto 完全不同）：
     * 1. 保存两份独立文件：xxx.jpg（图片）+ xxx.mp4（视频），同目录同前缀
     * 2. 在图片的 MediaStore 记录里设 live_photo 字段（格式：`<13位毫秒时间戳>000000000000000`）
     * 3. vivo 相册扫描时发现 live_photo 有值 + 同目录有同名 .mp4，就识别为实况照片
     *
     * @param context Context
     * @param imageFile 静态图 JPEG 文件
     * @param videoFile 实况视频 MP4 文件
     * @param baseFilename 文件名（不含扩展名，如 "live_photo_1"）
     * @return LivePhotoUris（图片 Uri + 视频 Uri）
     */
    fun saveLivePhotoVivo(
        context: Context,
        imageFile: File,
        videoFile: File,
        baseFilename: String
    ): LivePhotoUris {
        val resolver = context.contentResolver
        val timestamp = System.currentTimeMillis()
        // vivo live_photo 格式：<13位毫秒时间戳> + 15个0
        val livePhotoValue = "${timestamp}000000000000000"

        // 1. 保存图片到 Pictures/VideoNote/
        val imageValues = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, "$baseFilename.jpg")
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$IMAGE_DIR")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val imageUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, imageValues)
            ?: throw RuntimeException("MediaStore 插入实况图片失败")

        try {
            resolver.openOutputStream(imageUri)?.use { out ->
                imageFile.inputStream().use { it.copyTo(out) }
            } ?: throw RuntimeException("打开图片输出流失败")
        } catch (e: Exception) {
            resolver.delete(imageUri, null, null)
            throw RuntimeException("实况图片写入失败: ${e.message}", e)
        }

        // 2. 保存视频到同一个目录 Pictures/VideoNote/（vivo 要求同目录同前缀）
        val videoValues = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, "$baseFilename.mp4")
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$IMAGE_DIR")
            put(MediaStore.Video.Media.IS_PENDING, 1)
        }
        val videoUri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, videoValues)
            ?: throw RuntimeException("MediaStore 插入实况视频失败")

        try {
            resolver.openOutputStream(videoUri)?.use { out ->
                videoFile.inputStream().use { it.copyTo(out) }
            } ?: throw RuntimeException("打开视频输出流失败")
        } catch (e: Exception) {
            resolver.delete(imageUri, null, null)
            resolver.delete(videoUri, null, null)
            throw RuntimeException("实况视频写入失败: ${e.message}", e)
        }

        // 3. 在图片记录里写入 live_photo 标识字段（vivo 识别关键）
        // 先用 IS_PENDING=0 让文件可见
        imageValues.clear()
        imageValues.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(imageUri, imageValues, null, null)

        // vivo 的 live_photo 是自定义隐藏列，ContentValues.put("live_photo", ...) 在 insert 时
        // 会被 MediaStore 过滤掉，需要用 ContentResolver.update 单独写入
        try {
            val liveValues = ContentValues().apply {
                put("live_photo", livePhotoValue)
            }
            val updated = resolver.update(imageUri, liveValues, null, null)
            android.util.Log.i("MediaStoreSaver", "live_photo 字段写入: updated=$updated uri=$imageUri value=$livePhotoValue")
        } catch (e: Exception) {
            android.util.Log.w("MediaStoreSaver", "live_photo 字段写入失败（可能不支持）: ${e.message}")
        }

        // 4. 视频记录置 IS_PENDING=0 + 写入 live_photo 字段（与图片相同的值，vivo 靠此关联）
        videoValues.clear()
        videoValues.put(MediaStore.Video.Media.IS_PENDING, 0)
        resolver.update(videoUri, videoValues, null, null)

        // vivo: 视频记录也要写 live_photo（与图片相同的值），相册才不会把视频单独显示
        try {
            val videoLiveValues = ContentValues().apply {
                put("live_photo", livePhotoValue)
            }
            val videoUpdated = resolver.update(videoUri, videoLiveValues, null, null)
            android.util.Log.i("MediaStoreSaver", "video live_photo 字段写入: updated=$videoUpdated uri=$videoUri")
        } catch (e: Exception) {
            android.util.Log.w("MediaStoreSaver", "video live_photo 字段写入失败: ${e.message}")
        }

        return LivePhotoUris(imageUri = imageUri, videoUri = videoUri)
    }

    /**
     * 实况照片保存结果（双文件方案）
     */
    data class LivePhotoUris(
        val imageUri: Uri,
        val videoUri: Uri
    )

    /**
     * 保存 MotionPhoto（Live Photo）到相册。
     *
     * MotionPhoto 格式：JPEG 数据 + MP4 数据 + XMP 元数据标记。
     * Google Photos 等相册应用会识别为 Live Photo。
     *
     * @param motionPhotoBytes 合成好的 MotionPhoto 字节流（JPEG + MP4 + XMP）
     * @param filename 文件名（如 "live_photo_1MP.jpg"），扩展名必须 .jpg
     * @return content Uri
     */
    fun saveMotionPhoto(context: Context, motionPhotoBytes: ByteArray, filename: String): Uri {
        require(filename.endsWith(".jpg", ignoreCase = true) || filename.endsWith(".jpeg", ignoreCase = true)) {
            "MotionPhoto 文件名必须以 .jpg 或 .jpeg 结尾，实际：$filename"
        }
        require(motionPhotoBytes.isNotEmpty()) {
            "MotionPhoto 字节流为空"
        }
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$IMAGE_DIR")
            put(MediaStore.Images.Media.IS_PENDING, 1)
        }
        val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val itemUri = resolver.insert(collection, values)
            ?: throw RuntimeException("MediaStore 插入 MotionPhoto 失败")

        try {
            resolver.openOutputStream(itemUri)?.use { out ->
                out.write(motionPhotoBytes)
            } ?: throw RuntimeException("打开 MediaStore 输出流失败")
        } catch (e: Exception) {
            // 修复 B3：写入失败时删除半成品
            resolver.delete(itemUri, null, null)
            throw RuntimeException("MotionPhoto 写入失败: ${e.message}", e)
        }

        values.clear()
        values.put(MediaStore.Images.Media.IS_PENDING, 0)
        resolver.update(itemUri, values, null, null)
        return itemUri
    }
}
