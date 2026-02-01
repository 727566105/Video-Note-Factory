# 🚀 抖音下载器快速修复指南

如果你遇到 `JSONDecodeError` 错误，按照以下步骤快速修复。

## ⚡ 快速修复（3 步）

### 1️⃣ 运行自动修复工具

```bash
cd backend/tools
python fix_douyin_cookie.py
```

这个工具会：

- ✅ 自动检测 Cookie 格式
- ✅ 转换 Netscape 格式为浏览器格式
- ✅ 验证必需字段
- ✅ 备份原配置
- ✅ 更新配置文件

### 2️⃣ 验证修复结果

```bash
python cookie_converter.py validate douyin
```

预期输出：

```
✅ Cookie 验证通过
📋 douyin Cookie 信息:
   长度: 5234 字符
   字段数: 45 个
```

### 3️⃣ 测试下载功能

```bash
# 替换为你要测试的抖音视频 URL
python test_douyin_downloader.py api "https://www.douyin.com/video/7345492945006595379"
```

成功输出示例：

```
✅ API 请求成功
📋 视频信息:
   标题: xxx
   作者: xxx
   点赞: 1234
```

---

## 🔧 如果自动修复失败

### 情况 A: Cookie 缺少必需字段

**症状**:

```
⚠️  Cookie 缺少必需字段: ttwid, sessionid
```

**解决方案**:

1. **重新获取 Cookie**（使用浏览器插件）

   a. 安装 [EditThisCookie](https://chrome.google.com/webstore/detail/editthiscookie/) (Chrome/Edge)

   b. 访问 https://www.douyin.com 并登录

   c. 点击插件图标 → Export → Netscape HTTP Cookie File

   d. 保存为 `douyin_cookies.txt`

2. **更新配置**

   ```bash
   cd backend/tools
   python cookie_converter.py update douyin /path/to/douyin_cookies.txt
   ```

3. **验证**

   ```bash
   python cookie_converter.py validate douyin
   ```

### 情况 B: API 返回 HTML 而非 JSON

**症状**:

```
❌ 抖音 API 返回 HTML 页面而非 JSON
```

**可能原因**:

- Cookie 已失效
- 触发反爬虫验证
- IP 被限制

**解决方案**:

1. **确认浏览器能正常访问**
   - 打开 https://www.douyin.com
   - 确认能正常浏览视频

2. **重新登录并获取 Cookie**
   - 退出登录
   - 重新登录
   - 导出新的 Cookie

3. **更新配置**

   ```bash
   python cookie_converter.py update douyin /path/to/new_cookies.txt
   ```

4. **测试**
   ```bash
   python test_douyin_downloader.py api "视频URL"
   ```

### 情况 C: Cookie 文件格式不正确

**症状**:

```
❌ 转换失败，Cookie 可能格式不正确
```

**解决方案**:

1. **检查文件内容**

   ```bash
   head -20 douyin_cookies.txt
   ```

2. **确保是正确的格式**

   Netscape 格式应该类似：

   ```
   # Netscape HTTP Cookie File
   .douyin.com	TRUE	/	TRUE	1804499051	enter_pc_once	1
   .douyin.com	TRUE	/	TRUE	1788936466	ttwid	xxx
   ```

3. **或使用浏览器格式**（手动复制）

   打开浏览器开发者工具 (F12) → Application → Cookies → douyin.com

   复制所有 Cookie 为格式：

   ```
   name1=value1; name2=value2; name3=value3
   ```

   保存到文件后更新：

   ```bash
   python cookie_converter.py update douyin /path/to/cookies.txt
   ```

---

## 📊 诊断工具

### 完整诊断

运行所有测试以找出问题：

```bash
cd backend/tools
python test_douyin_downloader.py all "https://www.douyin.com/video/7345492945006595379"
```

输出会显示每个步骤的状态：

```
✅ Cookie 配置
✅ 视频 ID 提取
❌ API 请求  ← 问题在这里
❌ 视频下载
```

### 查看详细日志

```bash
# 实时查看日志
tail -f backend/logs/app.log

# 或查看最近的错误
grep -i error backend/logs/app.log | tail -20
```

---

## 🎯 常见错误及解决方案

| 错误信息                           | 原因           | 解决方案             |
| ---------------------------------- | -------------- | -------------------- |
| `JSONDecodeError: Expecting value` | API 返回空响应 | 检查 Cookie 是否有效 |
| `Cookie 缺少必需字段`              | Cookie 不完整  | 重新导出完整 Cookie  |
| `API 返回 HTML 页面`               | 触发反爬虫     | 重新登录获取 Cookie  |
| `无法提取视频 ID`                  | URL 格式不正确 | 使用完整的视频 URL   |
| `请求超时`                         | 网络问题       | 检查网络连接         |

---

## ✅ 验证清单

在提交 Issue 前，请确认：

- [ ] 已运行 `fix_douyin_cookie.py`
- [ ] Cookie 验证通过（包含 ttwid 和 sessionid）
- [ ] 浏览器能正常访问抖音
- [ ] 已尝试重新获取 Cookie
- [ ] 已查看日志文件
- [ ] 已运行完整诊断

---

## 🆘 仍然无法解决？

1. **收集信息**

   ```bash
   # 运行诊断
   python test_douyin_downloader.py all "视频URL" > diagnosis.txt 2>&1

   # 验证 Cookie
   python cookie_converter.py validate douyin >> diagnosis.txt 2>&1

   # 查看日志
   tail -100 backend/logs/app.log >> diagnosis.txt 2>&1
   ```

2. **提交 Issue**
   - 附上 `diagnosis.txt`（删除敏感信息）
   - 说明你的操作系统和 Python 版本
   - 描述具体的错误现象

3. **临时解决方案**

   如果急需使用，可以尝试：
   - 使用其他平台（B站、YouTube 等）
   - 使用本地文件上传功能
   - 等待 Cookie 刷新后重试

---

## 📚 更多帮助

- 详细文档: [README_DOUYIN_COOKIE.md](./README_DOUYIN_COOKIE.md)
- Cookie 转换: `python cookie_converter.py help`
- 测试工具: `python test_douyin_downloader.py help`

---

**祝你使用愉快！** 🎉
