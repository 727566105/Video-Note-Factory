@file:OptIn(ExperimentalMaterial3Api::class)

package com.videonote.android.feature.settings

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun SettingsScreen(
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showChangePasswordDialog by remember { mutableStateOf(false) }
    var showServerUrlDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isLoggedOut) {
        if (uiState.isLoggedOut) onLogout()
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        // 用户信息卡片
        item {
            Card(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(uiState.username, style = MaterialTheme.typography.titleMedium)
                    Text(uiState.serverUrl, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                }
            }
        }

        // 服务器地址
        item {
            ListItem(
                headlineContent = { Text("服务器地址") },
                supportingContent = { Text(uiState.serverUrl) },
                modifier = Modifier.clickable { showServerUrlDialog = true }
            )
        }

        // 修改密码
        item {
            ListItem(
                headlineContent = { Text("修改密码") },
                modifier = Modifier.clickable { showChangePasswordDialog = true }
            )
        }

        // 深色模式
        item {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("深色模式", style = MaterialTheme.typography.bodyLarge)
                Row {
                    listOf("system" to "跟随系统", "light" to "浅色", "dark" to "深色").forEach { (value, label) ->
                        FilterChip(
                            selected = uiState.themeMode == value,
                            onClick = { viewModel.setThemeMode(value) },
                            label = { Text(label) },
                            modifier = Modifier.padding(end = 8.dp)
                        )
                    }
                }
            }
        }

        // 系统健康检查
        item {
            ListItem(
                headlineContent = { Text("系统健康检查") },
                supportingContent = uiState.healthStatus?.let { { Text(it) } },
                modifier = Modifier.clickable { viewModel.checkHealth() }
            )
        }

        // 关于
        item {
            ListItem(
                headlineContent = { Text("关于") },
                supportingContent = { Text("VideoNote Android v1.0.0") }
            )
        }

        // 退出登录
        item {
            Button(
                onClick = viewModel::logout,
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Text("退出登录")
            }
        }
    }

    // 消息提示
    uiState.message?.let { msg ->
        LaunchedEffect(msg) { /* 显示 Snackbar */ }
    }

    // 修改密码对话框
    if (showChangePasswordDialog) {
        AlertDialog(
            onDismissRequest = { showChangePasswordDialog = false },
            title = { Text("修改密码") },
            text = {
                Column {
                    OutlinedTextField(value = uiState.oldPassword, onValueChange = viewModel::updateOldPassword, label = { Text("旧密码") }, singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(value = uiState.newPassword, onValueChange = viewModel::updateNewPassword, label = { Text("新密码") }, singleLine = true)
                }
            },
            confirmButton = { TextButton(onClick = { viewModel.changePassword(); showChangePasswordDialog = false }) { Text("确认") } },
            dismissButton = { TextButton(onClick = { showChangePasswordDialog = false }) { Text("取消") } }
        )
    }

    // 修改服务器地址对话框
    if (showServerUrlDialog) {
        var newUrl by remember { mutableStateOf(uiState.serverUrl) }
        AlertDialog(
            onDismissRequest = { showServerUrlDialog = false },
            title = { Text("修改服务器地址") },
            text = {
                OutlinedTextField(value = newUrl, onValueChange = { newUrl = it }, label = { Text("服务器地址") }, singleLine = true)
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.updateServerUrl(newUrl)
                    showServerUrlDialog = false
                }) { Text("确认") }
            },
            dismissButton = { TextButton(onClick = { showServerUrlDialog = false }) { Text("取消") } }
        )
    }
}
