# 整机迁移 —— 真实 1.6G 导入冒烟报告

> 日期：2026-06-26
> 被postgres测：整机包导出/导入（commit `cd657b5` + 本次 3 个修复）
- 真实 zip：`data/backups/videonote_backup_20260626_123545.zip`（1.6G，974 文件）
- 隔离：第二实例（backend 8484 + frontend 3016，DATA_DIR/DATABASE_URL 全指向 `/tmp/vn_smoke/data`），线上 8483 全程不动

## 结果：✅ 导入新机即用 成立

### 性能
- 上传 + 解压 + 替换 DB/video 总耗时：**8.86 秒**（1.6G zip）

### DB 行数比对（线上 vs 导入）
| 表 | 线上 | 导入 | 一致 |
|---|---|---|---|
| video_tasks | 142 | 142 | ✓ |
| collections | 1 | 1 | ✓ |
| collection_items | 2 | 2 | ✓ |
| collection_summaries | 1 | 1 | ✓ |
| feed_items | 277 | 277 | ✓ |
| providers | 8 | 8 | ✓ |
| subscriptions | 8 | 8 | ✓ |
| channel_videos | 96 | 96 | ✓ |
| users | 6 | 5 | 见下 |

**users 差异说明（非 bug）**：线上多出的 `testuser` 创建于 `2026-06-26 04:41 UTC`（= 本地 12:41，UTC+8），晚于备份时刻 **12:35:45**，故不在备份内。恢复是 `shutil.copy2` 字节级拷贝，不可能选择性丢行——导入 DB 即备份时刻线上 DB 的精确快照，5 个用户正是备份时状态。

### 媒体文件比对
- 线上视频目录文件数：**974**
- 导入视频目录文件数：**974** ✓ 完全一致
- 导入媒体总大小：**1.6G**
- 四级目录结构完整（cctv/bilibili/youtube/douyin/xiaohongshu/local 平台目录均在）

### API 层验证（导入后重启，admin/123456 登录）
- 登录成功（密码 = 线上 DB 密码，证明 DB 已替换）
- `GET /api/tasks?limit=1` 返回完整真实笔记（markdown + 转写 + 截图引用 + 作者信息 + 3 个历史版本）

### 浏览器验证（chrome-devtools-mcp，localhost:3016）
- 登录后首页加载，"动态 277"、"已完成 90/90" 与线上一致
- `/notes` 笔记列表：数十条真实笔记跨平台可见
- `/notes/<id>` 详情：封面图从 8484 加载成功（`naturalWidth=360, complete=true`）、完整 markdown 渲染、标签/作者/版本/下载音频/思维导图/转写齐全
- **控制台零报错**

### 截图
- `backend/test_screenshots/import_smoke_home.png`（首页）
- `backend/test_screenshots/import_smoke_notes.png`（笔记列表）
- `backend/test_screenshots/import_smoke_detail.png`（笔记详情，含封面）

## 过程中发现并修复的 3 个真 bug

| # | bug | 严重度 | 修复 |
|---|---|---|---|
| 1 | `restore_from_local_file`/`_rollback_restore` 调 `SessionLocal.remove()`，但 `SessionLocal` 是 `sessionmaker`（无 remove）→ 每次导入必崩，DB 从未替换 | **P0** | 改 `engine.dispose()`（commit `4e4b5a8`） |
| 2 | `pre_restore_<秒级时间戳>` 目录成功后不清理，同秒重复导入 `copytree` 撞已存在目录崩 | P2 | 加 rmtree-if-exists 守卫（commit `4d5e678`） |
| 3 | `/restore/{backup_name}` 先注册，shadow 掉 `/restore/upload` → 上传导入端点不可达，整机迁移 UI 导入从未工作 | **P1** | literal 路由移到 param 之前（本次 commit） |

## 已知 gap（未修，后续议）
1. configs 恢复不删旧 provider（upsert/不 delete）
2. 回滚不还原 configs
3. zip-slip：Python 3.12+ `extractall` 自身清洗 `../`（3.13 运行时安全）；Python <3.12（CI 3.11）无防护，建议加显式 `resolve()` 校验
4. DB schema 版本不一致时，覆盖后需重启 app 跑 `init_db` 迁移（本次冒烟已重启验证）

## 结论
整机迁移"导出 → 导入新机 → 立即使用"**端到端成立**：账号/笔记/合集/媒体/配置全量找回，API + UI 均可立即使用。3 个阻断性 bug 已修。
