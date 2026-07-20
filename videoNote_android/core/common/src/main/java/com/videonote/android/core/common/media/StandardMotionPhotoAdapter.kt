package com.videonote.android.core.common.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * 标准 Android Motion Photo 1.0 适配器。
 *
 * 输出文件结构（单文件 .jpg）：
 * ```
 * [JPEG 字节流 + APP1 XMP 段] [MP4 视频字节流]
 *                          ↑
 *                   XMP 含 GCamera:MotionPhoto=1
 *                   XMP 含 Container:Directory 数组
 * ```
 *
 * XMP 元数据关键属性（按 Android 官方规范 motion-photo-format）：
 *
 * Camera 命名空间（`http://ns.google.com/photos/1.0/camera/`）：
 * - `GCamera:MotionPhoto = 1` - 标识为动态照片
 * - `GCamera:MotionPhotoVersion = 1` - 规范版本
 * - `GCamera:MotionPhotoPresentationTimestampUs = 0` - 静态帧时间戳
 *
 * Container 命名空间（`http://ns.google.com/photos/1.0/container/`）：
 * - `Container:Directory` - rdf:Seq 数组，含两个 Item
 *   - Item[1]：{ Mime=image/jpeg, Semantic=Primary, Length=<JPEG 部分字节数> }
 *   - Item[2]：{ Mime=video/mp4, Semantic=MotionPhoto, Length=<视频字节长度> }
 *
 * 兼容性（实测/官方）：
 * - Google Pixel 系统相册 ✅ 完整支持（长按播放）
 * - Google Photos ✅ 完整支持
 * - vivo OriginOS ✅ 支持（长按播放，自动识别为实况）
 * - 小米 MIUI / HyperOS ✅ 支持
 * - OPPO ColorOS ✅ 支持（基础识别）
 * - Android 14+ 系统相册 ✅ 支持
 *
 * 注意：MotionPhoto 规范要求主图片必须是 JPEG/HEIC/AVIF。
 * 抖音等平台的 image_*.jpg 实际是 WebP 格式（文件名 .jpg 但内容是 RIFF...WEBP），
 * 本适配器在合成前会自动将 WebP/PNG 转为 JPEG。
 *
 * 参考：
 * - https://developer.android.com/media/platform/motion-photo-format
 * - 实测 Google/Pixel 4 样本 XMP 结构
 */
class StandardMotionPhotoAdapter : MotionPhotoAdapter {

    override val vendorName: String = "Standard"

    private val xmpNamespace = "http://ns.adobe.com/xap/1.0/\u0000"
    private val jpegSoi: Byte = 0xFF.toByte()
    private val jpegMarkerSoi: Byte = 0xD8.toByte()
    private val jpegMarkerApp1: Byte = 0xE1.toByte()

    /**
     * 单次合成允许的最大源文件大小（50MB）。
     * 超过此大小直接抛异常触发降级，避免 OOM 导致应用崩溃。
     * 实测 Live Photo 视频通常 200KB-2MB，50MB 是非常宽松的上限。
     */
    private val maxSourceFileSize: Long = 50L * 1024 * 1024

    override fun write(jpegFile: File, videoFile: File): ByteArray {
        // ========== 输入校验 ==========

        // 1. 文件存在性
        require(jpegFile.exists()) { "JPEG 文件不存在: ${jpegFile.absolutePath}" }
        require(videoFile.exists()) { "MP4 文件不存在: ${videoFile.absolutePath}" }

        // 2. 文件大小预检（防 OOM）
        require(jpegFile.length() <= maxSourceFileSize) {
            "JPEG 文件过大（${jpegFile.length()} 字节 > $maxSourceFileSize），拒绝合成"
        }
        require(videoFile.length() <= maxSourceFileSize) {
            "MP4 文件过大（${videoFile.length()} 字节 > $maxSourceFileSize），拒绝合成"
        }

        // 3. 读取图片字节，如果是 WebP/PNG 等非 JPEG 格式则转为 JPEG
        //    抖音的 image_*.jpg 实际是 WebP 格式（RIFF...WEBP），MotionPhoto 规范要求 JPEG
        val rawImageBytes = jpegFile.readBytes()
        val jpegBytes = ensureJpeg(rawImageBytes)

        // 4. MP4 校验
        val mp4Bytes = videoFile.readBytes()
        require(mp4Bytes.isNotEmpty()) { "MP4 文件为空" }
        require(isValidMp4(mp4Bytes)) {
            "MP4 文件格式无效（缺少 ftyp box）: ${videoFile.absolutePath}"
        }

        // ========== offset 迭代收敛 ==========
        val namespaceBytes = xmpNamespace.toByteArray(Charsets.US_ASCII)
        var lastOffset = -1
        var currentOffset = 0
        var finalPayload: ByteArray = buildXmpPayload(mp4Bytes.size, currentOffset)
        var iterations = 0
        while (currentOffset != lastOffset && iterations < 5) {
            lastOffset = currentOffset
            finalPayload = buildXmpPayload(mp4Bytes.size, currentOffset)
            val app1Size = 2 + 2 + namespaceBytes.size + finalPayload.size
            currentOffset = jpegBytes.size + app1Size
            iterations++
        }

        // ========== 字节流组装 ==========
        val out = ByteArrayOutputStream(currentOffset + mp4Bytes.size)

        // 1. JPEG SOI 标记（FF D8）
        out.write(byteArrayOf(jpegSoi, jpegMarkerSoi))

        // 2. APP1 XMP 段
        val xmpSegmentDataLength = namespaceBytes.size + finalPayload.size
        val app1LengthValue = 2 + xmpSegmentDataLength
        out.write(byteArrayOf(jpegSoi, jpegMarkerApp1))
        out.write(byteArrayOf(
            ((app1LengthValue ushr 8) and 0xFF).toByte(),
            (app1LengthValue and 0xFF).toByte()
        ))
        out.write(namespaceBytes)
        out.write(finalPayload)

        // 3. 原 JPEG 剩余部分（跳过原 SOI 的 2 字节）
        out.write(jpegBytes, 2, jpegBytes.size - 2)

        // 4. 追加 MP4 视频字节流（文件末尾）
        out.write(mp4Bytes)

        return out.toByteArray()
    }

