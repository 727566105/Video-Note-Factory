package com.videonote.android.feature.notedetail

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.MaterialTheme

/**
 * 数据类：思维导图节点
 */
data class MindMapNode(
    val text: String,
    val level: Int,
    val children: MutableList<MindMapNode> = mutableListOf(),
    var x: Float = 0f,
    var y: Float = 0f,
    var width: Float = 0f,
    var height: Float = 0f
)

/**
 * 从 Markdown 标题层级解析树结构
 * 支持 # / ## / ###
 */
fun parseMarkdownToTree(markdown: String): MindMapNode {
    val lines = markdown.lines().filter { it.startsWith("#") }
    if (lines.isEmpty()) return MindMapNode("无标题", 0)

    val root = MindMapNode(text = lines.first().removePrefix("#").trim(), level = 0)
    val stack = mutableListOf(root)

    for (line in lines.drop(1)) {
        val level = line.takeWhile { it == '#' }.length
        val text = line.dropWhile { it == '#' }.trim()
        val node = MindMapNode(text = text, level = level)

        while (stack.isNotEmpty() && stack.last().level >= level) {
            stack.removeAt(stack.lastIndex)
        }
        if (stack.isNotEmpty()) {
            val parent = stack.last()
            parent.children.add(node)
        }
        stack.add(node)
    }
    return root
}

/**
 * 思维导图 Canvas 渲染
 * 支持双指缩放 + 拖拽平移
 */
@Composable
fun MindMapCanvas(
    markdown: String,
    modifier: Modifier = Modifier
) {
    val tree = remember(markdown) { parseMarkdownToTree(markdown) }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val textMeasurer = rememberTextMeasurer()
    val textColor = MaterialTheme.colorScheme.onSurface

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(0.5f, 3f)
                    offset += pan
                }
            }
    ) {
        // 布局：计算节点位置
        layoutTree(tree, size.width, size.height)

        // 绘制
        drawTree(tree, textMeasurer, textColor, scale, offset)
    }
}

private fun layoutTree(root: MindMapNode, canvasWidth: Float, canvasHeight: Float) {
    val nodeWidth = 120f
    val nodeHeight = 40f
    val horizontalGap = 40f
    val verticalGap = 20f

    // 简单布局：根节点在左侧，子节点向右展开
    root.x = 20f
    root.y = canvasHeight / 2
    root.width = nodeWidth
    root.height = nodeHeight

    layoutChildren(root, root.x + nodeWidth + horizontalGap, verticalGap)
}

private fun layoutChildren(parent: MindMapNode, childX: Float, gap: Float): Float {
    if (parent.children.isEmpty()) return parent.y

    val totalHeight = parent.children.size * (40f + gap) - gap
    var startY = parent.y - totalHeight / 2

    for (child in parent.children) {
        child.x = childX
        child.y = startY + 20f
        child.width = 120f
        child.height = 40f
        layoutChildren(child, childX + 120f + 40f, gap)
        startY += 40f + gap
    }
    return parent.y
}

private fun DrawScope.drawTree(
    node: MindMapNode,
    textMeasurer: TextMeasurer,
    textColor: Color,
    scale: Float,
    offset: Offset
) {
    // 绘制连线（贝塞尔曲线）
    for (child in node.children) {
        drawConnection(node, child, scale, offset)
        drawTree(child, textMeasurer, textColor, scale, offset)
    }

    // 绘制节点（圆角矩形 + 文字）
    val nodeColor = when (node.level) {
        0 -> Color(0xFF006A6A)
        1 -> Color(0xFF4A6363)
        else -> Color(0xFF4B6074)
    }

    val rect = androidx.compose.ui.geometry.Rect(
        offset = Offset(node.x * scale + offset.x, node.y * scale + offset.y),
        size = Size(node.width * scale, node.height * scale)
    )

    drawRect(
        color = nodeColor.copy(alpha = 0.2f),
        topLeft = rect.topLeft,
        size = rect.size
    )

    // 文字
    val measuredText = textMeasurer.measure(
        text = node.text.take(10),
        style = TextStyle(color = textColor, fontSize = 12.sp)
    )
    drawText(
        measuredText,
        topLeft = Offset(rect.left + 8f, rect.top + 8f)
    )
}

private fun DrawScope.drawConnection(
    parent: MindMapNode,
    child: MindMapNode,
    scale: Float,
    offset: Offset
) {
    val startX = (parent.x + parent.width) * scale + offset.x
    val startY = (parent.y + parent.height / 2) * scale + offset.y
    val endX = child.x * scale + offset.x
    val endY = (child.y + child.height / 2) * scale + offset.y
    val midX = (startX + endX) / 2

    val path = Path().apply {
        moveTo(startX, startY)
        cubicTo(midX, startY, midX, endY, endX, endY)
    }
    drawPath(path, color = Color.Gray, style = Stroke(width = 2f))
}
