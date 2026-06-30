# 本地 Docker 编译部署验证 + 环境适配修复

**日期**: 2026-06-30
**状态**: 设计已确认，待实现
**作者**: yangzai

## 1. 背景与目标

项目今后统一用 Docker 部署。仓库里已有一整套 Docker 配置（三阶段根 `Dockerfile`、`docker-compose.yml` 拉 DockerHub 镜像、`docker-compose.dev.yml` 本地 build、`deploy.local.sh` 本地编译脚本、`deploy/` 下 nginx+supervisor+start.sh、GitHub 自动构建 workflow、完善的 `.dockerignore`）。

本次不是"从零 Docker 化"，而是**在本地用 docker 编译部署，跑通全流程并体检，发现并修复环境适配问题**。

### 核心目标（已与用户确认）

**全流程跑通 + 体检**——不只是"能启动"，还要验证关键功能路径在 Docker 环境下真能用。

### 已确认的决策

| 维度 | 决策 |
|------|------|
| 镜像来源 | **本地 build**（用 `docker-compose.dev.yml`，验证本地代码适配性） |
| 环境配置 | **直接用 `.env`**（端口 3015，宿主机空闲、与 dify 的 80 不冲突） |
| 适配坑处理 | **先原样跑看真实报错**（证据驱动，不预设修复） |
| 体检范围 | 基础访问闭环 + 导入/导出/备份 + 转写流程 + 导出图片/PDF（全选） |
| 提交 | **修复提交 + 推送 GitHub**（dev3.0 分支，作者 yangzai） |
| 数据隔离 | **体检后恢复原状**（体检前备份 `./data`） |

## 2. 执行策略：分层验证 + 渐进修复（方案 A）

把流程拆成**三个有明确验收标准的阶段**，每阶段"先原样跑 → 看真实报错 → 只修阻碍该阶段验收的问题 → 验收通过才进下一层"。问题定位精准、修复有据、可回溯。

### 核心原则（贯穿三阶段）

- 每个阶段都是"**先原样跑 → 看真实报错 → 只修阻碍该阶段验收的问题 → 验收通过才进下一层**"
- 修复只动**真正报错的**，不预设修复（即使嗅探到 weasyprint 风险，也要等阶段 3 真实导出失败才修）
- 每个修复都有**可复现的验收命令**，确保可回溯

## 3. 嗅探到的潜在适配疑点（待真实跑验证）

| # | 疑点 | 严重度 | 所属阶段 |
|---|------|--------|----------|
| 1 | `deploy.local.sh` 引用的 `.env.local` 不存在 | 高 | 阶段1 |
| 2 | 根 `Dockerfile` 只装了 `ffmpeg curl nginx supervisor gettext-base`，但 `weasyprint`(需 cairo/pango)、`pdf2image`(需 poppler)、`pdfkit`(需 wkhtmltopdf) 代码真实 import | 高 | 阶段3 |
| 3 | `backend/models/` 目录仓库里不存在，但 Dockerfile/start.sh 假设有 whisper 模型要拷贝 → 首次从 HF 在线下载 | 中 | 阶段3 |
| 4 | `playwright` 在 requirements 里但代码从未 import（死依赖，拖慢构建+镜像变大） | 低 | 阶段3 |
| 5 | 宿主机 80 端口被 dify nginx 占用（与本项目 3015 不冲突） | 低 | 阶段1 |

## 4. 数据隔离（体检前必做）

体检用的整机包数据（5.9G）会写进 `./data` 挂载卷。`./data` 里已有本地开发数据（1.4G）。整机包导入会**覆盖**（`_replace_dir` 是"删后拷贝"全替换语义）。

**体检前**：先备份 `./data` 现状（如 `mv data data.dev.bak` 或打 tar 包）。
**体检后**：停止容器，用备份恢复 `./data`，再决定是否重启容器回到体检前状态。

## 5. 阶段 1 · 构建/启动层

### 前置检查（动手前一次性确认）

| 检查项 | 命令 | 期望 |
|--------|------|------|
| 端口 3015 空闲 | `ss -tlnp \| grep 3015` | 无输出 |
| 无残留 videonote 容器 | `docker ps -a --filter name=videonote` | 空 |
| `.env` 关键变量 | `grep -E 'APP_PORT\|JWT_SECRET\|WEBDAV_ENCRYPTION' .env` | 三项都有值 |
| 构建上下文不含 data/ | `.dockerignore` 已排除 `/data/` | 已确认 ✓ |

### 执行步骤

