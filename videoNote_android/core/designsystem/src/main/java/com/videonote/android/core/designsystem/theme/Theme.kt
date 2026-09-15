package com.videonote.android.core.designsystem.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// xAI 暗色 ColorScheme - 显式设置所有 M3 颜色槽位
val XaiColorScheme = darkColorScheme(
    primary = XaiAccent,                    // 白色 - 主 CTA 背景
    onPrimary = XaiAccentOn,                // 深色 - 主 CTA 上的文字
    primaryContainer = XaiSurfaceWarm,
    onPrimaryContainer = XaiFg,
    secondary = XaiFg2,
    onSecondary = XaiBg,
    secondaryContainer = XaiSurface,
    onSecondaryContainer = XaiFg,
    tertiary = XaiFg2,
    onTertiary = XaiBg,
    tertiaryContainer = XaiSurface,
    onTertiaryContainer = XaiFg,
    background = XaiBg,
    onBackground = XaiFg,
    surface = XaiBg,                        // M3 surface 用画布色（卡片靠 border 区分）
    onSurface = XaiFg,
    surfaceVariant = XaiSurface,
    onSurfaceVariant = XaiFg2,
    surfaceTint = XaiFg,
    inverseSurface = XaiFg,
    inverseOnSurface = XaiBg,
    error = XaiDanger,
    onError = XaiFg,
    errorContainer = XaiSurface,
    onErrorContainer = XaiDanger,
    outline = XaiMuted,                     // outline = 三级灰
    outlineVariant = XaiBorder,             // outlineVariant = 默认边框
    scrim = Color(0x99000000)
)

// 浅色方案保留空壳（当前不使用，SYSTEM/LIGHT 均映射到暗色）
@Suppress("unused")
private val XaiLightColorScheme = lightColorScheme(
    primary = XaiAccent,
    onPrimary = XaiAccentOn,
    background = XaiBg,
    onBackground = XaiFg,
    surface = XaiBg,
    onSurface = XaiFg,
    outline = XaiMuted,
    outlineVariant = XaiBorder
)

// xAI Shapes - 零圆角为主，FAB 用圆形
// 注：Shapes 要求 CornerBasedShape，用 RoundedCornerShape(0.dp) 实现零圆角
val XaiShapes = Shapes(
    extraSmall = RoundedCornerShape(0.dp),
    small = RoundedCornerShape(0.dp),
    medium = RoundedCornerShape(0.dp),
    large = RoundedCornerShape(4.dp),       // 偶用 4px 柔化次要容器
    extraLarge = RoundedCornerShape(0.dp)
)

enum class ThemeMode { SYSTEM, LIGHT, DARK }

val LocalThemeMode = staticCompositionLocalOf { ThemeMode.SYSTEM }

@Composable
fun VideoNoteTheme(
    themeMode: ThemeMode = ThemeMode.DARK,
    content: @Composable () -> Unit
) {
    // 暗色优先：SYSTEM 和 LIGHT 都使用暗色方案
    val colorScheme = XaiColorScheme

    CompositionLocalProvider(LocalThemeMode provides themeMode) {
        androidx.compose.material3.MaterialTheme(
            colorScheme = colorScheme,
            typography = VideoNoteTypography,
            shapes = XaiShapes,
            content = content
        )
    }
}
