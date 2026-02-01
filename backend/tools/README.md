# 🛠️ BiliNote 工具集

抖音下载器配置和诊断工具集合

---

## 📦 工具列表

| 工具                        | 功能               | 使用场景                        |
| --------------------------- | ------------------ | ------------------------------- |
| `fix_douyin_cookie.py`      | 🔧 一键修复 Cookie | 遇到 JSONDecodeError 时首先运行 |
| `cookie_converter.py`       | 🍪 Cookie 格式转换 | 转换和管理 Cookie               |
| `test_douyin_downloader.py` | 🧪 功能测试        | 测试下载器各项功能              |
| `diagnose_douyin.py`        | 🔍 综合诊断        | 全面检查配置和功能              |

---

## 🚀 快速开始

### 1️⃣ 首次配置 Cookie

```bash
cd backend/tools

# 方法 A: 从浏览器导出 Cookie 文件后更新
python cookie_converter.py update douyin /path/to/douyin_cookies.txt

# 方法 B: 如果已有配置但格式错误，运行修复
python fix_douyin_cookie.py
```

### 2️⃣ 验证配置

```bash
# 验证 Cookie
python cookie_converter.py validate douyin

# 或运行完整诊断
python diagnose_douyin.py
```

### 3️⃣ 测试功能

```bash
# 测试 API 请求
python test_douyin_downloader.py api "https://www.douyin.com/video/7345492945006595379"

# 或运行所有测试
python test_douyin_downloader.py all "视频URL"
```

---

## 🔧 工具详解

### `fix_douyin_cookie.py` - 一键修复工具

**功能**：

- ✅ 自动检测 Cookie 格式问题
- ✅ 转换 Netscape 格式为浏览器格式
- ✅ 验证必需字段（ttwid, sessionid）
- ✅ 自动备份原配置
- ✅ 更新配置文件

**使用**：

```bash
python fix_douyin_cookie.py
```

**输出示例**：

```
============================================================
🔧 抖音 Cookie 快速修复工具
============================================================

📁 配置文件: /path/to/config/downloader.json

📊 当前 Cookie 信息:
   长度: 5234 字符
   前 100 字符: # Netscape HTTP Cookie File...

🔍 检测到 Netscape 格式 Cookie
   正在转换为浏览器格式...
✅ 转换成功
   新长度: 4521 字符
   字段数: 45 个

✅ Cookie 包含所有必需字段

💾 备份原配置到: /path/to/config/downloader.json.backup
✅ 配置文件已更新

============================================================
🎉 修复完成！
============================================================

下一步:
  1. 验证 Cookie: python cookie_converter.py validate douyin
  2. 测试下载: python test_douyin_downloader.py api <video_url>
```

---

### `cookie_converter.py` - Cookie 转换工具

**功能**：

- 🔄 转换 Cookie 文件格式
- 💾 更新配置文件
- ✅ 验证 Cookie 有效性

**命令**：

```bash
# 转换 Cookie 文件
python cookie_converter.py convert <input_file> [output_file]

# 更新到配置文件（自动转换）
python cookie_converter.py update <platform> <cookie_file>

# 验证 Cookie
python cookie_converter.py validate <platform>

# 显示帮助
python cookie_converter.py help
```

**示例**：

```bash
# 转换并保存到新文件
python cookie_converter.py convert douyin_cookies.txt douyin_converted.txt

# 直接更新抖音配置
python cookie_converter.py update douyin douyin_cookies.txt

# 验证抖音 Cookie
python cookie_converter.py validate douyin
```

**验证输出示例**：

```
📋 douyin Cookie 信息:
   长度: 4521 字符
   字段数: 45 个
   前 100 字符: enter_pc_once=1; ttwid=xxx; sessionid=xxx...

✅ Cookie 验证通过

🔍 检查 Cookie 字段:
   ✅ ttwid
   ✅ sessionid
   ✅ __ac_signature
```

---

### `test_douyin_downloader.py` - 功能测试工具

**功能**：

- 🍪 测试 Cookie 配置
- 🔍 测试视频 ID 提取
- 🌐 测试 API 请求
- ⬇️ 测试视频下载

**命令**：

