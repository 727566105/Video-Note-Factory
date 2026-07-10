package com.videonote.android.core.common

import android.content.ClipData
import android.content.ClipboardManager

/**
 * 剪贴板工具：提取 URL
 * 支持 text/plain 和 text/x-uri 两种格式
 */
object ClipboardHelper {

    fun extractUrl(clipboardManager: ClipboardManager?): String? {
        if (clipboardManager == null || !clipboardManager.hasPrimaryClip()) return null
        val clip = clipboardManager.primaryClip ?: return null
        if (clip.itemCount == 0) return null

        // 尝试 text/x-uri
        val uriText = clip.getItemAt(0).uri?.toString()
        if (uriText != null && PlatformDetector.isVideoUrl(uriText)) return uriText

        // 尝试 text/plain
        val plainText = clip.getItemAt(0).text?.toString() ?: return null
        val trimmed = plainText.trim()

        // 分享文本可能包含 URL（如抖音分享文本）
        if (PlatformDetector.isVideoUrl(trimmed)) return trimmed

        // 从分享文本中提取 URL
        val urlRegex = Regex("""https?://[^\s<>"']+""")
        val match = urlRegex.find(trimmed)
        if (match != null && PlatformDetector.isVideoUrl(match.value)) return match.value

        // 短链检测
        if (PlatformDetector.isVideoUrl(trimmed)) return trimmed

        return null
    }
}
