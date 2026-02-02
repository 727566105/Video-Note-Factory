# 思源笔记导出功能 - 任务列表

## Phase 1: 后端基础功能

### 1.1 数据模型与 DAO
- [ ] 创建 `app/db/models/siyuan_config.py` - 思源笔记配置表模型
- [ ] 创建 `app/db/siyuan_export_history.py` - 导出历史表模型
- [ ] 创建 `app/db/siyuan_config_dao.py` - 配置 DAO 操作
  - `insert_config()` - 插入配置
  - `get_config()` - 获取配置
  - `update_config()` - 更新配置
  - `delete_config()` - 删除配置
  - `test_connection()` - 测试连接
- [ ] 创建 `app/db/siyuan_export_history_dao.py` - 导出历史 DAO
  - `add_export_record()` - 添加导出记录
  - `get_export_history()` - 获取导出历史
  - `get_task_export_history()` - 获取指定任务的导出历史

### 1.2 导出服务
- [ ] 创建 `app/services/siyuan_exporter.py` - 导出服务
  - `SiyuanExporter` 类
  - `export_note()` - 导出笔记
  - `get_notebooks()` - 获取笔记本列表
  - `test_connection()` - 测试连接
  - `_adapt_markdown()` - Markdown 格式适配
  - `_remove_anchors()` - 移除内部锚点

### 1.3 API 路由
- [ ] 创建 `app/routers/siyuan.py` - 思源笔记路由
  - `GET /api/siyuan/config` - 获取配置
  - `POST /api/siyuan/config` - 保存配置
  - `PUT /api/siyuan/config` - 更新配置
  - `GET /api/siyuan/notebooks` - 获取笔记本列表
  - `POST /api/siyuan/test` - 测试连接
  - `POST /api/export/siyuan/{task_id}` - 导出笔记
  - `GET /api/export/siyuan/history` - 获取导出历史
  - `GET /api/export/siyuan/history/{task_id}` - 获取指定任务的导出历史

### 1.4 集成
- [ ] 在 `app/__init__.py` 中注册思源笔记路由
- [ ] 初始化数据库时创建 `siyuan_configs` 和 `siyuan_export_history` 表

---

## Phase 2: 前端状态管理

### 2.1 服务层
- [ ] 创建 `src/services/siyuan.ts` - API 调用
  - `getConfig()` - 获取配置
  - `saveConfig()` - 保存配置
  - `updateConfig()` - 更新配置
  - `getNotebooks()` - 获取笔记本列表
  - `testConnection()` - 测试连接
  - `exportToSiyuan()` - 导出笔记
  - `getExportHistory()` - 获取导出历史
  - `getTaskExportHistory()` - 获取指定任务的导出历史

### 2.2 状态管理
- [ ] 创建 `src/store/siyuanStore/index.ts` - 配置状态管理
  - 状态：`config`, `notebooks`, `isConfigured`, `isTesting`, `isLoadingNotebooks`
  - 操作：`loadConfig()`, `saveConfig()`, `loadNotebooks()`, `testConnection()`
  - 持久化：使用 localStorage 缓存配置状态

---

## Phase 3: 前端 UI

### 3.1 设置页面
- [ ] 创建 `src/pages/SettingPage/Siyuan.tsx` - 思源笔记设置页面
  - API URL 输入框
  - API Token 输入框（密码类型，显示时隐藏）
  - 默认笔记本下拉选择（从 API 获取）
  - 测试连接按钮
  - 保存按钮
  - 配置状态显示
  - 导出历史列表

### 3.2 导出按钮
- [ ] 创建 `src/components/ExportSiyuanButton.tsx` - 导出按钮组件
  - 图标 + 文字（导出到思源笔记）
  - 加载状态
  - 成功/失败提示
  - 未配置时禁用或提示

### 3.3 笔记页面集成
- [ ] 修改 `src/pages/HomePage/components/MarkdownHeader.tsx`
  - 添加"导出到思源笔记"按钮
  - 与 PDF 导出按钮并列

### 3.4 导出历史页面
- [ ] 创建 `src/components/SiyuanExportHistory.tsx` - 导出历史组件
  - 显示导出历史列表
  - 显示导出状态（成功/失败）
  - 显示导出时间和目标笔记本
  - 支持按任务筛选

### 3.5 路由更新
- [ ] 在 `src/App.tsx` 中添加思源笔记设置路由
- [ ] 在设置页面菜单中添加"思源笔记"选项

---

## Phase 4: 测试与优化

### 4.1 功能测试
- [ ] 测试配置保存与读取
- [ ] 测试笔记本列表获取
- [ ] 测试连接验证（有效/无效配置）
- [ ] 测试笔记导出（各种 Markdown 格式）
- [ ] 测试错误处理（网络错误、认证失败等）
- [ ] 测试导出历史记录

### 4.2 用户体验优化
- [ ] 添加导出进度提示
- [ ] 优化错误提示信息
- [ ] 添加配置向导（首次使用）
- [ ] 添加导出历史查看和筛选
- [ ] 支持在笔记详情页查看该笔记的导出历史

### 4.3 文档
- [ ] 更新用户文档，说明思源笔记配置方法
- [ ] 添加常见问题解答

---

## 依赖关系

```
Phase 1 (后端基础)
    ↓
Phase 2 (前端状态) → Phase 3 (前端 UI)
    ↓                    ↓
Phase 4 (测试与优化)
```

## 可并行任务

- Phase 1 和 Phase 2 可以并行开发
- Phase 3 的各个组件可以并行开发

## 验证标准

每个任务完成后应验证：
1. 代码无 lint 错误
2. 功能正常工作
3. 错误场景有正确处理
4. 用户界面友好