```bash
# 测试 Cookie 配置
python test_douyin_downloader.py cookie

# 测试视频 ID 提取
python test_douyin_downloader.py extract

# 测试 API 请求
python test_douyin_downloader.py api <video_url>

# 测试视频下载
python test_douyin_downloader.py download <video_url>

# 运行所有测试
python test_douyin_downloader.py all <video_url>

# 显示帮助
python test_douyin_downloader.py help
```

**示例**：

```bash
# 测试 Cookie
python test_douyin_downloader.py cookie

# 测试 API（推荐先运行此测试）
python test_douyin_downloader.py api "https://www.douyin.com/video/7345492945006595379"

# 运行完整测试
python test_douyin_downloader.py all "https://www.douyin.com/video/7345492945006595379"
```

**输出示例**：

```
============================================================
🌐 测试 API 请求
============================================================
📹 视频 URL: https://www.douyin.com/video/7345492945006595379
✅ 视频 ID: 7345492945006595379

🔄 正在请求 API...
✅ API 请求成功

📋 视频信息:
   标题: 以"马成钢"的视角打开《抓娃娃》笼中鸟，何时飞
   作者: 某某用户
   点赞: 12345
   评论: 678
   分享: 90

💾 完整响应已保存到: douyin_video_7345492945006595379.json
```

---

### `diagnose_douyin.py` - 综合诊断工具

**功能**：

- 📊 一键运行所有诊断测试
- 📝 生成详细诊断报告
- 💡 提供针对性修复建议

**命令**：

```bash
# 基础诊断（不测试 API）
python diagnose_douyin.py

# 完整诊断（包括 API 测试）
python diagnose_douyin.py --test-url <video_url>

# 显示帮助
python diagnose_douyin.py --help
```

**示例**：

```bash
# 快速诊断
python diagnose_douyin.py

# 完整诊断
python diagnose_douyin.py --test-url "https://www.douyin.com/video/7345492945006595379"
```

**输出示例**：

```
======================================================================
🔧 抖音下载器综合诊断工具
======================================================================

正在运行诊断测试，请稍候...

🔍 [1/6] 检查配置文件...
🔍 [2/6] 检查 Cookie 配置...
🔍 [3/6] 检查 Cookie 格式...
🔍 [4/6] 检查 Cookie 必需字段...
🔍 [5/6] 测试视频 ID 提取...
🔍 [6/6] 测试 API 请求...

======================================================================
📊 诊断报告
======================================================================

✅ 配置文件格式
   配置文件格式正确
   • 路径: /path/to/config/downloader.json
   • 大小: 5234 字节

✅ Cookie 配置
   Cookie 已配置
   • 长度: 4521 字符
   • 字段数: 45 个

✅ Cookie 格式
   Cookie 格式正确（浏览器格式）
   • 格式: name1=value1; name2=value2; ...

✅ Cookie 必需字段
   包含所有必需字段
   • 必需字段: ttwid, sessionid

✅ 视频 ID 提取
   成功提取 2/2 个测试用例
   • 功能: 正常

✅ API 请求
   API 请求成功
   • 视频标题: 以"马成钢"的视角打开《抓娃娃》笼中鸟，何时飞
   • 作者: 某某用户
   • 点赞数: 12345

======================================================================
总计: 6/6 测试通过
🎉 所有测试通过！抖音下载器配置正常
诊断耗时: 2.34 秒
======================================================================
```

---

## 📚 文档

| 文档                      | 内容                         |
| ------------------------- | ---------------------------- |
| `README_DOUYIN_COOKIE.md` | 完整的 Cookie 配置指南       |
| `QUICKSTART.md`           | 快速修复指南（3 步解决问题） |
| `SUMMARY.md`              | 问题分析和修复总结           |
| `README.md`               | 本文档（工具集概览）         |

---

## 🔄 典型工作流程

### 场景 1：首次配置

```bash
# 1. 从浏览器导出 Cookie
#    - 访问 https://www.douyin.com 并登录
#    - 使用 EditThisCookie 等插件导出

# 2. 更新配置
python cookie_converter.py update douyin /path/to/douyin_cookies.txt

# 3. 验证
python cookie_converter.py validate douyin

# 4. 测试
python test_douyin_downloader.py api "视频URL"
```

### 场景 2：遇到 JSONDecodeError

```bash
# 1. 运行自动修复
python fix_douyin_cookie.py

# 2. 验证修复结果
python cookie_converter.py validate douyin

# 3. 测试 API
python test_douyin_downloader.py api "视频URL"

# 4. 如果仍然失败，运行完整诊断
python diagnose_douyin.py --test-url "视频URL"
```