```
1. 本地 build（原样，验证默认源能否拉包）
   docker compose -f docker-compose.dev.yml --env-file .env build
   监控点: 前端 pnpm install / 后端 pip install 是否成功
   可能报错: pip 拉包慢/超时 → 加 --build-arg PIP_INDEX_URL
             pnpm 拉包慢/超时 → 加 --build-arg NPM_REGISTRY
             wheel 编译失败（cryptography/ctranslate2）

2. 启动容器
   docker compose -f docker-compose.dev.yml --env-file .env up -d

3. 观察启动
   docker logs videonote -f --tail 100
   监控点: supervisor 拉起 backend+nginx / backend init_db+监听8483 /
           nginx 代理 /api /static /uploads / whisper 模型目录

4. 等待 healthy + 验收
   a. docker ps → videonote 状态含 (healthy)
   b. curl -s http://localhost:3015/api/health → 200 + JSON
   c. curl -sI http://localhost:3015/ → 200（前端首页）
   d. 确认 /api 走 nginx 代理
```

### 修的边界

**只修阻碍"容器 healthy + 三个 curl 通过"的问题。** 如镜像源拉不动加 `--build-arg`、`.env` 缺变量补上、nginx/supervisor 实际配置问题修 `deploy/`。

**不修**（留给后续阶段）：whisper 模型下载失败、weasyprint 系统库缺失、功能 API 报错。

### 失败回滚

build 或 up 卡死/失败 → `docker compose -f docker-compose.dev.yml down` 清理，分析日志后修，再重来，不残留半成品容器。

## 6. 阶段 2 · 数据/业务层

阶段 1 通过后，容器已能访问。本阶段验证"数据路径真能用"，覆盖近期一直在调的恢复/导入功能在 Docker 环境下的表现。

前提：需要一个**已登录的会话**做业务操作（默认 admin 账号，密码见 `.env` 的 `DEFAULT_ADMIN_PASSWORD`）。

### 体检清单（四项，逐个原样跑）

**体检项 2.1 · 配置导出**
- 操作：前端「导出配置」下载 `videonote_configs.json`（GET `/api/configs/export/file`）
- 验收：HTTP 200 + 合法 JSON（含 providers/models/configs）
- 关注点：FileResponse + Bearer token 走 nginx 代理

**体检项 2.2 · 配置导入**
- 操作：前端「导入配置」上传刚导出的 json → 预览 → 执行（POST `/api/configs/import/preview` + `/execute`）
- 验收：预览返回 available_items + 执行 success>0（sk-test 不再被跳过）
- 关注点：multipart 上传在 nginx 代理下、默认 admin 登录

**体检项 2.3 · 整机包导入**（核心，有真实样本）
- 样本：`/home/yangzai/桌面/videonote_backup_20260630_125052.zip`（5.9G、914 文件、完整性 OK）
- 样本特征：含 `video_note.db` + `configs.json` + `video/` 目录树；**35 段文件名超 255 字节（最长 263 字节）**，真实触发容错解压（截断<200字节）+ 自愈合
- 验收：
  - a. 5.9G 包上传成功（验证 nginx `client_max_body_size`）
  - b. 35 个超长目录被**截断**写入（非跳过），自愈合能找到
  - c. `video_note.db` 被正确替换（`engine.dispose()` + `_replace_dir`）
  - d. `configs.json` 还原（sk-test 不再跳过）
  - e. 笔记/视频列表正确显示导入数据
- 关注点：容器内解压大包临时空间（`.backup_temp` 挂载位置）、截断目录权限

**体检项 2.4 · WebDAV 备份**
- 操作：前端「WebDAV 备份」触发一次（走 webdav_backup 链路）
- 验收：备份任务 success + data 卷正确写入
- 关注点：`WEBDAV_ENCRYPTION_KEY` 从 `.env` 正确传入容器、备份临时目录权限
- **降级条件**：WebDAV 备份需要一个真实的 WebDAV 服务器凭证（url/user/pass），而本地 `.env` 只有加密密钥 `WEBDAV_ENCRYPTION_KEY`，连接信息存在 DB 配置表里（加密）。若当前无可用 WebDAV 服务器，降级为：验证备份链路**能正常发起**（任务进入 running、临时打包文件在容器内正确生成、加密密钥正确读取），远程上传失败属网络/凭证问题而非环境适配问题，不阻塞体检结论。

### 修的边界

**只修阻碍上述四项验收的问题。** 如 nginx 对大文件/长连接超时（`client_max_body_size`、`proxy_read_timeout`）修 `deploy/nginx.conf`；卷挂载路径不对核对 compose volumes；容器内写权限不足修权限/启动用户。

