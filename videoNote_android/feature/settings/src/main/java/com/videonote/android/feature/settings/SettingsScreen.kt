@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.designsystem.component.XaiButton
import com.videonote.android.core.designsystem.component.XaiCard
import com.videonote.android.core.designsystem.component.XaiListItem
import com.videonote.android.core.designsystem.component.XaiSectionLabel
import com.videonote.android.core.designsystem.component.XaiSegmented
import com.videonote.android.core.designsystem.component.XaiTextField
import com.videonote.android.core.designsystem.component.XaiTopBar
import com.videonote.android.core.designsystem.theme.XaiBg
import com.videonote.android.core.designsystem.theme.XaiBorderStrong
import com.videonote.android.core.designsystem.theme.XaiFg
import com.videonote.android.core.designsystem.theme.XaiFg2
import com.videonote.android.core.designsystem.theme.XaiMuted
import com.videonote.android.core.designsystem.theme.XaiSurfaceWarm

private enum class SheetKind { None, ServerUrl, ChangePassword, Logout }

private val DarkSheetContainer = Color(0xFF262A31)

@Composable
fun SettingsScreen(
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var sheetKind by remember { mutableStateOf(SheetKind.None) }
    var isCheckingHealth by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isLoggedOut) {
        if (uiState.isLoggedOut) onLogout()
    }

    // 健康检查完成后重置 loading 标志（放在 LazyColumn 外层，避免被回收）
    LaunchedEffect(uiState.healthStatus) {
        if (uiState.healthStatus != null) isCheckingHealth = false
    }

    Scaffold(
        containerColor = XaiBg,
        topBar = { XaiTopBar(title = "设置") }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(XaiBg)
                .padding(padding)
        ) {
            // ── 用户信息卡片 ────────────────────────────────
            item {
                Spacer(modifier = Modifier.height(16.dp))
                XaiCard(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        // 44dp 首字头像方块
                        Box(
                            modifier = Modifier
                                .size(44.dp)
                                .background(XaiSurfaceWarm)
                                .border(1.dp, XaiBorderStrong),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = uiState.username.firstOrNull()?.uppercase() ?: "?",
                                style = TextStyle(
                                    fontSize = 18.sp,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Medium
                                ),
                                color = XaiFg
                            )
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = uiState.username.ifBlank { "未登录" },
                                style = MaterialTheme.typography.titleMedium,
                                color = XaiFg
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = uiState.serverUrl.ifBlank { "—" },
                                style = TextStyle(
                                    fontSize = 12.sp,
                                    fontFamily = FontFamily.Monospace
                                ),
                                color = XaiMuted,
                                maxLines = 1
                            )
                        }
                    }
                }
            }

            // ── 账户分区 ────────────────────────────────────
            item {
                Spacer(modifier = Modifier.height(24.dp))
                XaiSectionLabel("账户")
            }

            item {
                XaiListItem(
                    title = "服务器地址",
                    subtitle = uiState.serverUrl.ifBlank { "未设置" },
                    onClick = { sheetKind = SheetKind.ServerUrl }
                )
            }

            item {
                XaiListItem(
                    title = "修改密码",
                    onClick = { sheetKind = SheetKind.ChangePassword }
                )
            }

            // ── 外观分区 ────────────────────────────────────
            item {
                Spacer(modifier = Modifier.height(16.dp))
                XaiSectionLabel("外观")
            }

            item {
                Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp)) {
                    Text(
                        text = "深色模式",
                        style = MaterialTheme.typography.bodyMedium,
                        color = XaiFg
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    val modes = listOf("system" to "跟随系统", "light" to "浅色", "dark" to "深色")
                    val currentIndex = modes.indexOfFirst { it.first == uiState.themeMode }
                    val safeIndex = if (currentIndex < 0) 2 else currentIndex // 默认选中深色
                    XaiSegmented(
                        items = modes.map { it.second },
                        selectedIndex = safeIndex,
                        onSelected = { index -> viewModel.setThemeMode(modes[index].first) }
                    )
                }
            }

            // ── 系统分区 ────────────────────────────────────
            item {
                Spacer(modifier = Modifier.height(16.dp))
                XaiSectionLabel("系统")
            }

            item {
                XaiListItem(
                    title = "系统健康检查",
                    trailing = {
                        when {
                            isCheckingHealth && uiState.healthStatus == null -> {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = XaiFg2
                                )
                            }
                            uiState.healthStatus != null -> {
                                Text(
                                    text = uiState.healthStatus!!,
                                    style = TextStyle(
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace
                                    ),
                                    color = XaiMuted
                                )
                            }
                            else -> {
                                Text(
                                    text = "检查",
                                    style = TextStyle(
                                        fontSize = 12.sp,
                                        fontFamily = FontFamily.Monospace
                                    ),
                                    color = XaiMuted
                                )
                            }
                        }
                    },
                    onClick = {
                        if (!isCheckingHealth) {
                            isCheckingHealth = true
                            viewModel.checkHealth()
                        }
                    }
                )
            }

            item {
                XaiListItem(
                    title = "关于",
                    trailing = {
                        Text(
                            text = "v1.0.0",
                            style = TextStyle(
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            ),
                            color = XaiMuted
                        )
                    }
                )
            }

            // ── 退出登录 ────────────────────────────────────
            item {
                Spacer(modifier = Modifier.height(24.dp))
                XaiButton(
                    text = "退出登录",
                    onClick = { sheetKind = SheetKind.Logout },
                    danger = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                )
                Spacer(modifier = Modifier.height(32.dp))
            }
        }
    }

    // 消息提示（预留 Snackbar 接入点）
    uiState.message?.let { msg ->
        LaunchedEffect(msg) { /* 可接入 SnackbarHost */ }
    }

    // ── Bottom Sheets ──────────────────────────────────────
    when (sheetKind) {
        SheetKind.ServerUrl -> ServerUrlSheet(
            currentUrl = uiState.serverUrl,
            onDismiss = { sheetKind = SheetKind.None },
            onConfirm = { newUrl ->
                viewModel.updateServerUrl(newUrl)
                sheetKind = SheetKind.None
            }
        )

        SheetKind.ChangePassword -> ChangePasswordSheet(
            oldPassword = uiState.oldPassword,
            newPassword = uiState.newPassword,
            isChanging = uiState.isChangingPassword,
            onOldChange = viewModel::updateOldPassword,
            onNewChange = viewModel::updateNewPassword,
            onDismiss = { sheetKind = SheetKind.None },
            onConfirm = {
                viewModel.changePassword()
                sheetKind = SheetKind.None
            }
        )

        SheetKind.Logout -> LogoutConfirmSheet(
            onDismiss = { sheetKind = SheetKind.None },
            onConfirm = {
                viewModel.logout()
                sheetKind = SheetKind.None
            }
        )

        SheetKind.None -> { /* nothing */ }
    }
}

