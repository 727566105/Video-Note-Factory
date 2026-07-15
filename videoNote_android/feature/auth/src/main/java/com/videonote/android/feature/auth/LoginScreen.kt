package com.videonote.android.feature.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.designsystem.component.XaiButton
import com.videonote.android.core.designsystem.component.XaiTextField
import com.videonote.android.core.designsystem.theme.*

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.loginSuccess) {
        if (uiState.loginSuccess) onLoginSuccess()
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = XaiBg
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp)
                .padding(top = 80.dp, bottom = 48.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // ── 品牌 ──
            Text(
                text = "VIDEONOTE",
                style = TextStyle(
                    fontSize = 28.sp,
                    fontFamily = FontFamily.Monospace,
                    fontWeight = FontWeight.Medium,
                    letterSpacing = 2.sp
                ),
                color = XaiFg
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "AI 视频笔记",
                style = MaterialTheme.typography.bodySmall,
                color = XaiMuted
            )

            Spacer(Modifier.height(36.dp))

            // ── 服务器地址 ──
            XaiTextField(
                value = uiState.serverUrl,
                onValueChange = viewModel::updateServerUrl,
                label = "服务器地址",
                placeholder = "http://192.168.1.100:8483"
            )
            Spacer(Modifier.height(14.dp))

            // ── 用户名 ──
            XaiTextField(
                value = uiState.username,
                onValueChange = viewModel::updateUsername,
                label = "用户名",
                placeholder = "请输入用户名"
            )
            Spacer(Modifier.height(14.dp))

            // ── 密码 ──
            PasswordField(
                value = uiState.password,
                onValueChange = viewModel::updatePassword,
                label = "密码"
            )

            // ── 错误提示 ──
            if (uiState.error != null) {
                Spacer(Modifier.height(10.dp))
                Text(
                    text = uiState.error!!,
                    color = XaiDanger,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Start,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Spacer(Modifier.height(16.dp))

            // ── 登录按钮 ──
            XaiButton(
                text = if (uiState.isLoading) "登录中" else "登录",
                onClick = viewModel::login,
                enabled = !uiState.isLoading,
                isLoading = uiState.isLoading
            )

            Spacer(Modifier.height(32.dp))

            // ── 版本号 ──
            Text(
                text = "VideoNote Android v1.0.0",
                style = TextStyle(
                    fontSize = 11.sp,
                    fontFamily = FontFamily.Monospace
                ),
                color = XaiMeta,
                textAlign = TextAlign.Center
            )
        }
    }
}

/// 密码输入框（带 PasswordVisualTransformation）
@Composable
private fun PasswordField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String
) {
    Column {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = XaiFg2,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .background(XaiSurfaceWarm)
                .border(
                    width = 1.dp,
                    color = XaiBorderStrong,
                    shape = androidx.compose.ui.graphics.RectangleShape
                )
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxHeight()) {
                Spacer(Modifier.width(14.dp))
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    textStyle = TextStyle(fontSize = 15.sp, color = XaiFg, fontFamily = FontFamily.Default),
                    modifier = Modifier.weight(1f),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(XaiFg)
                )
                Spacer(Modifier.width(14.dp))
            }
        }
    }
}
