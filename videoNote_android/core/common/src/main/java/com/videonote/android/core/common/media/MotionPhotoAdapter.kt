package com.videonote.android.core.common.media

import java.io.ByteArrayOutputStream
import java.io.File

/**
 * 动态照片（Live Photo / Motion Photo）合成器统一接口。
 *
 * 背景：各厂商对动态照片的实现略有差异，但都基于「JPEG + 视频 + XMP 元数据」的组合模式。
 * - **Google Motion Photo 1.0**（标准）：Container:Directory 数组 + GCamera:MotionPhoto=1
 *   - 兼容性：Pixel / Google Photos / Android 14+ 原生相册
 *   - 同时被 vivo OriginOS / 小米 MIUI / OPPO ColorOS 作为基础格式识别
 * - **小米 Micro Video**（旧标准）：GCamera:MicroVideoOffset（已被官方规范废弃）
 * - **OPPO O Live Photo**：标准 Motion Photo + 私有命名空间 OpCamera（支持 HDR GainMap）
 *
 * VideoNote 的适配策略：
 * 1. 默认用 [StandardMotionPhotoAdapter]（标准 Motion Photo 1.0），覆盖 vivo/Google/小米
 * 2. 未来如果某厂商相册无法识别标准格式，新增厂商专用 Adapter 即可
 *
 * 所有 Adapter 必须实现 [write]，输出一个单文件字节流（写入 MediaStore.Images），
 * 文件扩展名为 .jpg/.jpeg。
 */
interface MotionPhotoAdapter {

    /**
     * 合成动态照片字节流。
     *
     * @param jpegFile 静态 JPEG 图片
     * @param videoFile 实况视频（MP4）
     * @return 单文件字节流（JPEG + 视频 + XMP 元数据）
     */
    fun write(jpegFile: File, videoFile: File): ByteArray

    /**
     * 该适配器目标厂商（用于日志和用户提示）。
     */
    val vendorName: String

    /**
     * 设备是否支持该适配器格式（部分厂商私有格式有 SDK_INT 限制）。
     * 默认 true 表示通用支持。
     */
    fun isSupported(): Boolean = true
}

/**
 * 动态照片适配器选择器：根据当前设备品牌选择最合适的适配器。
 *
 * 选择逻辑：
 * 1. 优先使用厂商私有适配器（如果存在且支持）
 * 2. 回退到 [StandardMotionPhotoAdapter]（兼容性最广）
 *
 * 新增厂商支持时，在 [selectAdapter] 里加分支即可。
 */
object MotionPhotoAdapterFactory {

    /**
     * 根据当前设备选择最合适的动态照片适配器。
     */
    fun select(): MotionPhotoAdapter {
        val brand = android.os.Build.BRAND?.lowercase() ?: ""
        // 未来扩展：OPPO/realme 用 OpLivePhotoAdapter
        // if (brand in listOf("oppo", "realme")) {
        //     val oppoAdapter = OpLivePhotoAdapter()
        //     if (oppoAdapter.isSupported()) return oppoAdapter
        // }
        // 未来扩展：小米私有格式（如果标准格式不被识别）
        // if (brand in listOf("xiaomi", "redmi", "poco")) { ... }

        // 默认用标准格式：兼容 vivo / Google / 小米 / OPPO 的基础识别
        return StandardMotionPhotoAdapter()
    }
}
