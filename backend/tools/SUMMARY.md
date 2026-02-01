# 抖音下载器问题修复总结

## 🎯 问题分析

### 核心问题：JSONDecodeError

**错误信息**：`JSONDecodeError('Expecting value: line 1 column 1 (char 0)')`

**根本原因**：

1. **Cookie 格式错误** - Netscape 格式未转换为浏览器格式
2. **Cookie 缺少必需字段** - 缺少 `ttwid`、`sessionid` 等关键字段
3. **API 返回非 JSON 响应** - 可能是 HTML 错误页面或空响应

---

## 🔧 已实现的修复

### 1. 增强的 Cookie 管理器 (`cookie_manager.py`)

**新增功能**：

```python
# 自动格式转换
def convert_netscape_to_browser_cookie(netscape_cookie: str) -> str:
    """将 Netscape 格式转换为浏览器格式"""

# 自动转换的 get 方法
def get(self, platform: str, auto_convert: bool = True) -> Optional[str]:
    """获取 Cookie 时自动检测并转换格式"""

# Cookie 验证
def validate_cookie(self, platform: str, required_fields: list = None) -> tuple[bool, str]:
    """验证 Cookie 是否包含必需字段"""
```

**使用示例**：

```python
from app.services.cookie_manager import CookieConfigManager

cfm = CookieConfigManager()

# 自动转换并保存
cfm.set('douyin', netscape_cookie, auto_convert=True)

# 验证 Cookie
is_valid, msg = cfm.validate_cookie('douyin', ['ttwid', 'sessionid'])
```

### 2. 改进的抖音下载器 (`douyin_downloader.py`)

**新增功能**：

- ✅ 详细的错误日志记录
- ✅ HTTP 状态码检查
- ✅ 响应内容类型验证
- ✅ JSON 解析错误处理
- ✅ 友好的错误提示信息
- ✅ 超时和网络错误处理

**关键改进**：

```python
def fetch_video_info(self, video_url: str) -> json:
    """
    获取视频信息，包含完整的错误处理

    - 验证视频 ID 提取
    - 检查 Cookie 配置
    - 验证 HTTP 响应状态
    - 检测 HTML 响应（反爬虫）
    - 详细的日志记录
    """
```

### 3. 工具集

#### 🔧 `fix_douyin_cookie.py` - 一键修复工具

**功能**：

- 自动检测 Cookie 格式
- 转换 Netscape 格式为浏览器格式
- 验证必需字段
- 自动备份原配置
- 更新配置文件

**使用**：

```bash
cd backend/tools
python fix_douyin_cookie.py
```

#### 🍪 `cookie_converter.py` - Cookie 转换工具

**功能**：

- 转换 Cookie 文件格式
- 更新配置文件
- 验证 Cookie 有效性

**使用**：

```bash
# 转换 Cookie 文件
python cookie_converter.py convert douyin_cookies.txt output.txt

# 直接更新到配置
python cookie_converter.py update douyin douyin_cookies.txt

# 验证 Cookie
python cookie_converter.py validate douyin
```

#### 🧪 `test_douyin_downloader.py` - 测试工具

**功能**：

- 测试 Cookie 配置
- 测试视频 ID 提取
- 测试 API 请求
- 测试完整下载流程

**使用**：

```bash
# 测试 Cookie
python test_douyin_downloader.py cookie

# 测试 API
python test_douyin_downloader.py api "https://www.douyin.com/video/7345492945006595379"

# 测试下载
python test_douyin_downloader.py download "视频URL"

# 运行所有测试
python test_douyin_downloader.py all "视频URL"
```

#### 🔍 `diagnose_douyin.py` - 综合诊断工具

**功能**：

- 一键运行所有诊断测试
- 生成详细诊断报告
- 提供修复建议

**使用**：

```bash
# 基础诊断
python diagnose_douyin.py

# 完整诊断（包括 API 测试）
python diagnose_douyin.py --test-url "视频URL"
```

