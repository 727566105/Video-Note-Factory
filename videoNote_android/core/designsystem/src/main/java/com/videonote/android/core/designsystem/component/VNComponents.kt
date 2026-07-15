package com.videonote.android.core.designsystem.component

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.videonote.android.core.designsystem.theme.*

// ═══════════════════════════════════════════════════════════════════
// 状态组件
// ═══════════════════════════════════════════════════════════════════

@Composable
fun VNLoading(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(
            modifier = Modifier.size(18.dp),
            strokeWidth = 2.dp,
            color = XaiFg
        )
    }
}

@Composable
fun VNError(
    message: String,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = message, style = MaterialTheme.typography.bodyMedium, color = XaiFg2)
        if (onRetry != null) {
            Spacer(modifier = Modifier.height(16.dp))
            XaiButton(text = "重试", onClick = onRetry, modifier = Modifier.padding(horizontal = 24.dp))
        }
    }
}

@Composable
fun VNEmpty(
    message: String = "暂无数据",
    modifier: Modifier = Modifier
) {
    VNStateBox(
        title = message,
        modifier = modifier
    )
}

/// 空态/错误态 - 原型 .state 风格
@Composable
fun VNStateBox(
    title: String,
    description: String? = null,
    icon: @Composable (() -> Unit)? = null,
    action: @Composable (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth().padding(vertical = 64.dp, horizontal = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (icon != null) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .border(1.dp, XaiBorderStrong),
                contentAlignment = Alignment.Center
            ) { icon() }
            Spacer(modifier = Modifier.height(18.dp))
        }
        Text(
            text = title,
            style = TextStyle(fontSize = 13.sp, fontFamily = FontFamily.Monospace, letterSpacing = 1.sp),
            color = XaiFg2
        )
        if (description != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = XaiMuted,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                modifier = Modifier.widthIn(max = 240.dp)
            )
        }
        if (action != null) {
            Spacer(modifier = Modifier.height(18.dp))
            action()
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// 顶栏
// ═══════════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun XaiTopBar(
    title: String,
    modifier: Modifier = Modifier,
    mono: Boolean = false,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {}
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .padding(horizontal = 6.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (onBack != null) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "返回", tint = XaiFg, modifier = Modifier.size(22.dp))
                }
            } else {
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = title,
                modifier = Modifier.weight(1f),
                style = if (mono) TextStyle(fontSize = 15.sp, fontFamily = FontFamily.Monospace, letterSpacing = 0.6.sp, fontWeight = FontWeight.Normal)
                    else TextStyle(fontSize = 17.sp, fontWeight = FontWeight.Medium),
                color = XaiFg,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            actions()
            Spacer(modifier = Modifier.width(8.dp))
        }
        HorizontalDivider(thickness = 1.dp, color = XaiBorderSoft)
    }
}

/// 顶栏图标按钮
@Composable
fun XaiIconButton(
    onClick: () -> Unit,
    contentDescription: String? = null,
    icon: @Composable () -> Unit
) {
    Box(
        modifier = Modifier
            .size(40.dp)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        contentDescription?.let { /* a11y */ }
        icon()
    }
}

// ═══════════════════════════════════════════════════════════════════
// 按钮
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    isLoading: Boolean = false,
    primary: Boolean = true,
    ghost: Boolean = false,
    danger: Boolean = false,
    textButton: Boolean = false
) {
    val bg = when {
        !enabled -> XaiSurfaceWarm.copy(alpha = 0.4f)
        primary -> XaiAccent
        danger -> Color.Transparent
        ghost -> Color.Transparent
        textButton -> Color.Transparent
        else -> XaiAccent
    }
    val fg = when {
        !enabled -> XaiMuted
        primary -> XaiAccentOn
        danger -> XaiDanger
        else -> XaiFg
    }
    val borderColor = when {
        danger -> XaiDanger.copy(alpha = 0.45f)
        ghost -> XaiBorderStrong
        else -> Color.Transparent
    }
    val style = if (textButton)
        TextStyle(fontSize = 15.sp, fontFamily = FontFamily.Default)
    else
        TextStyle(fontSize = 13.sp, fontFamily = FontFamily.Monospace, letterSpacing = 1.4.sp)

    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(48.dp)
            .clip(RoundedCornerShape(0.dp))
            .background(bg)
            .border(1.dp, borderColor)
            .clickable(enabled = enabled && !isLoading, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (isLoading) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = fg)
        } else {
            Text(text = text, color = fg, style = style)
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// 输入框
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    isError: Boolean = false,
    singleLine: Boolean = true,
    trailingIcon: @Composable (() -> Unit)? = null,
    leadingIcon: @Composable (() -> Unit)? = null
) {
    Column(modifier = modifier) {
        if (label != null) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                color = XaiFg2,
                modifier = Modifier.padding(bottom = 8.dp)
            )
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(XaiSurfaceWarm)
                .border(1.dp, if (isError) XaiDanger.copy(alpha = 0.6f) else XaiBorderStrong)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxHeight()) {
                if (leadingIcon != null) {
                    Box(modifier = Modifier.padding(start = 10.dp)) { leadingIcon() }
                } else {
                    Spacer(modifier = Modifier.width(14.dp))
                }
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    singleLine = singleLine,
                    textStyle = TextStyle(fontSize = 15.sp, color = XaiFg, fontFamily = FontFamily.Default),
                    modifier = Modifier.weight(1f),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(XaiFg)
                )
                if (trailingIcon != null) {
                    Box(modifier = Modifier.padding(end = 6.dp)) { trailingIcon() }
                } else {
                    Spacer(modifier = Modifier.width(14.dp))
                }
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// 卡片
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiCard(
    modifier: Modifier = Modifier,
    warm: Boolean = false,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val base = modifier
        .background(if (warm) XaiSurfaceWarm else XaiSurface)
        .border(1.dp, XaiBorder)
    Column(
        modifier = if (onClick != null) base.clickable(onClick = onClick) else base
            .padding(16.dp),
        content = content
    )
}

