package com.videonote.android.feature.notelist

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items as lazyItems
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.common.rememberImageProxyHelper
import com.videonote.android.core.designsystem.component.PlatformDot
import com.videonote.android.core.designsystem.component.VNEmpty
import com.videonote.android.core.designsystem.component.VNError
import com.videonote.android.core.designsystem.component.VNLoading
import com.videonote.android.core.designsystem.component.XaiCard
import com.videonote.android.core.designsystem.component.XaiIconButton
import com.videonote.android.core.designsystem.component.XaiListItem
import com.videonote.android.core.designsystem.component.XaiSectionLabel
import com.videonote.android.core.designsystem.component.XaiTabRow
import com.videonote.android.core.designsystem.component.XaiTextField
import com.videonote.android.core.designsystem.theme.XaiBg
import com.videonote.android.core.designsystem.theme.XaiBorder
import com.videonote.android.core.designsystem.theme.XaiBorderSoft
import com.videonote.android.core.designsystem.theme.XaiBorderStrong
import com.videonote.android.core.designsystem.theme.XaiFg
import com.videonote.android.core.designsystem.theme.XaiMuted
import com.videonote.android.core.designsystem.theme.XaiMeta
import com.videonote.android.core.designsystem.theme.XaiSurfaceWarm
import com.videonote.android.core.designsystem.theme.platformColor
import com.videonote.android.core.designsystem.theme.platformName
import com.videonote.android.core.network.dto.CollectionDto
import com.videonote.android.core.network.dto.TaskItem
import com.videonote.android.core.network.dto.formatDuration

/// 平台筛选候选（与原实现保持一致）
private val PLATFORM_FILTERS = listOf(
    "bilibili", "youtube", "douyin", "xiaohongshu", "kuaishou", "cctv"
)