// ═══════════════════════════════════════════════════════════════════
// Bottom Sheets（M3 ModalBottomSheet 暗色配色）
// ═══════════════════════════════════════════════════════════════════

@Composable
private fun ServerUrlSheet(
    currentUrl: String,
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var newUrl by remember { mutableStateOf(currentUrl) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DarkSheetContainer,
        dragHandle = null
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = "服务器地址",
                style = TextStyle(
                    fontSize = 15.sp,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.6.sp
                ),
                color = XaiFg
            )
            Spacer(modifier = Modifier.height(16.dp))
            XaiTextField(
                value = newUrl,
                onValueChange = { newUrl = it },
                placeholder = "https://example.com",
                singleLine = true
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                XaiButton(
                    text = "取消",
                    onClick = onDismiss,
                    ghost = true,
                    modifier = Modifier.weight(1f)
                )
                XaiButton(
                    text = "确认",
                    onClick = { onConfirm(newUrl) },
                    primary = true,
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun ChangePasswordSheet(
    oldPassword: String,
    newPassword: String,
    isChanging: Boolean,
    onOldChange: (String) -> Unit,
    onNewChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DarkSheetContainer,
        dragHandle = null
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = "修改密码",
                style = TextStyle(
                    fontSize = 15.sp,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.6.sp
                ),
                color = XaiFg
            )
            Spacer(modifier = Modifier.height(16.dp))
            XaiTextField(
                value = oldPassword,
                onValueChange = onOldChange,
                placeholder = "旧密码",
                singleLine = true
            )
            Spacer(modifier = Modifier.height(10.dp))
            XaiTextField(
                value = newPassword,
                onValueChange = onNewChange,
                placeholder = "新密码",
                singleLine = true
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                XaiButton(
                    text = "取消",
                    onClick = onDismiss,
                    ghost = true,
                    modifier = Modifier.weight(1f)
                )
                XaiButton(
                    text = "确认",
                    onClick = onConfirm,
                    primary = true,
                    isLoading = isChanging,
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun LogoutConfirmSheet(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = DarkSheetContainer,
        dragHandle = null
    ) {
        Column(modifier = Modifier.padding(20.dp)) {
            Text(
                text = "退出登录",
                style = TextStyle(
                    fontSize = 15.sp,
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 0.6.sp
                ),
                color = XaiFg
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "确定要退出当前账户吗？",
                style = MaterialTheme.typography.bodyMedium,
                color = XaiFg2
            )
            Spacer(modifier = Modifier.height(20.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                XaiButton(
                    text = "取消",
                    onClick = onDismiss,
                    ghost = true,
                    modifier = Modifier.weight(1f)
                )
                XaiButton(
                    text = "退出登录",
                    onClick = onConfirm,
                    danger = true,
                    modifier = Modifier.weight(1f)
                )
            }
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}
