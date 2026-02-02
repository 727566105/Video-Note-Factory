# 新增 WebDAV 备份功能

## 概述

为 BiliNote 添加 WebDAV 备份功能，允许用户将生成的笔记数据和数据库配置备份到 WebDAV 服务器（如坚果云、Nextcloud、ownCloud 等），支持手动备份和定时自动备份。

## 背景

当前 BiliNote 的数据存储在：
- 本地文件系统 `note_results/` 目录 - 存储生成的 Markdown、音频缓存、JSON 元数据
- SQLite 数据库 - 存储任务记录、模型配置、思源笔记配置等

**风险：**
- 硬盘损坏导致数据丢失
- 误操作删除重要笔记
- 设备更换无法迁移数据
- 无历史版本恢复机制

**用户需求：**
- 数据安全：定期备份到云端
- 便捷恢复：一键恢复数据
- 自动化：无需手动操作

## 目标

1. **配置管理**：用户可在设置页面配置 WebDAV 连接信息（地址、用户名、密码、路径）
2. **手动备份**：点击按钮立即备份数据到 WebDAV
3. **数据恢复**：从 WebDAV 恢复备份的数据
4. **自动备份**：支持定时自动备份（每日/每周）
5. **备份历史**：查看备份历史记录

## 非目标

- 不支持增量备份（每次都是全量备份）
- 不支持多备份点管理（只保留最新备份）
- 不支持备份冲突解决
- 不支持压缩备份（直接上传原始文件）

## 影响范围

### 后端
- 新增：`app/db/models/webdav_config.py` - WebDAV 配置表模型
- 新增：`app/db/webdav_config_dao.py` - WebDAV 配置 DAO
- 新增：`app/db/backup_history_dao.py` - 备份历史 DAO
- 新增：`app/services/webdav_backup.py` - WebDAV 备份服务
- 新增：`app/routers/webdav.py` - WebDAV API 路由
- 新增：`app/tasks/scheduler.py` - 定时任务调度器（如使用 APScheduler）

### 前端
- 新增：`src/services/webdav.ts` - WebDAV API 调用
- 新增：`src/store/webdavStore/index.ts` - WebDAV 配置状态管理
- 新增：`src/pages/SettingPage/WebDAV.tsx` - WebDAV 设置页面
- 新增：`src/components/BackupButton.tsx` - 备份按钮组件
- 修改：`src/pages/SettingPage/Menu.tsx` - 添加 WebDAV 菜单项
- 修改：`src/App.tsx` - 添加 WebDAV 路由

## 依赖项

- WebDAV 服务器已启动并可访问
- 用户拥有 WebDAV 服务器的写入权限
- Python `webdavclient3` 库用于 WebDAV 操作
- 后端定时任务框架（APScheduler 或 schedule）

## 风险与限制

1. **网络依赖**：需要网络连接到 WebDAV 服务器
2. **存储空间**：WebDAV 服务器需要有足够的存储空间
3. **认证安全**：WebDAV 凭据需要安全存储
4. **备份时间**：大量数据备份可能耗时较长
5. **文件覆盖**：同名文件会被覆盖，无法回滚到旧版本

## 备份策略

**备份内容：**
1. `note_results/` 目录下所有文件
2. SQLite 数据库文件（整个 `.db` 文件）

**备份文件结构：**
```
{webdav_path}/
├── backups/
│   ├── bilinote_{timestamp}.db          # 数据库备份
│   ├── note_results_{timestamp}.zip      # 笔记文件备份
│   └── backup_info_{timestamp}.json      # 备份元信息
└── .bilinote/
    └── backup_history.json                # 备份历史记录
```

## 替代方案

- 手动复制 `note_results/` 和数据库文件
- 使用云存储服务（如百度网盘、OneDrive）同步
- 数据库导出 SQL 脚本手动备份
