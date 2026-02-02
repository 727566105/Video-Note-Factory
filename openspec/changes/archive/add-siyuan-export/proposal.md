# 添加思源笔记导出功能

## 概述

为 BiliNote 添加"导出到思源笔记"功能，允许用户将生成的笔记通过 API 直接推送到思源笔记实例中。

## 背景

当前 BiliNote 已支持：
- 导出为 PDF 文件（本地下载）
- 导出为 Markdown 文件（本地下载）
- 笔记版本管理

用户需求：
- 将笔记直接同步到思源笔记中进行二次整理
- 避免手动复制粘贴的繁琐操作
- 保持笔记在知识库中的组织结构

## 目标

1. 用户可在设置页面配置思源笔记连接信息
2. 在笔记详情页添加"导出到思源笔记"按钮
3. 点击后通过思源笔记 API 创建笔记文档
4. 支持自定义笔记本路径和文档标题

## 非目标

- 不支持从思源笔记同步回 BiliNote
- 不支持思源笔记的高级属性（如属性、关系图等）
- 不支持批量导出（可在后续版本添加）

## 影响范围

### 后端
- 新增：`app/routers/siyuan.py` - 思源笔记 API 路由
- 新增：`app/services/siyuan_exporter.py` - 思源笔记导出服务
- 修改：`app/db/models/siyuan_config.py` - 思源笔记配置表模型
- 修改：`app/db/siyuan_config_dao.py` - 思源笔记配置 DAO

### 前端
- 新增：`src/services/siyuan.ts` - 思源笔记 API 调用
- 新增：`src/store/siyuanStore/index.ts` - 思源笔记配置状态管理
- 修改：`src/pages/SettingPage/Siyuan.tsx` - 思源笔记设置页面
- 修改：`src/components/ExportSiyuanButton.tsx` - 导出按钮组件
- 修改：`src/pages/HomePage/components/MarkdownHeader.tsx` - 添加导出按钮

## 依赖项

- 思源笔记实例已启动并开放 API
- 用户拥有思源笔记的访问权限
- 用户提供有效的思源笔记 API 地址和 Token

## 风险与限制

1. **API 兼容性**：依赖思源笔记 API 稳定性，API 变更可能导致功能失效
2. **网络依赖**：需要网络连接到思源笔记实例
3. **Markdown 兼容**：BiliNote 生成的 Markdown 与思源笔记格式可能存在差异
4. **认证安全**：思源笔记 Token 需要安全存储

## 替代方案

- 手动复制粘贴（现有方式）
- 导出 Markdown 后手动导入思源笔记

## 验收标准

1. 用户可以成功配置思源笔记连接信息
2. 点击导出按钮后，笔记出现在思源笔记指定笔记本中
3. 导出失败时显示友好的错误提示
4. 支持 Markdown 内容的基本格式（标题、列表、代码块等）
