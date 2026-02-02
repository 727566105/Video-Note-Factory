# 备份包含完整敏感信息说明

## 修改内容

现在备份文件（`bilinote_backup_*.zip`）中的 `configs.json` 包含**完整的敏感信息**，恢复后无需重新输入。

## 备份包含的敏感信息

### 1. AI 模型配置

- ✅ **API Key**（完整密钥，不再使用占位符）
- 提供商名称、类型、Base URL
- 启用状态

### 2. 思源笔记配置

- ✅ **API Token**（完整 Token，不再使用占位符）
- API 地址
- 默认笔记本

### 3. WebDAV 备份配置

- ✅ **密码**（完整密码，不再使用占位符）
- 服务器地址
- 用户名
- 备份路径
- 自动备份设置

### 4. 下载器配置

- Cookie 信息（存储在数据库中）
- 平台配置

## 使用场景

### 场景 1：系统迁移

1. 在旧系统执行"立即备份"
2. 下载备份文件到本地
3. 在新系统使用"导入本地备份"
4. ✅ **所有配置自动恢复，无需重新输入敏感信息**

### 场景 2：系统恢复

1. 系统出现问题需要恢复
2. 从 WebDAV 或本地选择备份文件
3. 执行恢复操作
4. ✅ **所有配置和数据完整恢复**

### 场景 3：多设备同步

1. 在设备 A 创建备份
2. 通过 WebDAV 同步到设备 B
3. 在设备 B 恢复备份
4. ✅ **两个设备配置完全一致**

## 安全建议

⚠️ **重要安全提示**：

1. **妥善保管备份文件**
   - 备份文件包含完整的 API Key、密码、Token
   - 不要将备份文件分享给他人
   - 不要上传到公共云存储

2. **使用加密存储**
   - WebDAV 服务器建议使用 HTTPS
   - 本地备份文件建议加密存储
   - 考虑使用密码保护的云存储

3. **定期更新密钥**
   - 定期更换 API Key 和密码
   - 更新后重新创建备份

4. **访问控制**
   - WebDAV 服务器设置强密码
   - 限制备份文件的访问权限
   - 使用防火墙保护 WebDAV 服务器

## 技术实现

### 导出配置（包含敏感信息）

```python
# backend/app/services/config_export.py
ConfigExporter.export_config(include_sensitive=True)
```

### 备份时包含完整配置

```python
# backend/app/services/webdav_backup.py
configs_json_path = ConfigExporter.save_configs_file(include_sensitive=True)
```

### 恢复时自动导入配置

```python
# backend/app/services/webdav_backup.py
def _restore_configs_from_backup(config_path: Path):
    # 恢复 WebDAV 配置（包含密码）
    # 恢复思源笔记配置（包含 Token）
    # 恢复 AI 模型配置（包含 API Key）
```

## 备份文件结构

```
bilinote_backup_20260202_143954.zip
├── bilinote.db                          # 数据库（任务历史、加密配置）
├── configs.json                         # 配置文件（包含完整敏感信息）
│   ├── providers                        # AI 模型（含 API Key）
│   ├── siyuan_config                    # 思源笔记（含 Token）
│   ├── webdav_config                    # WebDAV（含密码）
│   └── downloader_config                # 下载器配置
└── note_results/                        # 所有生成的笔记
    ├── *.md                             # Markdown 笔记
    ├── *.json                           # JSON 数据
    ├── *.pdf                            # PDF 导出
    └── *.status.json                    # 状态文件
```

## 与旧版本的区别

### 旧版本（脱敏）

```json
{
  "webdav_config": {
    "url": "https://dav.jianguoyun.com/dav/",
    "username": "user@example.com",
    "password": "********" // 占位符
  }
}
```

### 新版本（完整）

```json
{
  "webdav_config": {
    "url": "https://dav.jianguoyun.com/dav/",
    "username": "user@example.com",
    "password": "actual_password_here" // 完整密码
  }
}
```

## 常见问题

### Q: 备份文件安全吗？

A: 备份文件包含敏感信息，请妥善保管。建议：

- 使用 HTTPS 的 WebDAV 服务器
- 本地备份文件加密存储
- 不要分享给他人

### Q: 可以选择不包含敏感信息吗？

A: 当前版本备份时自动包含敏感信息。如需脱敏导出，可以使用"配置管理"中的"导出配置"功能。

### Q: 恢复后需要重启吗？

A: 建议恢复后刷新页面，配置会自动生效。

### Q: 数据库加密密钥不同怎么办？

A: 如果新旧系统使用不同的 `WEBDAV_ENCRYPTION_KEY`，数据库中的加密数据可能无法解密。但 `configs.json` 中的明文配置仍然可以正常恢复。

## 更新日志

- **2026-02-02**: 修改备份逻辑，configs.json 包含完整敏感信息
- **2026-02-02**: 更新恢复逻辑，自动导入 AI 模型、思源笔记、WebDAV 配置
- **2026-02-02**: 更新前端提示信息，说明备份包含敏感信息