@Composable
fun NoteListScreen(
    onNoteClick: (String) -> Unit,
    onCollectionClick: (String) -> Unit,
    viewModel: NoteListViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = rememberImageProxyHelper()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(XaiBg)
    ) {
        // 顶部粘性 Tab：全部笔记 / 收藏夹
        XaiTabRow(
            tabs = listOf("全部笔记", "收藏夹"),
            selectedIndex = uiState.selectedTab,
            onSelected = viewModel::selectTab
        )

        when (uiState.selectedTab) {
            0 -> AllNotesTab(uiState, viewModel, onNoteClick, imageProxyHelper)
            1 -> CollectionsTab(uiState, viewModel, onCollectionClick)
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// 全部笔记 Tab
// ═══════════════════════════════════════════════════════════════════

@Composable
private fun AllNotesTab(
    uiState: NoteListUiState,
    viewModel: NoteListViewModel,
    onNoteClick: (String) -> Unit,
    imageProxyHelper: ImageProxyHelper
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // 搜索框：Search 图标前缀 + 清除按钮
        XaiTextField(
            value = uiState.searchQuery,
            onValueChange = viewModel::updateSearch,
            placeholder = "搜索笔记...",
            singleLine = true,
            leadingIcon = {
                Icon(
                    Icons.Default.Search,
                    contentDescription = null,
                    tint = XaiMuted,
                    modifier = Modifier.size(18.dp)
                )
            },
            trailingIcon = {
                if (uiState.searchQuery.isNotEmpty()) {
                    XaiIconButton(
                        onClick = {
                            viewModel.updateSearch("")
                            viewModel.search()
                        },
                        icon = {
                            Icon(
                                Icons.Default.Clear,
                                contentDescription = "清除",
                                tint = XaiMuted,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    )
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(top = 12.dp, bottom = 10.dp)
        )

        // 平台筛选：横向滚动 Row，自定义 chip（边框 + 平台色点 + 大写名称）
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            PlatformFilterChip(
                label = "全部",
                selected = uiState.selectedPlatform == null,
                onClick = { viewModel.selectPlatform(null) },
                dotColor = null
            )
            PLATFORM_FILTERS.forEach { platform ->
                PlatformFilterChip(
                    label = platformName(platform),
                    selected = uiState.selectedPlatform == platform,
                    onClick = { viewModel.selectPlatform(platform) },
                    dotColor = platformColor(platform)
                )
            }
        }

        Spacer(Modifier.height(4.dp))

        // 笔记卡片网格（每行 2 张）
        if (uiState.tasks.isEmpty() && uiState.isLoading) {
            VNLoading(modifier = Modifier.weight(1f))
        } else if (uiState.tasks.isEmpty() && uiState.error != null) {
            // 错误态：显示错误信息 + 重试按钮（ViewModel.loadTasks 会清空 tasks 并置 error）
            VNError(
                message = "加载失败",
                onRetry = { viewModel.loadTasks(refresh = true) },
                modifier = Modifier.weight(1f)
            )
        } else if (uiState.tasks.isEmpty()) {
            VNEmpty(
                message = "暂无笔记",
                modifier = Modifier.weight(1f)
            )
        } else {
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth().weight(1f)
            ) {
                gridItems(uiState.tasks, key = { it.task_id }) { task ->
                    NoteCard(
                        task = task,
                        imageProxyHelper = imageProxyHelper,
                        onClick = { onNoteClick(task.task_id) }
                    )
                }
                if (uiState.hasMore && !uiState.isLoading) {
                    item { LaunchedEffect(Unit) { viewModel.loadTasks() } }
                }
            }
        }
    }
}

/// 平台筛选 chip：选中态白色边框，未选中灰色边框
@Composable
private fun PlatformFilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    dotColor: Color? = null
) {
    Row(
        modifier = Modifier
            .border(1.dp, if (selected) XaiFg else XaiBorderStrong)
            .clickable(onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        if (dotColor != null) {
            Box(modifier = Modifier.size(7.dp).background(dotColor))
        }
        Text(
            text = label.uppercase(),
            style = TextStyle(
                fontSize = 11.sp,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.6.sp
            ),
            color = if (selected) XaiFg else XaiMuted
        )
    }
}

/// 笔记卡片：封面图 16:9 + 时长 badge + 标题 + 作者/平台 meta
@Composable
private fun NoteCard(
    task: TaskItem,
    imageProxyHelper: ImageProxyHelper,
    onClick: () -> Unit
) {
    XaiCard(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        content = {
            // 封面图：16:9，通过图片代理加载（B站/抖音等有 Referer 限制）
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(16f / 9f)
                    .background(XaiSurfaceWarm)
                    .border(1.dp, XaiBorderSoft)
            ) {
                AsyncImage(
                    model = imageProxyHelper.getProxyUrl(task.cover_url, task.platform),
                    contentDescription = null,
                    modifier = Modifier.fillMaxSize()
                )
                // 右下角时长 badge（后端 duration 可能是 float 秒数或 "mm:ss"，统一格式化）
                task.duration.formatDuration()?.let { duration ->
                    Text(
                        text = duration,
                        style = TextStyle(
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.4.sp
                        ),
                        color = XaiFg,
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(6.dp)
                            .background(XaiBg.copy(alpha = 0.85f))
                            .border(1.dp, XaiBorderStrong)
                            .padding(horizontal = 5.dp, vertical = 2.dp)
                    )
                }
            }

            Spacer(Modifier.height(10.dp))

            // 标题（2 行省略，13.5sp）
            Text(
                text = task.title,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                style = TextStyle(
                    fontSize = 13.5.sp,
                    lineHeight = 18.sp,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.Medium
                ),
                color = XaiFg
            )

            Spacer(Modifier.height(8.dp))

            // 底部 meta 行：作者名 + PlatformDot + 平台名（11sp XaiMuted）
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(5.dp)
            ) {
                Text(
                    text = task.author.takeIf { it.isNotBlank() } ?: "未知作者",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = TextStyle(fontSize = 11.sp, fontFamily = FontFamily.Monospace),
                    color = XaiMuted,
                    modifier = Modifier.weight(1f, fill = false)
                )
                PlatformDot(platform = task.platform)
                Text(
                    text = platformName(task.platform).uppercase(),
                    style = TextStyle(
                        fontSize = 11.sp,
                        fontFamily = FontFamily.Monospace,
                        letterSpacing = 0.4.sp
                    ),
                    color = XaiMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    )
}

// ═══════════════════════════════════════════════════════════════════
// 收藏夹 Tab
// ═══════════════════════════════════════════════════════════════════

@Composable
private fun CollectionsTab(
    uiState: NoteListUiState,
    viewModel: NoteListViewModel,
    onCollectionClick: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(vertical = 12.dp)
    ) {
        // 区段标签
        item { XaiSectionLabel(text = "收藏夹") }

        // 新建按钮：ghost 样式，非全宽（"＋ 新建收藏夹"）
        // XaiButton 内部强制 fillMaxWidth，这里用自定义 Box 实现 ghost 非全宽效果
        item {
            Box(
                modifier = Modifier
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Row(
                    modifier = Modifier
                        .height(44.dp)
                        .border(1.dp, XaiBorderStrong)
                        .clickable { /* 新建收藏夹对话框 */ }
                        .padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Add,
                        contentDescription = null,
                        tint = XaiFg,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "新建收藏夹",
                        style = TextStyle(
                            fontSize = 13.sp,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 1.4.sp
                        ),
                        color = XaiFg
                    )
                }
            }
        }

        if (uiState.collections.isEmpty()) {
            item {
                VNEmpty(
                    message = if (uiState.collections.isEmpty() && !uiState.isLoading) "暂无收藏夹" else "加载中...",
                    modifier = Modifier.fillParentMaxSize(0.6f)
                )
            }
        } else {
            lazyItems(uiState.collections, key = { it.id }) { collection ->
                CollectionRow(collection = collection, onClick = { onCollectionClick(collection.id) })
            }
        }
    }
}

/// 收藏夹列表项：leading 56dp 方块图标 + 标题 + 副标题 + 箭头
@Composable
private fun CollectionRow(collection: CollectionDto, onClick: () -> Unit) {
    XaiListItem(
        title = collection.name,
        subtitle = buildCollectionSubtitle(collection),
        onClick = onClick,
        leading = {
            // 56dp 方块图标（收藏夹占位）
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .background(XaiSurfaceWarm)
                    .border(1.dp, XaiBorderStrong),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "★",
                    style = TextStyle(fontSize = 22.sp, fontFamily = FontFamily.Default),
                    color = XaiMuted
                )
            }
        },
        trailing = {
            Icon(
                Icons.Default.KeyboardArrowRight,
                contentDescription = null,
                tint = XaiMeta,
                modifier = Modifier.size(20.dp)
            )
        }
    )
}

/// 副标题：「N 篇笔记 · 更新于 日期」
private fun buildCollectionSubtitle(collection: CollectionDto): String {
    val count = "${collection.effectiveCount} 篇笔记"
    return if (collection.updated_at.isNotBlank()) {
        "$count · 更新于 ${collection.updated_at}"
    } else {
        count
    }
}
