# WebDAV 备份功能实现任务

## 阶段 1：后端基础设施

### 1.1 数据库模型
- [ ] 创建 `webdav_configs` 表模型
- [ ] 创建 `backup_history` 表模型
- [ ] 更新数据库初始化脚本

### 1.2 DAO 层
- [ ] 实现 `webdav_config_dao.py`
  - [ ] `get_config()`
  - [ ] `upsert_config()`
  - [ ] `delete_config()`
  - [ ] `test_connection()`
- [ ] 实现 `backup_history_dao.py`
  - [ ] `add_backup_record()`
  - [ ] `get_backup_history()`
  - [ ] `get_latest_backup()`

### 1.3 依赖安装
- [ ] 添加 `webdavclient3` 到 requirements.txt
- [ ] 添加 `APScheduler` 到 requirements.txt
- [ ] 添加 `cryptography` 到 requirements.txt

## 阶段 2：WebDAV 备份服务

### 2.1 核心服务
- [ ] 创建 `webdav_backup.py` 服务类
  - [ ] `WebDAVBackup` 类初始化
  - [ ] `_get_webdav_client()` - 获取 WebDAV 客户端
  - [ ] `test_connection()` - 测试连接
  - [ ] `create_backup()` - 创建备份
    - [ ] 收集备份文件
    - [ ] 创建 ZIP 压缩包
    - [ ] 上传到 WebDAV
    - [ ] 记录备份历史
  - [ ] `list_backups()` - 列出所有备份
  - [ ] `restore_backup()` - 从备份恢复
    - [ ] 下载备份文件
    - [ ] 验证备份完整性
    - [ ] 停止服务
    - [ ] 解压并恢复文件
    - [ ] 重启服务

### 2.2 密码加密
- [ ] 实现 `encrypt_password()` - 加密密码
- [ ] 实现 `decrypt_password()` - 解密密码
- [ ] 配置环境变量 `WEBDAV_ENCRYPTION_KEY`

## 阶段 3：API 路由

### 3.1 配置管理
- [ ] `GET /api/webdav/config` - 获取配置（脱敏密码）
- [ ] `POST /api/webdav/config` - 保存配置
- [ ] `PUT /api/webdav/config` - 更新配置
- [ ] `DELETE /api/webdav/config` - 删除配置
- [ ] `POST /api/webdav/test` - 测试连接

### 3.2 备份操作
- [ ] `POST /api/webdav/backup` - 手动触发备份
- [ ] `GET /api/webdav/backup/status` - 获取备份状态
- [ ] `GET /api/webdav/backups` - 获取备份列表
- [ ] `DELETE /api/webdav/backups/{backup_id}` - 删除备份

### 3.3 恢复操作
- [ ] `POST /api/webdav/restore/{backup_id}` - 从备份恢复
- [ ] `POST /api/webdav/restore/validate/{backup_id}` - 验证备份

### 3.4 自动备份
- [ ] `POST /api/webdav/schedule/enable` - 启用自动备份
- [ ] `PUT /api/webdav/schedule` - 更新备份计划
- [ ] `DELETE /api/webdav/schedule` - 禁用自动备份
- [ ] `GET /api/webdav/schedule` - 获取备份计划

### 3.5 路由注册
- [ ] 在 `app/__init__.py` 中注册 WebDAV 路由
- [ ] 配置 CORS 中间件

## 阶段 4：定时任务

### 4.1 调度器设置
- [ ] 创建 `app/tasks/scheduler.py`
- [ ] 初始化 APScheduler
- [ ] 实现定时备份任务
- [ ] 在应用启动时启动调度器
- [ ] 在应用关闭时优雅停止调度器

### 4.2 任务执行
- [ ] 实现备份任务逻辑
- [ ] 添加任务执行日志
- [ ] 错误处理和重试机制

## 阶段 5：前端实现

### 5.1 服务层
- [ ] 创建 `src/services/webdav.ts`
  - [ ] `getConfig()`
  - [ ] `saveConfig()`
  - [ ] `updateConfig()`
  - [ ] `deleteConfig()`
  - [ ] `testConnection()`
  - [ ] `backup()`
  - [ ] `getBackupStatus()`
  - [ ] `getBackups()`
  - [ ] `restore()`
  - [ ] `getSchedule()`
  - [ ] `updateSchedule()`

### 5.2 状态管理
- [ ] 创建 `src/store/webdavStore/index.ts`
  - [ ] 配置状态
  - [ ] 备份状态
  - [ ] 定时任务状态
  - [ ] 加载/保存到 localStorage（可选）

### 5.3 设置页面
- [ ] 创建 `src/pages/SettingPage/WebDAV.tsx`
  - [ ] WebDAV 配置表单
  - [ ] 连接测试按钮
  - [ ] 自动备份设置
  - [ ] 备份历史列表
  - [ ] 恢复功能

### 5.4 备份按钮组件
- [ ] 创建 `src/components/BackupButton.tsx`
  - [ ] 备份按钮
  - [ ] 恢复按钮
  - [ ] 加载状态
  - [ ] 进度显示

### 5.5 路由集成
- [ ] 更新 `src/App.tsx` 添加 WebDAV 路由
- [ ] 更新 `src/pages/SettingPage/Menu.tsx` 添加菜单项
- [ ] 在笔记详情页添加备份按钮

## 阶段 6：测试与验证

### 6.1 单元测试
- [ ] 测试 WebDAV 配置 CRUD
- [ ] 测试密码加密/解密
- [ ] 测试备份服务
- [ ] 测试恢复服务
- [ ] 测试定时任务

### 6.2 集成测试
- [ ] 测试完整备份流程
- [ ] 测试完整恢复流程
- [ ] 测试自动备份
- [ ] 测试错误处理

### 6.3 用户验收测试
- [ ] 配置 WebDAV 连接
- [ ] 执行手动备份
- [ ] 查看备份历史
- [ ] 执行数据恢复
- [ ] 配置和测试自动备份

## 阶段 7：文档与部署

### 7.1 文档
- [ ] 更新 README.md 添加备份功能说明
- [ ] 编写用户使用指南
- [ ] 添加 API 文档

### 7.2 部署准备
- [ ] 配置环境变量
- [ ] 更新 requirements.txt
- [ ] 测试部署流程
- [ ] 编写部署文档

## 任务依赖关系

```
阶段1 (后端基础设施)
    │
    ├─▶ 阶段2 (WebDAV备份服务)
    │       │
    │       └─▶ 阶段3 (API路由)
    │               │
    │               └─▶ 阶段4 (定时任务)
    │
    └─▶ 阶段5 (前端实现) - 可与后端并行
            │
            └─▶ 阶段6 (测试与验证)
                    │
                    └─▶ 阶段7 (文档与部署)
```

## 并行化机会

以下任务可以并行开发：
- **前端状态管理** 与 **后端服务** 可并行
- **API 路由** 与 **定时任务** 可并行
- **备份功能** 与 **恢复功能** 可并行开发

## 验收标准

1. 用户可以在设置页面配置 WebDAV 连接
2. 点击"立即备份"按钮成功上传备份文件
3. 备份历史列表显示所有备份记录
4. 可以从备份恢复数据
5. 自动备份按计划执行
6. 所有操作有清晰的加载状态和错误提示
