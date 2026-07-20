package com.videonote.android.core.network.dto

/**
 * 格式化视频时长字符串
 *
 * 后端 duration 字段类型不稳定，可能返回：
 * - float 秒数（45167.0、0.0、630.0）
 * - 字符串秒数（"45167"）
 * - 字符串 mm:ss（"12:34"）
 * - 字符串 HH:mm:ss（"01:02:03"）
 * - null / 空串
 *
 * 本函数统一处理：
 * - null / 空串 / 0 秒 / "0" / "0.0" -> 返回 null（UI 不显示 badge）
 * - 秒数（"45167.0"）-> "12:32:47"
 * - 已是 mm:ss 格式 -> 原样返回
 *
 * 用法：
 *   task.duration?.formatDuration()?.let { Text(text = it, ...) }
 */
fun String?.formatDuration(): String? {
    if (this.isNullOrBlank()) return null
    val trimmed = trim()

    // 已经是 mm:ss 或 HH:mm:ss 格式，原样返回（但要排除纯数字 "12:34" 不会被这里捕获，纯数字走下面）
    if (trimmed.contains(':')) {
        // 验证是否合法时间格式
        val parts = trimmed.split(':')
        if (parts.size in 2..3 && parts.all { it.toIntOrNull() != null }) {
            return trimmed
        }
    }

    // 尝试当作秒数解析
    val seconds = trimmed.toDoubleOrNull() ?: return null
    if (seconds <= 0) return null  // 0 秒不显示

    val totalSeconds = seconds.toLong()
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60

    return if (h > 0) {
        String.format("%d:%02d:%02d", h, m, s)
    } else {
        String.format("%d:%02d", m, s)
    }
}
