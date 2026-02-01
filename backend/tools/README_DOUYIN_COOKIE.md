# 抖音下载器 Cookie 配置指南

本指南将帮助你正确配置抖音下载器的 Cookie，解决 `JSONDecodeError` 等常见问题。

## 📋 目录

1. [问题说明](#问题说明)
2. [Cookie 获取方法](#cookie-获取方法)
3. [Cookie 格式转换](#cookie-格式转换)
4. [配置和测试](#配置和测试)
5. [常见问题](#常见问题)

---

## 🔍 问题说明

### 为什么会出现 JSONDecodeError？

抖音 API 返回空响应或 HTML 页面（而非 JSON），主要原因：

1. **Cookie 格式错误** - Netscape 格式未转换为浏览器格式
2. **Cookie 已失效** - 需要重新登录获取
3. **缺少必需字段** - Cookie 中缺少 `ttwid`、`sessionid` 等关键字段
4. **反爬虫拦截** - IP 被限制或触发验证

### 必需的 Cookie 字段

抖音 API 至少需要以下字段：

- `ttwid` - 设备标识
- `sessionid` - 会话 ID
- `__ac_signature` - 签名（推荐）

---

## 🍪 Cookie 获取方法

### 方法 1: 使用浏览器插件（推荐）

1. **安装 Cookie 导出插件**
   - Chrome/Edge: [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/)
   - Firefox: [Cookie-Editor](https://addons.mozilla.org/firefox/addon/cookie-editor/)

2. **登录抖音网页版**
   - 访问 https://www.douyin.com
   - 使用手机号或其他方式登录

3. **导出 Cookie**
   - 点击插件图标
   - 选择 "Export" → "Netscape HTTP Cookie File"
   - 保存为 `douyin_cookies.txt`

### 方法 2: 使用浏览器开发者工具

1. **打开开发者工具**
   - 按 `F12` 或右键 → "检查"
   - 切换到 "Application" 或 "存储" 标签

2. **复制 Cookie**
   - 左侧选择 "Cookies" → "https://www.douyin.com"
   - 复制所有 Cookie 的 Name 和 Value
   - 格式: `name1=value1; name2=value2; ...`

3. **保存到文件**
   ```bash
   echo "name1=value1; name2=value2; ..." > douyin_cookies.txt
   ```

---

## 🔄 Cookie 格式转换

### Netscape 格式 vs 浏览器格式

**Netscape 格式**（多行，tab 分隔）:

```
# Netscape HTTP Cookie File
.douyin.com	TRUE	/	TRUE	1804499051	enter_pc_once	1
.douyin.com	TRUE	/	TRUE	1788936466	UIFID_TEMP	fbdb87d5a2476c2110d380ab196dc0b2e120b256222505c00dbf25850b4110dd51f8eaf95ce2baa13ad3f9c2c6ec09c35246864aabb3ef269781eb349a21cbbee54c7a6b344340c9c60b8588e4853925
```

**浏览器格式**（单行，分号分隔）:

```
enter_pc_once=1; UIFID_TEMP=fbdb87d5a2476c2110d380ab196dc0b2e120b256222505c00dbf25850b4110dd51f8eaf95ce2baa13ad3f9c2c6ec09c35246864aabb3ef269781eb349a21cbbee54c7a6b344340c9c60b8588e4853925; ...
```

### 使用转换工具

我们提供了自动转换工具：

```bash
# 进入工具目录
cd backend/tools

# 转换 Cookie 文件
python cookie_converter.py convert douyin_cookies.txt douyin_converted.txt

# 直接更新到配置文件
python cookie_converter.py update douyin douyin_cookies.txt

# 验证配置
python cookie_converter.py validate douyin
```

---

## ⚙️ 配置和测试

### 1. 更新 Cookie 配置

**方法 A: 使用转换工具（推荐）**

```bash
cd backend/tools
python cookie_converter.py update douyin /path/to/douyin_cookies.txt
```

**方法 B: 手动编辑配置文件**

```bash
# 编辑配置文件
vim backend/config/downloader.json
```

```json
{
  "douyin": {
    "cookie": "enter_pc_once=1; UIFID_TEMP=xxx; ttwid=xxx; sessionid=xxx; ..."
  }
}
```

### 2. 验证 Cookie

```bash
cd backend/tools
python cookie_converter.py validate douyin
```

预期输出：

```
✅ Cookie 验证通过
📋 douyin Cookie 信息:
   长度: 5234 字符
   字段数: 45 个

🔍 检查 Cookie 字段:
   ✅ ttwid
   ✅ sessionid
   ✅ __ac_signature
```

### 3. 测试下载器

```bash
cd backend/tools

# 测试 Cookie 配置
python test_douyin_downloader.py cookie

# 测试 API 请求
python test_douyin_downloader.py api "https://www.douyin.com/video/7345492945006595379"

# 测试完整下载流程
python test_douyin_downloader.py download "https://v.douyin.com/0pcFVdG_lx4/"

# 运行所有测试
python test_douyin_downloader.py all "https://www.douyin.com/video/7345492945006595379"
```

---

## ❓ 常见问题

### Q1: 转换后仍然报错 "Cookie 缺少必需字段"

**原因**: Cookie 文件不完整或未登录

**解决方案**:

1. 确保已登录抖音网页版
2. 重新导出 Cookie
3. 检查导出的文件是否包含所有字段

### Q2: API 返回 HTML 页面而非 JSON

**原因**: 触发了反爬虫验证或 Cookie 失效

**解决方案**:

1. 在浏览器中访问抖音，确认能正常浏览
2. 重新获取 Cookie（可能需要重新登录）
3. 尝试更换 IP 或使用代理
4. 检查 User-Agent 是否与浏览器一致

### Q3: Cookie 多久会失效？

**答案**: 通常 7-30 天，取决于抖音的策略

**建议**:

- 定期更新 Cookie（每周一次）
- 保持浏览器登录状态
- 使用自动化脚本定期验证

### Q4: 如何调试 API 请求？

**方法**:

1. 查看详细日志

   ```bash
   tail -f backend/logs/app.log
   ```

2. 使用测试工具

   ```bash
   python test_douyin_downloader.py api "视频URL"
   ```

3. 检查响应内容
   - 测试工具会保存完整响应到 `douyin_video_*.json`
   - 查看响应状态码和内容类型

### Q5: 可以使用多个账号的 Cookie 吗？

**答案**: 可以，但需要修改代码

**方法**:

```python
# 在初始化时传入自定义 cookie
downloader = DouyinDownloader(cookie="your_custom_cookie_here")
```

---

## 🔧 高级配置

### 自定义 Cookie 管理器路径

```python
from app.services.cookie_manager import CookieConfigManager

# 使用自定义路径
cfm = CookieConfigManager(filepath="custom/path/cookies.json")
```

### 批量转换 Cookie

```bash
# 转换多个平台的 Cookie
for platform in douyin bilibili youtube; do
    python cookie_converter.py update $platform ${platform}_cookies.txt
done
```

### 定期验证脚本

创建 `check_cookies.sh`:

```bash
#!/bin/bash
cd backend/tools

platforms=("douyin" "bilibili" "youtube")

for platform in "${platforms[@]}"; do
    echo "检查 $platform Cookie..."
    python cookie_converter.py validate $platform
    echo ""
done
```

---

## 📚 相关文档

- [抖音 Web API 文档](https://developer.open-douyin.com/)
- [Cookie 规范](https://tools.ietf.org/html/rfc6265)
- [反爬虫最佳实践](https://github.com/Evil0ctal/Douyin_TikTok_Download_API)

---

## 🆘 获取帮助

如果遇到问题：

1. 查看日志文件: `backend/logs/app.log`
2. 运行诊断工具: `python test_douyin_downloader.py all <video_url>`
3. 提交 Issue 并附上:
   - 错误信息
   - 日志片段
   - Cookie 验证结果（隐藏敏感信息）

---

## ✅ 快速检查清单

- [ ] 已登录抖音网页版
- [ ] 已导出 Cookie 文件
- [ ] 已转换为浏览器格式
- [ ] Cookie 包含必需字段（ttwid, sessionid）
- [ ] 已更新到配置文件
- [ ] 验证通过
- [ ] 测试 API 请求成功

完成以上步骤后，抖音下载器应该可以正常工作了！🎉
