package com.videonote.android.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// 等宽字体（替代 GeistMono）
private val Mono = FontFamily.Monospace
// 默认无衬线（替代 universalSans）
private val Sans = FontFamily.Default

val VideoNoteTypography = Typography(
    // 显示级 - 等宽，用于品牌名、大标题
    headlineLarge = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Medium, fontFamily = Mono, letterSpacing = 2.sp),
    headlineMedium = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Medium, fontFamily = Sans),

    // 标题级
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Medium, fontFamily = Sans),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Medium, fontFamily = Sans),

    // 正文级 - 无衬线
    bodyLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Normal, fontFamily = Sans, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Normal, fontFamily = Sans, lineHeight = 21.sp),
    bodySmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Normal, fontFamily = Sans, lineHeight = 18.sp),

    // 标签级 - 等宽，用于按钮、chip、eyebrow
    labelLarge = TextStyle(fontSize = 13.sp, fontWeight = FontWeight.Normal, fontFamily = Mono, letterSpacing = 1.4.sp),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Normal, fontFamily = Mono, letterSpacing = 0.6.sp),
    labelSmall = TextStyle(fontSize = 10.sp, fontWeight = FontWeight.Normal, fontFamily = Mono, letterSpacing = 0.6.sp)
)