### 场景 3：Cookie 失效

```bash
# 1. 重新登录抖音并导出 Cookie

# 2. 更新配置
python cookie_converter.py update douyin /path/to/new_cookies.txt

# 3. 验证
python diagnose_douyin.py --test-url "视频URL"
```

### 场景 4：定期维护

```bash
# 每周运行一次诊断
python diagnose_douyin.py --test-url "视频URL"

# 如果发现问题，重新获取 Cookie
python cookie_converter.py update douyin /path/to/new_cookies.txt
```

---

## 🐛 故障排除

### 问题：Cookie 格式错误

**症状**：

```
❌ Cookie 格式
   Cookie 是 Netscape 格式，需要转换
```

**解决**：

```bash
python fix_douyin_cookie.py
```

### 问题：缺少必需字段

**症状**：

```
❌ Cookie 必需字段
   Cookie 缺少必需字段: ttwid, sessionid
```

**解决**：

1. 确保已登录抖音网页版
2. 重新导出完整的 Cookie
3. 更新配置：
   ```bash
   python cookie_converter.py update douyin /path/to/new_cookies.txt
   ```

### 问题：API 返回 HTML

**症状**：

```
❌ API 请求
   抖音 API 返回 HTML 页面而非 JSON
```

**解决**：

1. Cookie 可能已失效，重新获取
2. 可能触发反爬虫，更换 IP 或稍后重试
3. 在浏览器中确认能正常访问抖音

### 问题：请求超时

**症状**：

```
❌ API 请求
   抖音 API 请求超时
```

**解决**：

1. 检查网络连接
2. 尝试使用代理
3. 增加超时时间（修改代码中的 timeout 参数）

---

## 💡 最佳实践

### Cookie 管理

1. **定期更新** - 建议每周更新一次 Cookie
2. **完整导出** - 确保导出所有 Cookie 字段
3. **验证配置** - 每次更新后运行验证
4. **备份配置** - 工具会自动备份，但建议手动备份重要配置

### 测试流程

1. **先验证 Cookie** - 使用 `validate` 命令
2. **再测试 API** - 使用 `test_douyin_downloader.py api`
3. **最后测试下载** - 确认完整流程
4. **定期诊断** - 使用 `diagnose_douyin.py`

### 调试技巧

1. **查看日志** - `tail -f backend/logs/app.log`
2. **保存响应** - 测试工具会自动保存 API 响应到 JSON 文件
3. **对比差异** - 将失败的响应与成功的响应对比
4. **逐步排查** - 使用诊断工具逐项检查

---

## 🔗 相关链接

- **抖音开放平台**: https://developer.open-douyin.com/
- **Cookie 规范**: https://tools.ietf.org/html/rfc6265
- **EditThisCookie 插件**: https://chrome.google.com/webstore/detail/editthiscookie/

---

## 📞 获取帮助

### 自助诊断

```bash
# 1. 运行完整诊断
python diagnose_douyin.py --test-url "视频URL" > diagnosis.txt 2>&1

# 2. 查看日志
tail -100 backend/logs/app.log >> diagnosis.txt

# 3. 查看诊断结果
cat diagnosis.txt
```

### 提交 Issue

如果问题仍未解决，请提交 Issue 并附上：

1. `diagnosis.txt` 文件（删除敏感信息）
2. 操作系统和 Python 版本
3. 详细的错误描述和复现步骤

### 临时解决方案

- 使用其他平台（B站、YouTube 等）
- 使用本地文件上传功能
- 等待 Cookie 刷新后重试

---

## 📝 更新日志

### v1.0.0 (2026-02-01)

**新增**：

- ✨ Cookie 自动格式转换
- ✨ 一键修复工具
- ✨ 综合诊断工具
- ✨ 完整的测试套件
- ✨ 详细的文档

**改进**：

- 🔧 增强的错误处理
- 🔧 详细的日志记录
- 🔧 友好的错误提示

**修复**：

- 🐛 JSONDecodeError 问题
- 🐛 Cookie 格式问题
- 🐛 API 响应验证问题

---

**维护者**: BiliNote Team  
**最后更新**: 2026-02-01  
**版本**: 1.0.0