---

## 📚 文档

### 📖 `README_DOUYIN_COOKIE.md` - 完整配置指南

包含：

- Cookie 获取方法（浏览器插件、开发者工具）
- 格式转换说明
- 配置步骤
- 常见问题解答
- 调试技巧

### ⚡ `QUICKSTART.md` - 快速修复指南

包含：

- 3 步快速修复流程
- 常见错误及解决方案
- 诊断工具使用
- 验证清单

---

## 🚀 快速开始

### 场景 1：首次配置

```bash
cd backend/tools

# 1. 从浏览器导出 Cookie（使用 EditThisCookie 等插件）
# 2. 更新配置
python cookie_converter.py update douyin /path/to/douyin_cookies.txt

# 3. 验证
python cookie_converter.py validate douyin

# 4. 测试
python test_douyin_downloader.py api "https://www.douyin.com/video/7345492945006595379"
```

### 场景 2：遇到 JSONDecodeError

```bash
cd backend/tools

# 1. 运行自动修复
python fix_douyin_cookie.py

# 2. 如果修复失败，运行诊断
python diagnose_douyin.py --test-url "视频URL"

# 3. 根据诊断结果修复问题
# 如果是格式问题：已自动修复
# 如果缺少字段：重新获取 Cookie
# 如果 API 失败：检查 Cookie 是否失效
```

### 场景 3：Cookie 已失效

```bash
# 1. 重新登录抖音网页版
# 访问 https://www.douyin.com

# 2. 导出新的 Cookie
# 使用浏览器插件导出

# 3. 更新配置
cd backend/tools
python cookie_converter.py update douyin /path/to/new_cookies.txt

# 4. 验证
python test_douyin_downloader.py api "视频URL"
```

---

## 🔍 问题诊断流程

```
1. 运行诊断工具
   ↓
   python diagnose_douyin.py --test-url "视频URL"
   ↓
2. 查看诊断报告
   ↓
   ├─ 配置文件 ✅/❌
   ├─ Cookie 存在 ✅/❌
   ├─ Cookie 格式 ✅/❌
   ├─ 必需字段 ✅/❌
   ├─ ID 提取 ✅/❌
   └─ API 请求 ✅/❌
   ↓
3. 根据失败项修复
   ↓
   ├─ Cookie 格式错误 → python fix_douyin_cookie.py
   ├─ 缺少必需字段 → 重新获取 Cookie
   ├─ API 请求失败 → 检查 Cookie 是否失效
   └─ 其他问题 → 查看详细日志
   ↓
4. 重新验证
   ↓
   python diagnose_douyin.py --test-url "视频URL"
```

---

## 📊 Cookie 格式对比

### Netscape 格式（错误）

```
# Netscape HTTP Cookie File
# https://curl.haxx.se/rfc/cookie_spec.html
.douyin.com	TRUE	/	TRUE	1804499051	enter_pc_once	1
.douyin.com	TRUE	/	TRUE	1788936466	ttwid	xxx
.douyin.com	TRUE	/	TRUE	1774584236	sessionid	xxx
```

**特征**：

- 多行
- Tab 分隔
- 包含注释行（以 # 开头）

### 浏览器格式（正确）

```
enter_pc_once=1; ttwid=xxx; sessionid=xxx; __ac_signature=xxx; ...
```

**特征**：

- 单行
- 分号和空格分隔
- 键值对格式（name=value）

---

## 🛠️ 技术细节

### Cookie 转换逻辑

```python
def convert_netscape_to_browser_cookie(netscape_cookie: str) -> str:
    lines = netscape_cookie.strip().split('\n')
    cookies = []

    for line in lines:
        # 跳过注释和空行
        if line.startswith('#') or not line.strip():
            continue

        # Netscape 格式: domain flag path secure expiration name value
        parts = line.split('\t')
        if len(parts) >= 7:
            name = parts[5].strip()
            value = parts[6].strip()
            if name and value:
                cookies.append(f"{name}={value}")

    return '; '.join(cookies)
```

