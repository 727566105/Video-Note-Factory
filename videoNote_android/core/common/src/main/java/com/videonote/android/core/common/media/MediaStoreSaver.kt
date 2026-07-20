package com.videonote.android.core.common.media

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import java.io.File
import java.io.InputStream

/**
 * MediaStore 写入封装：把文件写入系统相册（Pictures/VideoNote 或 Movies/VideoNote）。
 *
 * 关键点：
 * - minSdk 31 用 MediaStore 写入不需要 WRITE_EXTERNAL_STORAGE 权限
 * - API 29+ 调用 ContentResolver.insert + openOutputStream 写入
 * - 写入完成后返回 content Uri，系统相册会自动扫描识别
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
     */
    fun saveImage(context: Context, file: File, filename: String, mimeType: String = "image/jpeg"): Uri {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, mimeType)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$IMAGE_DIR")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }
        val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val itemUri = resolver.insert(collection, values)
            ?: throw RuntimeException("MediaStore 插入图片失败（可能权限被拒）")

        resolver.openOutputStream(itemUri)?.use { out ->
            file.inputStream().use { it.copyTo(out) }
        } ?: throw RuntimeException("打开 MediaStore 输出流失败")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(itemUri, values, null, null)
        }
        return itemUri
    }

    /**
     * 保存视频到相册。
     *
     * @param file 源文件（MP4/WebM）
     * @param filename 文件名（如 "note_xxx_video.mp4"），不含路径
     * @param mimeType 如 "video/mp4"
     * @return 写入后的 content Uri
     */
    fun saveVideo(context: Context, file: File, filename: String, mimeType: String = "video/mp4"): Uri {
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, filename)
            put(MediaStore.Video.Media.MIME_TYPE, mimeType)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/$VIDEO_DIR")
                put(MediaStore.Video.Media.IS_PENDING, 1)
            }
        }
        val collection = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        val itemUri = resolver.insert(collection, values)
            ?: throw RuntimeException("MediaStore 插入视频失败（可能权限被拒）")

        resolver.openOutputStream(itemUri)?.use { out ->
            file.inputStream().use { it.copyTo(out) }
        } ?: throw RuntimeException("打开 MediaStore 输出流失败")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.Video.Media.IS_PENDING, 0)
            resolver.update(itemUri, values, null, null)
        }
        return itemUri
    }

    /**
     * 保存 MotionPhoto（Live Photo）到相册（仅 Android 14+ API 34+）。
     *
     * MotionPhoto 格式：JPEG 数据 + MP4 数据 + XMP 元数据标记。
     * Google Photos 等相册应用会识别为 Live Photo。
     *
     * @param motionPhotoBytes 合成好的 MotionPhoto 字节流（JPEG + MP4 + XMP）
     * @param filename 文件名（如 "live_photo_1.jpg"），扩展名必须 .jpg
     * @return content Uri
     */
    fun saveMotionPhoto(context: Context, motionPhotoBytes: ByteArray, filename: String): Uri {
        require(filename.endsWith(".jpg", ignoreCase = true) || filename.endsWith(".jpeg", ignoreCase = true)) {
            "MotionPhoto 文件名必须以 .jpg 或 .jpeg 结尾，实际：$filename"
        }
        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, filename)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/$IMAGE_DIR")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }
        val collection = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        val itemUri = resolver.insert(collection, values)
            ?: throw RuntimeException("MediaStore 插入 MotionPhoto 失败")

        resolver.openOutputStream(itemUri)?.use { out ->
            out.write(motionPhotoBytes)
        } ?: throw RuntimeException("打开 MediaStore 输出流失败")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(itemUri, values, null, null)
        }
        return itemUri
    }
}
