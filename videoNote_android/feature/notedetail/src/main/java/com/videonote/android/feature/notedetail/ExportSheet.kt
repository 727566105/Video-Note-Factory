package com.videonote.android.feature.notedetail

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * 导出 Bottom Sheet
 * 动态显示：始终可用项 + 条件可用项（检查配置）
 */
@Composable
fun ExportSheet(
    noteId: String,
    siyuanEnabled: Boolean,
    obsidianEnabled: Boolean,
    onCopyMarkdown: () -> Unit,
    onExportPdf: () -> Unit,
    onExportImage: () -> Unit,
    onExportSiyuan: () -> Unit,
    onExportObsidian: () -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("导出", style = MaterialTheme.typography.titleMedium)
            HorizontalDivider()

            // 始终可用
            ListItem(headlineContent = { Text("复制 Markdown") }, modifier = Modifier.clickable { onCopyMarkdown(); onDismiss() })
            ListItem(headlineContent = { Text("导出 PDF") }, modifier = Modifier.clickable { onExportPdf(); onDismiss() })
            ListItem(headlineContent = { Text("导出图片") }, modifier = Modifier.clickable { onExportImage(); onDismiss() })

            // 条件可用：只在已配置且已启用时显示
            if (siyuanEnabled) {
                HorizontalDivider()
                ListItem(headlineContent = { Text("导出到思源笔记") }, modifier = Modifier.clickable { onExportSiyuan(); onDismiss() })
            }
            if (obsidianEnabled) {
                ListItem(headlineContent = { Text("导出到 Obsidian") }, modifier = Modifier.clickable { onExportObsidian(); onDismiss() })
            }
        }
    }
}
