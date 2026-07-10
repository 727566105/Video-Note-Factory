package com.videonote.android.core.common

/**
 * 平台检测工具：从 URL 识别视频平台
 * 支持短链和分享文本
 */
object PlatformDetector {

    fun detect(url: String): String? {
        val lower = url.lowercase().trim()
        return when {
            // Bilibili: bilibili.com, b23.tv 短链
            lower.contains("bilibili.com") || lower.contains("b23.tv") -> "bilibili"
            // YouTube
            lower.contains("youtube.com") || lower.contains("youtu.be") -> "youtube"
            // 抖音: douyin.com, v.douyin.com, 分享文本
            lower.contains("douyin.com") || lower.contains("v.douyin.com") ||
                lower.contains("复制打开抖音") || lower.contains("抖音") -> "douyin"
            // 小红书: xiaohongshu.com, xhslink.com 短链
            lower.contains("xiaohongshu.com") || lower.contains("xhslink.com") -> "xiaohongshu"
            // 快手: kuaishou.com, v.kuaishou.com 短链
            lower.contains("kuaishou.com") || lower.contains("v.kuaishou.com") -> "kuaishou"
            // 央视频
            lower.contains("cctv.com") -> "cctv"
            else -> null
        }
    }

    fun isVideoUrl(text: String): Boolean {
        val lower = text.lowercase().trim()
        return lower.startsWith("http://") || lower.startsWith("https://") ||
            lower.contains("b23.tv") || lower.contains("xhslink.com") ||
            lower.contains("v.douyin.com") || lower.contains("v.kuaishou.com")
    }

    /**
     * 判断平台封面图是否需要通过后端代理加载（有 Referer 限制）
     */
    fun needsImageProxy(platform: String?): Boolean {
        return when (platform) {
            "bilibili", "douyin", "xiaohongshu", "kuaishou" -> true
            else -> false
        }
    }
}