**不修**（留给阶段 3）：导出图片/PDF、转写。

### 诊断手段

每项失败：`docker logs videonote --tail 50` 看 traceback + DevTools Network（chrome-mcp）+ `docker exec videonote ls -la /app/data` 核对落盘 + 必要时 `docker exec videonote cat /app/logs/backend_error.log`。

## 7. 阶段 3 · 重依赖功能层

容器已能启动、数据路径已通，但**重系统库依赖的功能只有真正调用时才报错**——阶段 1/2 发现不了的盲区。

### 体检清单（三项）

**体检项 3.1 · 转写流程（ffmpeg + whisper）**
- 操作：选整机包里的短音频触发转写，或调转写接口
- 验收：ffmpeg 可用 + whisper 模型加载 + 产出 transcript.json
- 高风险：HF_ENDPOINT 在容器内能否拉到模型、ctranslate2 wheel 完整性、模型缓存目录 `/app/data/models/whisper` 读写权限

**体检项 3.2 · 导出图片（weasyprint + pdf2image）★最高风险**
- 操作：选已有笔记 → 导出为图片（走 `image_export.py` 的 HTML→PDF→图片链路）
- 验收：真实导出图片成功（非 500）+ 中文不乱码
- 硬伤：weasyprint 需 cairo/pango/gdk-pixbuf（根 Dockerfile 未装）→ 大概率报 "cannot load library libpango"；pdf2image 需 poppler-utils；中文需 fonts-noto-cjk（`backend/fonts/arial.ttf` 不含中文）

**体检项 3.3 · 导出 PDF（markdown_pdf / weasyprint）**
- 操作：选已有笔记 → 导出为 PDF
- 验收：真实导出 PDF 成功 + 中文正常
- 关注点：markdown_pdf 依赖 weasyprint（同 3.2 系统库）；或走 pdfkit（需 wkhtmltopdf，未装）

### 修的边界与策略

预计修复集中爆发：

| 问题 | 修复方向 | 改动文件 |
|------|----------|----------|
| weasyprint 缺 cairo/pango | `apt-get install libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf2.0-0` | `Dockerfile` |
| pdf2image 缺 poppler | `apt-get install poppler-utils` | `Dockerfile` |
| pdfkit 缺 wkhtmltopdf | `apt-get install wkhtmltopdf`（若代码真用到） | `Dockerfile` |
| 中文方块 | `apt-get install fonts-noto-cjk` | `Dockerfile` |
| whisper 模型拉取失败 | 确认 HF_ENDPOINT 生效 / 预下载模型 | `start.sh` 或文档 |

**策略**：每修一个系统库 → 重新 build → 只重跑对应那项体检验证（不全量重跑），节省时间。

### 失败降级

- whisper 模型因网络拉不到（非 Docker 问题）：降级为只验证 `ffmpeg -version` + `ctranslate2` import 成功 + 模型目录可写，转写完整流程留待有网络时补测，不阻塞结论。
- 某项报错是**代码 bug**（非环境缺失）：记录进报告，不在此阶段深入修（超出"环境适配"范围）。

## 8. 收尾

### 修复提交 + 推送

- 分支：dev3.0（与近期提交一致）
- 作者：yangzai `<wangxuyang727566105@gmail.com>`
- 改动：主要是 Dockerfile 系统库（阶段3），可能含 `.env`/compose 微调（阶段1/2）
- 远程：`factory` → github.com/727566105/Video-Note-Factory.git
- commit message 聚焦"本地 Docker 部署适配"

### 体检报告（最终交付物）

每一项 ✅/❌ + 真实证据 + 修复说明：
- 阶段1 启动：容器状态 / curl 输出
- 阶段2 数据：导入条数 / 落盘路径 / DB 状态
- 阶段3 功能：导出文件是否存在 / 转写是否产出
- 适配修复：Dockerfile 改了什么、为什么

### 数据恢复

体检完成后：停容器 → 用体检前备份恢复 `./data` → 恢复体检前运行状态。

## 9. 范围边界

**本次做**：本地 docker build + 全流程跑通 + 四类体检 + 环境适配修复（Dockerfile/compose/.env/deploy）+ 提交推送 + 体检报告 + 数据恢复。

**本次不做**：功能 bug 修复（非环境缺失导致的）、CI/CD 改造、镜像瘦身优化（playwright 死依赖清理等留作后续）、多架构构建。
