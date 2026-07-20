package com.videonote.android.core.common.media

import java.io.ByteArrayOutputStream
import java.io.File

/**
 * MotionPhoto 格式合成器（Android 14+ API 34+ 系统相册识别为 Live Photo）
 *
 * MotionPhoto 文件结构：
 *   [JPEG 字节流] + [MP4 字节流] + [XMP 元数据]
 *
 * XMP 元数据标记关键字段：
 *   - GCamera:MotionPhoto: 1（声明是 MotionPhoto）
 *   - GCamera:MotionPhotoVersion: 1
 *   - GCamera:MotionPhotoPresentationTimestamp: 0
 *   - MicroVideo: 1
 *   - MicroVideoVersion: 1
 *   - MicroVideoOffset: <MP4 数据在文件中的偏移字节>
 *   - MicroVideoPresentationTimestampUs: 0
 *
 * XMP 必须以 JPEG APP1 段的形式嵌入（标记 0xFFE1 + 长度 + "http://ns.adobe.com/xap/1.0/\0" + XMP 包）。
 *
 * 参考：Google Photos MotionPhoto 格式 / Camera2 MotionPhoto spec
 *
 * 注意：此格式兼容性有限（Pixel 等原生 Android 设备 + Google Photos 支持），
 * 其他相册应用可能只识别为静态图片。Android 14 以下系统不识别 MotionPhoto，会显示为静态图。
 * 兜底策略：MediaDownloader 会在 Android 14 以下分别保存图片和视频两个文件。
 */
object MotionPhotoWriter {

    private const val XMP_HEADER = "http://ns.adobe.com/xap/1.0/\u0000"
    private const val JPEG_SOI: Byte = 0xFF.toByte()
    private const val JPEG_MARKER_SOI: Byte = 0xD8.toByte()
    private const val JPEG_MARKER_APP1: Byte = 0xE1.toByte()
    private const val JPEG_MARKER_SOS: Byte = 0xDA.toByte()

    /**
     * 合成 MotionPhoto 字节流。
     *
     * @param jpegFile 静态图 JPEG 文件
     * @param mp4File 实况视频 MP4 文件
     * @return MotionPhoto 字节流（写入 MediaStore.Images 即可被识别为 Live Photo）
     */
    fun write(jpegFile: File, mp4File: File): ByteArray {
        val jpegBytes = jpegFile.readBytes()
        val mp4Bytes = mp4File.readBytes()

        // 计算 MP4 在最终文件中的偏移 = JPEG 字节长度（包含嵌入的 XMP APP1 段）
        // 先生成 XMP（含 offset 占位），offset = jpegWithXmp.size
        // 但 XMP 长度依赖 offset，offset 依赖 XMP 长度 -> 需要先算 XMP 大小
        val xmpPayloadSize = estimateXmpSize(mp4Bytes.size)
        // XMP APP1 段总长度 = 2(标记) + 2(长度) + XMP_HEADER.length + xmpPayloadSize
        val app1SegmentSize = 2 + 2 + XMP_HEADER.length + xmpPayloadSize
        val finalJpegSize = jpegBytes.size + app1SegmentSize
        val microVideoOffset = finalJpegSize

        // 用真实 offset 重新生成 XMP
        val xmpPayload = buildXmpPayload(microVideoOffset)
        // 校验：实际 xmpPayload.size 可能与估算的 estimateXmpSize 略有差异，重新计算 finalJpegSize
        val actualApp1Size = 2 + 2 + XMP_HEADER.length + xmpPayload.size
        val actualFinalJpegSize = jpegBytes.size + actualApp1Size
        val actualOffset = actualFinalJpegSize
        // 若实际 offset 与估算不同，重新生成（递归一次确保一致）
        val finalXmpPayload = if (actualOffset != microVideoOffset) {
            buildXmpPayload(actualOffset)
        } else xmpPayload

        // 重新计算最终大小
        val finalApp1Size = 2 + 2 + XMP_HEADER.length + finalXmpPayload.size
        val finalJpegSizeActual = jpegBytes.size + finalApp1Size
        val finalOffset = finalJpegSizeActual
        // 如果第二轮仍有差异（不太可能，因为 offset 数字位数稳定），再生成一次
        val finalPayload = if (finalOffset != actualOffset) buildXmpPayload(finalOffset) else finalXmpPayload

        // 组装最终字节流
        val out = ByteArrayOutputStream(finalJpegSizeActual + mp4Bytes.size)

        // 1. JPEG SOI (FF D8)
        // 注意：原 JPEG 文件以 FF D8 开头，我们保留原 SOI，然后在 SOI 后插入 APP1 XMP 段
        // 原 JPEG 结构：[FF D8] [FF E0 ... APP0 等] [图像数据 ...]
        // 改造后：[FF D8] [FF E1 + 长度 + XMP_HEADER + XMP] [原 APP0 等] [图像数据]
        out.write(byteArrayOf(JPEG_SOI, JPEG_MARKER_SOI))

        // 2. 写入 APP1 XMP 段
        val xmpTotalLen = XMP_HEADER.length + finalPayload.size
        // 长度字段含自身 2 字节
        val app1Length = 2 + xmpTotalLen
        out.write(byteArrayOf(JPEG_SOI, JPEG_MARKER_APP1))
        out.write(byteArrayOf(((app1Length ushr 8) and 0xFF).toByte(), (app1Length and 0xFF).toByte()))
        out.write(XMP_HEADER.toByteArray(Charsets.US_ASCII))
        out.write(finalPayload)

        // 3. 写入原 JPEG 剩余部分（跳过 SOI 的 2 字节）
        out.write(jpegBytes, 2, jpegBytes.size - 2)

        // 4. 追加 MP4 数据
        out.write(mp4Bytes)

        return out.toByteArray()
    }

    /**
     * 构建 XMP payload 字符串。
     */
    private fun buildXmpPayload(microVideoOffset: Int): ByteArray {
        val xmp = """<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="VideoNote">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description
        xmlns:GCamera="http://ns.google.com/photos/1.0/camera/"
        xmlns:MicroVideo="http://ns.google.com/photos/1.0/microvideo/"
        GCamera:MotionPhoto="1"
        GCamera:MotionPhotoVersion="1"
        GCamera:MotionPhotoPresentationTimestamp="0"
        MicroVideo:MicroVideo="1"
        MicroVideo:MicroVideoVersion="1"
        MicroVideo:MicroVideoOffset="$microVideoOffset"
        MicroVideo:MicroVideoPresentationTimestampUs="0">
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>"""
        return xmp.toByteArray(Charsets.UTF_8)
    }

    /**
     * 估算 XMP payload 大小（用于预先计算 offset）。
     */
    private fun estimateXmpSize(offset: Int): Int {
        return buildXmpPayload(offset).size
    }

    /**
     * 检测设备是否支持 MotionPhoto（Android 14+ API 34+）。
     * 实际支持还依赖相册应用（Google Photos / Pixel 系统相册支持）。
     */
    fun isSupported(): Boolean {
        return android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.UPSIDE_DOWN_CAKE
    }
}