### API 请求流程

```
1. 提取视频 ID
   ↓
2. 生成 msToken
   ↓
3. 构建请求参数
   ↓
4. 生成 a_bogus 签名
   ↓
5. 发送 HTTP 请求
   ↓
6. 验证响应状态码
   ↓
7. 检查响应内容类型
   ↓
8. 解析 JSON 数据
   ↓
9. 验证数据结构
   ↓
10. 返回视频信息
```

### 错误处理层级

```
Level 1: 参数验证
  - 视频 ID 提取失败
  - Cookie 未配置

Level 2: 网络错误
  - 连接超时
  - 网络异常

Level 3: HTTP 错误
  - 状态码非 200
  - 响应为空

Level 4: 数据格式错误
  - 非 JSON 响应
  - HTML 响应（反爬虫）
  - JSON 解析失败

Level 5: 业务逻辑错误
  - 缺少必需字段
  - API 返回错误码
```

---

## 📝 日志记录

### 日志级别

- **DEBUG**: 详细的请求参数、响应内容
- **INFO**: 关键操作步骤、成功信息
- **WARNING**: 非致命问题、数据不完整
- **ERROR**: 请求失败、解析错误

### 查看日志

```bash
# 实时查看
tail -f backend/logs/app.log

# 查看错误
grep -i error backend/logs/app.log | tail -20

# 查看抖音相关日志
grep -i douyin backend/logs/app.log | tail -50
```

---

## ✅ 验证清单

在提交 Issue 前，请确认：

- [ ] 已运行 `python diagnose_douyin.py --test-url "视频URL"`
- [ ] 已运行 `python fix_douyin_cookie.py`
- [ ] Cookie 验证通过（包含 ttwid 和 sessionid）
- [ ] 浏览器能正常访问抖音网页版
- [ ] 已尝试重新获取 Cookie
- [ ] 已查看日志文件 `backend/logs/app.log`
- [ ] 已阅读 `README_DOUYIN_COOKIE.md`

---

## 🎓 最佳实践

### Cookie 管理

1. **定期更新** - Cookie 通常 7-30 天失效，建议每周更新
2. **完整导出** - 确保导出所有 Cookie 字段
3. **格式验证** - 使用工具验证格式正确性
4. **备份配置** - 修改前自动备份原配置

### 错误处理

1. **查看日志** - 首先查看详细日志了解问题
2. **运行诊断** - 使用诊断工具快速定位问题
3. **逐步修复** - 按照诊断报告逐项修复
4. **验证修复** - 修复后重新运行测试

### 开发调试

1. **启用详细日志** - 设置日志级别为 DEBUG
2. **保存响应** - 测试工具会自动保存 API 响应
3. **对比正常响应** - 与成功的响应对比差异
4. **检查网络** - 使用 curl 或 Postman 手动测试

---

## 🔗 相关资源

- **项目文档**: `README_DOUYIN_COOKIE.md`
- **快速指南**: `QUICKSTART.md`
- **工具帮助**:
  - `python cookie_converter.py help`
  - `python test_douyin_downloader.py help`
  - `python diagnose_douyin.py --help`

---

## 📞 获取帮助

如果问题仍未解决：

1. **收集诊断信息**：

   ```bash
   python diagnose_douyin.py --test-url "视频URL" > diagnosis.txt 2>&1
   tail -100 backend/logs/app.log >> diagnosis.txt
   ```

2. **提交 Issue**，附上：
   - `diagnosis.txt`（删除敏感信息）
   - 操作系统和 Python 版本
   - 详细的错误描述

3. **临时解决方案**：
   - 使用其他平台（B站、YouTube）
   - 使用本地文件上传功能

---

**最后更新**: 2026-02-01  
**版本**: 1.0.0  
**维护者**: BiliNote Team
