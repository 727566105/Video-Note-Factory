package com.videonote.android.core.designsystem.theme

import androidx.compose.ui.graphics.Color

// ═══════════════════════════════════════════════════════════════════
// xAI 暗色优先设计系统 — 颜色定义
// 纯白文字浮于暖近黑画布，四级透明度色阶表达层级
// ═══════════════════════════════════════════════════════════════════

// ─── Surface ─────────────────────────────────────────────────────
val XaiBg = Color(0xFF1F2228)                     // 暖近黑画布
val XaiSurface = Color(0x08FFFFFF)                // 极淡卡片表面 rgba(255,255,255,0.03)
val XaiSurfaceWarm = Color(0x0DFFFFFF)            // hover/提升层 rgba(255,255,255,0.05)

// ─── Foreground（四级透明度色阶）─────────────────────────────────
val XaiFg = Color(0xFFFFFFFF)                     // 主色 - 标题、链接、正文
val XaiFg2 = Color(0xB3FFFFFF)                    // 次级 - 描述 rgba(255,255,255,0.7)
val XaiMuted = Color(0x80FFFFFF)                  // 三级 - 说明、时间戳 rgba(255,255,255,0.5)
val XaiMeta = Color(0x4DFFFFFF)                   // 四级 - 禁用、占位 rgba(255,255,255,0.3)

// ─── Border ──────────────────────────────────────────────────────
val XaiBorder = Color(0x1AFFFFFF)                 // 默认卡片/分隔线 rgba(255,255,255,0.1)
val XaiBorderSoft = Color(0x0DFFFFFF)             // 行内分隔线 rgba(255,255,255,0.05)
val XaiBorderStrong = Color(0x33FFFFFF)           // 强调边框 rgba(255,255,255,0.2)

// ─── Accent（白即是强调色）──────────────────────────────────────
val XaiAccent = Color(0xFFFFFFFF)                 // 强调色作背景
val XaiAccentOn = Color(0xFF1F2228)               // 画布作强调色上的前景
val XaiAccentHover = Color(0xE6FFFFFF)            // hover 略暗
val XaiAccentActive = Color(0xCCFFFFFF)           // 按下更深

// ─── Semantic ────────────────────────────────────────────────────
val XaiSuccess = Color(0xFF16A34A)
val XaiWarn = Color(0xFFEAB308)
val XaiDanger = Color(0xFFDC2626)

// ─── 平台品牌色（唯一彩色功能性例外）──────────────────────────
val BilibiliPink = Color(0xFFFB7299)
val YoutubeRed = Color(0xFFFF0000)
val DouyinCyan = Color(0xFF25F4EE)               // 抖音品牌青色
val XiaohongshuRed = Color(0xFFFF2442)
val KuaishouOrange = Color(0xFFFF6600)
val CctvGold = Color(0xFFE8B14C)
val LocalGray = Color(0xFF9AA0A6)

/// 根据平台标识返回品牌色
fun platformColor(platform: String): Color = when (platform) {
    "bilibili" -> BilibiliPink
    "youtube" -> YoutubeRed
    "douyin" -> DouyinCyan
    "xiaohongshu" -> XiaohongshuRed
    "kuaishou" -> KuaishouOrange
    "cctv" -> CctvGold
    "local", "local_audio" -> LocalGray
    else -> LocalGray
}

/// 平台中文名
fun platformName(platform: String): String = when (platform) {
    "bilibili" -> "B站"
    "youtube" -> "YouTube"
    "douyin" -> "抖音"
    "xiaohongshu" -> "小红书"
    "kuaishou" -> "快手"
    "cctv" -> "央视频"
    "local" -> "本地"
    "local_audio" -> "本地音频"
    else -> platform
}
