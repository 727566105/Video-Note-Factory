# 📑 文档索引

快速找到你需要的文档和工具

---

## 🚨 遇到问题？快速导航

| 问题               | 解决方案     | 文档/工具                                            |
| ------------------ | ------------ | ---------------------------------------------------- |
| ❌ JSONDecodeError | 运行一键修复 | `python fix_douyin_cookie.py`                        |
| 🍪 Cookie 格式错误 | 转换格式     | [QUICKSTART.md](./QUICKSTART.md)                     |
| ⚠️ Cookie 缺少字段 | 重新获取     | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) |
| 🔍 不知道哪里出错  | 运行诊断     | `python diagnose_douyin.py`                          |
| 📚 首次配置        | 查看指南     | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) |
| 🧪 测试功能        | 运行测试     | `python test_douyin_downloader.py`                   |

---

## 📚 文档列表

### 🚀 快速开始

| 文档                             | 适合人群             | 阅读时间 |
| -------------------------------- | -------------------- | -------- |
| [QUICKSTART.md](./QUICKSTART.md) | 遇到错误需要快速修复 | 3 分钟   |
| [README.md](./README.md)         | 想了解工具集概览     | 5 分钟   |

### 📖 详细文档

| 文档                                                 | 内容                   | 阅读时间 |
| ---------------------------------------------------- | ---------------------- | -------- |
| [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) | 完整的 Cookie 配置指南 | 15 分钟  |
| [SUMMARY.md](./SUMMARY.md)                           | 问题分析和修复总结     | 10 分钟  |
| [CHANGELOG.md](./CHANGELOG.md)                       | 更新日志和技术细节     | 10 分钟  |

---

## 🛠️ 工具列表

### 核心工具

| 工具                        | 功能               | 使用频率   |
| --------------------------- | ------------------ | ---------- |
| `fix_douyin_cookie.py`      | 🔧 一键修复 Cookie | ⭐⭐⭐⭐⭐ |
| `diagnose_douyin.py`        | 🔍 综合诊断        | ⭐⭐⭐⭐   |
| `cookie_converter.py`       | 🍪 Cookie 转换     | ⭐⭐⭐     |
| `test_douyin_downloader.py` | 🧪 功能测试        | ⭐⭐⭐     |

### 工具对比

| 特性     | fix_douyin_cookie | diagnose_douyin | cookie_converter | test_douyin_downloader |
| -------- | ----------------- | --------------- | ---------------- | ---------------------- |
| 自动修复 | ✅                | ❌              | ❌               | ❌                     |
| 格式转换 | ✅                | ❌              | ✅               | ❌                     |
| 字段验证 | ✅                | ✅              | ✅               | ✅                     |
| API 测试 | ❌                | ✅              | ❌               | ✅                     |
| 诊断报告 | ❌                | ✅              | ❌               | ❌                     |
| 下载测试 | ❌                | ❌              | ❌               | ✅                     |

---

## 🎯 使用场景

### 场景 1：首次配置 Cookie

**步骤**：

1. 阅读 [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) 的 "Cookie 获取方法" 章节
2. 使用 `cookie_converter.py update` 更新配置
3. 使用 `diagnose_douyin.py` 验证配置

**命令**：

```bash
python cookie_converter.py update douyin /path/to/cookies.txt
python diagnose_douyin.py --test-url "视频URL"
```

### 场景 2：遇到 JSONDecodeError

**步骤**：

1. 运行 `fix_douyin_cookie.py` 自动修复
2. 如果失败，查看 [QUICKSTART.md](./QUICKSTART.md)
3. 运行 `diagnose_douyin.py` 诊断问题

**命令**：

```bash
python fix_douyin_cookie.py
python diagnose_douyin.py --test-url "视频URL"
```

### 场景 3：Cookie 失效

**步骤**：

1. 重新登录抖音并导出 Cookie
2. 使用 `cookie_converter.py update` 更新
3. 使用 `test_douyin_downloader.py` 测试

**命令**：

```bash
python cookie_converter.py update douyin /path/to/new_cookies.txt
python test_douyin_downloader.py api "视频URL"
```

### 场景 4：定期维护

**步骤**：

1. 每周运行 `diagnose_douyin.py` 检查
2. 如有问题，重新获取 Cookie
3. 运行完整测试验证

**命令**：

```bash
python diagnose_douyin.py --test-url "视频URL"
```

---

## 📖 按主题查找

### Cookie 相关

| 主题            | 文档/工具                                                              |
| --------------- | ---------------------------------------------------------------------- |
| 如何获取 Cookie | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) § Cookie 获取方法 |
| Cookie 格式转换 | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) § Cookie 格式转换 |
| Cookie 验证     | `python cookie_converter.py validate douyin`                           |
| Cookie 更新     | `python cookie_converter.py update douyin <file>`                      |

### 错误处理