// ═══════════════════════════════════════════════════════════════════
// 分段选择
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiSegmented(
    items: List<String>,
    selectedIndex: Int,
    onSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(modifier = modifier, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items.forEachIndexed { index, label ->
            val active = index == selectedIndex
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(0.dp))
                    .background(Color.Transparent)
                    .border(1.dp, if (active) XaiFg else XaiBorder)
                    .clickable { onSelected(index) }
                    .padding(horizontal = 14.dp, vertical = 8.dp)
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.bodyMedium,
                    color = if (active) XaiFg else XaiFg2
                )
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// 开关
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiSwitch(
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .width(44.dp)
            .height(24.dp)
            .clip(RoundedCornerShape(0.dp))
            .background(if (checked) XaiAccent else Color.Transparent)
            .border(1.dp, XaiBorderStrong)
            .clickable { onCheckedChange(!checked) }
    ) {
        Box(
            modifier = Modifier
                .padding(start = if (checked) 22.dp else 2.dp, top = 2.dp)
                .size(18.dp)
                .background(if (checked) XaiAccentOn else XaiMuted)
                .align(Alignment.CenterStart)
        )
    }
}

// ═══════════════════════════════════════════════════════════════════
// Tab 行
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiTabRow(
    tabs: List<String>,
    selectedIndex: Int,
    onSelected: (Int) -> Unit,
    modifier: Modifier = Modifier
) {
    Column {
        Row(modifier = modifier.fillMaxWidth()) {
            tabs.forEachIndexed { index, label ->
                val active = index == selectedIndex
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onSelected(index) }
                        .padding(vertical = 14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = label,
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (active) XaiFg else XaiMuted
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(thickness = 2.dp, color = if (active) XaiFg else Color.Transparent)
                }
            }
        }
        HorizontalDivider(thickness = 1.dp, color = XaiBorder)
    }
}

// ═══════════════════════════════════════════════════════════════════
// 进度条
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiProgress(
    progress: Float,  // 0f ~ 1f
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(2.dp)
            .background(XaiFg.copy(alpha = 0.12f))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(progress)
                .fillMaxHeight()
                .background(XaiFg)
        )
    }
}

// ═══════════════════════════════════════════════════════════════════
// 平台 Chip（色点 + 大写名称）
// ═══════════════════════════════════════════════════════════════════

@Composable
fun PlatformChip(platform: String, modifier: Modifier = Modifier) {
    val display = platformName(platform)
    val color = platformColor(platform)
    Row(
        modifier = modifier
            .border(1.dp, XaiBorderStrong)
            .padding(horizontal = 8.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(modifier = Modifier.size(7.dp).background(color))
        Text(
            text = display.uppercase(),
            style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace, letterSpacing = 0.6.sp),
            color = XaiFg
        )
    }
}

/// 平台色点（单独使用）
@Composable
fun PlatformDot(platform: String, modifier: Modifier = Modifier) {
    Box(modifier = modifier.size(7.dp).background(platformColor(platform)))
}

// ═══════════════════════════════════════════════════════════════════
// 列表项
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiListItem(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    onClick: (() -> Unit)? = null,
    leading: @Composable (() -> Unit)? = null,
    trailing: @Composable (() -> Unit)? = null
) {
    Column {
        Row(
            modifier = modifier
                .fillMaxWidth()
                .clickable(enabled = onClick != null) { onClick?.invoke() }
                .padding(horizontal = 20.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (leading != null) {
                leading()
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = XaiFg,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (subtitle != null) {
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = subtitle,
                        style = TextStyle(fontSize = 12.sp, fontFamily = FontFamily.Monospace),
                        color = XaiMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
            if (trailing != null) {
                trailing()
            }
        }
        HorizontalDivider(thickness = 1.dp, color = XaiBorderSoft)
    }
}

// ═══════════════════════════════════════════════════════════════════
// Badge（徽标）
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiBadge(
    text: String,
    modifier: Modifier = Modifier,
    active: Boolean = false  // unread style
) {
    Text(
        text = text.uppercase(),
        style = TextStyle(fontSize = 10.sp, fontFamily = FontFamily.Monospace, letterSpacing = 0.6.sp),
        color = if (active) XaiFg else XaiMuted,
        modifier = modifier
            .border(1.dp, if (active) XaiFg else XaiBorderStrong)
            .padding(horizontal = 7.dp, vertical = 3.dp)
    )
}

// ═══════════════════════════════════════════════════════════════════
// Eyebrow / Section Label
// ═══════════════════════════════════════════════════════════════════

@Composable
fun XaiEyebrow(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace, letterSpacing = 1.sp),
        color = XaiMuted,
        modifier = modifier
    )
}

@Composable
fun XaiSectionLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text.uppercase(),
        style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace, letterSpacing = 1.sp),
        color = XaiMuted,
        modifier = modifier.padding(horizontal = 20.dp, vertical = 4.dp)
    )
}