    /**
     * 确保图片字节是合法 JPEG。
     * 如果是 WebP/PNG 等非 JPEG 格式，用 Android BitmapFactory 解码后重新压缩为 JPEG。
     * MotionPhoto 规范要求主图片必须是 JPEG/HEIC/AVIF。
     *
     * @param rawBytes 原始图片字节
     * @return JPEG 格式字节（以 FF D8 开头）
     * @throws IllegalArgumentException 如果图片格式无法解码
     */
    private fun ensureJpeg(rawBytes: ByteArray): ByteArray {
        // 检查是否已是 JPEG（FF D8 开头）
        if (rawBytes.size >= 2 && rawBytes[0] == 0xFF.toByte() && rawBytes[1] == 0xD8.toByte()) {
            return rawBytes
        }

        // 非 JPEG（WebP/PNG/BMP 等），用 BitmapFactory 解码后转 JPEG
        val bitmap = try {
            BitmapFactory.decodeByteArray(rawBytes, 0, rawBytes.size)
        } catch (e: Exception) {
            throw IllegalArgumentException("图片解码失败（可能是 WebP/PNG 等): ${e.message}", e)
        }
        require(bitmap != null) { "图片解码返回 null（格式不支持或损坏）" }

        // 压缩为 JPEG
        val jpegOut = ByteArrayOutputStream()
        try {
            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, jpegOut)
        } finally {
            bitmap.recycle()
        }
        return jpegOut.toByteArray()
    }

    /**
     * 校验字节数组是否为合法 MP4（含 ftyp box）。
     * MP4 文件结构：[size(4字节)] [ftyp(4字节)] [brand(4字节)] ...
     * ftyp 标识在偏移 4-7。
     */
    private fun isValidMp4(bytes: ByteArray): Boolean {
        if (bytes.size < 8) return false
        // ftyp 标识在偏移 4-7
        return bytes[4] == 'f'.code.toByte() &&
               bytes[5] == 't'.code.toByte() &&
               bytes[6] == 'y'.code.toByte() &&
               bytes[7] == 'p'.code.toByte()
    }

    /**
     * 构造标准 Motion Photo XMP payload。
     *
     * @param videoLength MP4 视频字节长度（用于 Container:Directory Item[2]:Length 字段）
     * @param jpegPartLength JPEG 部分总字节数（含 SOI + APP1 XMP + 原 JPEG 剩余字节），
     *        用于 Item[1]:Length 字段（修复 B4：原实现为 0 不符合规范）
     * @param microVideoOffset 旧版 MicroVideo 偏移量（兼容小米旧版识别，新规范不读）
     */
    private fun buildXmpPayload(videoLength: Int, jpegPartLength: Int, microVideoOffset: Int = jpegPartLength): ByteArray {
        // 注意：rdf:li 不能自闭合，用 rdf:parseType="Resource" 让 Item 子属性展开
        // 修复 B4：Item[1] Primary Length 改为 jpegPartLength（原为 0 不符合官方规范）
        val xmp = """<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="VideoNote">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
        xmlns:GCamera="http://ns.google.com/photos/1.0/camera/"
        xmlns:Container="http://ns.google.com/photos/1.0/container/"
        xmlns:Item="http://ns.google.com/photos/1.0/container/item/"
        GCamera:MotionPhoto="1"
        GCamera:MotionPhotoVersion="1"
        GCamera:MotionPhotoPresentationTimestampUs="0"
        GCamera:MicroVideo="1"
        GCamera:MicroVideoVersion="1"
        GCamera:MicroVideoOffset="$microVideoOffset"
        GCamera:MicroVideoPresentationTimestampUs="0">
      <Container:Directory>
        <rdf:Seq>
          <rdf:li rdf:parseType="Resource">
            <Item:Mime>image/jpeg</Item:Mime>
            <Item:Semantic>Primary</Item:Semantic>
            <Item:Length>$jpegPartLength</Item:Length>
            <Item:Padding>0</Item:Padding>
          </rdf:li>
          <rdf:li rdf:parseType="Resource">
            <Item:Mime>video/mp4</Item:Mime>
            <Item:Semantic>MotionPhoto</Item:Semantic>
            <Item:Length>$videoLength</Item:Length>
            <Item:Padding>0</Item:Padding>
          </rdf:li>
        </rdf:Seq>
      </Container:Directory>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""
        return xmp.toByteArray(Charsets.UTF_8)
    }
}