| 主题            | 文档/工具                                                          |
| --------------- | ------------------------------------------------------------------ |
| JSONDecodeError | [QUICKSTART.md](./QUICKSTART.md) § 快速修复                        |
| Cookie 格式错误 | [QUICKSTART.md](./QUICKSTART.md) § 情况 A                          |
| API 返回 HTML   | [QUICKSTART.md](./QUICKSTART.md) § 情况 B                          |
| Cookie 缺少字段 | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) § 常见问题 Q1 |

### 测试和诊断

| 主题        | 文档/工具                                         |
| ----------- | ------------------------------------------------- |
| 完整诊断    | `python diagnose_douyin.py --test-url "URL"`      |
| Cookie 测试 | `python test_douyin_downloader.py cookie`         |
| API 测试    | `python test_douyin_downloader.py api "URL"`      |
| 下载测试    | `python test_douyin_downloader.py download "URL"` |

### 技术细节

| 主题            | 文档                                      |
| --------------- | ----------------------------------------- |
| Cookie 转换算法 | [CHANGELOG.md](./CHANGELOG.md) § 技术细节 |
| 错误处理层级    | [SUMMARY.md](./SUMMARY.md) § 错误处理层级 |
| API 请求流程    | [SUMMARY.md](./SUMMARY.md) § API 请求流程 |
| 日志记录        | [SUMMARY.md](./SUMMARY.md) § 日志记录     |

---

## 🔍 常见问题快速查找

| 问题                 | 答案位置                                                           |
| -------------------- | ------------------------------------------------------------------ |
| Cookie 多久会失效？  | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) § 常见问题 Q3 |
| 如何调试 API 请求？  | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) § 常见问题 Q4 |
| 可以使用多个账号吗？ | [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) § 常见问题 Q5 |
| 如何查看日志？       | [SUMMARY.md](./SUMMARY.md) § 日志记录                              |
| 如何备份配置？       | [CHANGELOG.md](./CHANGELOG.md) § 迁移指南                          |

---

## 📊 文档结构

```
backend/tools/
├── README.md                    # 工具集概览（从这里开始）
├── QUICKSTART.md                # 快速修复指南（遇到问题先看这个）
├── README_DOUYIN_COOKIE.md      # 完整配置指南（详细文档）
├── SUMMARY.md                   # 问题修复总结（技术分析）
├── CHANGELOG.md                 # 更新日志（版本历史）
├── INDEX.md                     # 本文档（文档索引）
│
├── fix_douyin_cookie.py         # 一键修复工具
├── cookie_converter.py          # Cookie 转换工具
├── test_douyin_downloader.py    # 功能测试工具
└── diagnose_douyin.py           # 综合诊断工具
```

---

## 🎓 学习路径

### 初学者

1. 阅读 [README.md](./README.md) 了解工具集
2. 按照 [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) 配置 Cookie
3. 使用 `diagnose_douyin.py` 验证配置
4. 遇到问题查看 [QUICKSTART.md](./QUICKSTART.md)

### 进阶用户

1. 阅读 [SUMMARY.md](./SUMMARY.md) 了解技术细节
2. 查看 [CHANGELOG.md](./CHANGELOG.md) 了解实现
3. 自定义工具和配置
4. 贡献代码和文档

### 故障排除

1. 运行 `diagnose_douyin.py` 诊断
2. 查看 [QUICKSTART.md](./QUICKSTART.md) 找解决方案
3. 查看 [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) 常见问题
4. 查看日志文件
5. 提交 Issue

---

## 💡 提示

### 快速命令

```bash
# 进入工具目录
cd backend/tools

# 一键修复
python fix_douyin_cookie.py

# 完整诊断
python diagnose_douyin.py --test-url "视频URL"

# 查看帮助
python cookie_converter.py help
python test_douyin_downloader.py help
python diagnose_douyin.py --help
```

### 常用组合

```bash
# 配置 + 验证
python cookie_converter.py update douyin cookies.txt && \
python cookie_converter.py validate douyin

# 修复 + 测试
python fix_douyin_cookie.py && \
python test_douyin_downloader.py api "视频URL"

# 诊断 + 日志
python diagnose_douyin.py --test-url "视频URL" && \
tail -50 ../logs/app.log
```

---

## 📞 获取帮助

### 自助资源

1. **文档**: 查看本索引找到相关文档
2. **工具**: 使用 `--help` 参数查看工具帮助
3. **日志**: 查看 `backend/logs/app.log`
4. **诊断**: 运行 `diagnose_douyin.py`

### 社区支持

1. **Issue**: 提交详细的问题描述
2. **讨论**: 参与 GitHub Discussions
3. **贡献**: 提交 Pull Request

---

## 🔖 书签建议

建议收藏以下页面：

- ⭐ [QUICKSTART.md](./QUICKSTART.md) - 快速修复
- ⭐ [README.md](./README.md) - 工具概览
- ⭐ [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md) - 完整指南

---

**最后更新**: 2026-02-01  
**版本**: 1.0.0  
**维护者**: BiliNote Team
