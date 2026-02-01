# 更新日志

## [1.0.0] - 2026-02-01

### 🎯 问题修复

#### 核心问题

修复了抖音下载器的 `JSONDecodeError('Expecting value: line 1 column 1 (char 0)')` 错误

#### 根本原因

1. Cookie 格式错误（Netscape 格式未转换为浏览器格式）
2. Cookie 缺少必需字段（ttwid, sessionid 等）
3. API 返回非 JSON 响应（HTML 错误页面或空响应）

---

### ✨ 新增功能

#### 1. 增强的 Cookie 管理器

**文件**: `backend/app/services/cookie_manager.py`

**新增方法**:

- `convert_netscape_to_browser_cookie()` - 自动转换 Cookie 格式
- `get()` - 支持自动格式转换
- `set()` - 支持自动格式转换
- `validate_cookie()` - 验证 Cookie 有效性

**功能**:

- ✅ 自动检测并转换 Netscape 格式
- ✅ 验证必需字段
- ✅ 友好的错误提示

#### 2. 改进的抖音下载器

**文件**: `backend/app/downloaders/douyin_downloader.py`

**改进**:

- ✅ 详细的日志记录（使用 logging 模块）
- ✅ HTTP 状态码检查
- ✅ 响应内容类型验证
- ✅ JSON 解析错误处理
- ✅ 友好的错误提示信息
- ✅ 超时和网络错误处理
- ✅ 反爬虫检测（HTML 响应）

**新增验证**:

- 视频 ID 提取验证
- Cookie 配置验证
- 响应状态码验证
- 响应内容类型验证
- JSON 数据结构验证

#### 3. 工具集

##### 🔧 `fix_douyin_cookie.py` - 一键修复工具

**功能**:

- 自动检测 Cookie 格式问题
- 转换 Netscape 格式为浏览器格式
- 验证必需字段（ttwid, sessionid）
- 自动备份原配置
- 更新配置文件
- 提供详细的修复报告

**使用**:

```bash
python fix_douyin_cookie.py
```

##### 🍪 `cookie_converter.py` - Cookie 转换工具

**功能**:

- 转换 Cookie 文件格式
- 更新配置文件
- 验证 Cookie 有效性
- 支持多平台（douyin, bilibili, youtube 等）

**命令**:

```bash
python cookie_converter.py convert <input> [output]
python cookie_converter.py update <platform> <cookie_file>
python cookie_converter.py validate <platform>
```

##### 🧪 `test_douyin_downloader.py` - 功能测试工具

**功能**:

- 测试 Cookie 配置
- 测试视频 ID 提取
- 测试 API 请求
- 测试视频下载
- 运行完整测试套件

**命令**:

```bash
python test_douyin_downloader.py cookie
python test_douyin_downloader.py extract
python test_douyin_downloader.py api <video_url>
python test_douyin_downloader.py download <video_url>
python test_douyin_downloader.py all <video_url>
```

##### 🔍 `diagnose_douyin.py` - 综合诊断工具

**功能**:

- 一键运行所有诊断测试
- 生成详细诊断报告
- 提供针对性修复建议
- 统计测试通过率
- 计算诊断耗时

**测试项目**:

1. 配置文件存在性和格式
2. Cookie 配置状态
3. Cookie 格式检查
4. Cookie 必需字段验证
5. 视频 ID 提取功能
6. API 请求功能（可选）

**命令**:

```bash
python diagnose_douyin.py
python diagnose_douyin.py --test-url <video_url>
```

---

### 📚 新增文档

#### 1. `README_DOUYIN_COOKIE.md` - 完整配置指南

**内容**:

- 问题说明和原因分析
- Cookie 获取方法（浏览器插件、开发者工具）
- Cookie 格式转换详解
- 配置和测试步骤
- 常见问题解答（FAQ）
- 高级配置选项
- 调试技巧

**章节**:

- 📋 目录
- 🔍 问题说明
- 🍪 Cookie 获取方法
- 🔄 Cookie 格式转换
- ⚙️ 配置和测试
- ❓ 常见问题
- 🔧 高级配置
- 📚 相关文档
- 🆘 获取帮助

#### 2. `QUICKSTART.md` - 快速修复指南

**内容**:

- 3 步快速修复流程
- 常见错误及解决方案
- 诊断工具使用
- 验证清单
- 快速参考

**特点**:

- 简洁明了
- 步骤清晰
- 快速定位问题
- 提供具体命令

#### 3. `SUMMARY.md` - 问题修复总结

**内容**:

- 问题分析
- 已实现的修复
- 工具集介绍
- 文档列表
- 快速开始指南
- 问题诊断流程
- Cookie 格式对比
- 技术细节
- 最佳实践

#### 4. `README.md` - 工具集概览

**内容**:

- 工具列表和对比
- 快速开始指南
- 工具详解
- 典型工作流程
- 故障排除
- 最佳实践
- 更新日志

#### 5. `CHANGELOG.md` - 本文档

**内容**:

- 版本历史
- 新增功能
- 改进项目
- 修复问题
- 技术细节

---

### 🔧 改进项目

#### 错误处理

**改进前**:

```python
response = requests.get(full_url, headers=kwargs)
return response.json()  # 直接解析，可能抛出 JSONDecodeError
```

**改进后**:

```python
response = requests.get(full_url, headers=kwargs, timeout=30)

# 检查状态码
if response.status_code != 200:
    logger.error(f"API 返回错误状态码: {response.status_code}")
    raise ValueError(f"抖音 API 返回错误状态码: {response.status_code}")

# 检查响应内容
if not response.content:
    logger.error("API 返回空响应")
    raise ValueError("抖音 API 返回空响应，可能是 Cookie 失效或被反爬虫拦截")

# 尝试解析 JSON
try:
    json_data = response.json()
    logger.info("成功解析 JSON 响应")
    return json_data
except json.JSONDecodeError as e:
    logger.error(f"JSON 解析失败: {e}")
    # 检查是否是 HTML 响应
    if response.text.strip().startswith('<'):
        raise ValueError("抖音 API 返回 HTML 页面而非 JSON，可能原因：...")
    else:
        raise ValueError(f"抖音 API 返回无效的 JSON 数据: {response.text[:200]}")
```

#### 日志记录

**新增**:

- 使用标准 logging 模块
- 分级日志（DEBUG, INFO, WARNING, ERROR）
- 详细的请求和响应日志
- 错误堆栈跟踪

**示例**:

```python
logger.info(f"开始获取抖音视频信息，aweme_id: {aweme_id}")
logger.debug(f"请求 URL: {full_url[:200]}...")
logger.debug(f"请求头 Cookie 长度: {len(kwargs.get('Cookie', ''))}")
logger.info(f"API 响应状态码: {response.status_code}")
logger.error(f"JSON 解析失败: {e}", exc_info=True)
```

#### Cookie 管理

**改进前**:

- 直接读取配置文件
- 不支持格式转换
- 不验证必需字段

**改进后**:

- 自动检测并转换格式
- 验证必需字段
- 提供详细的验证信息
- 支持多平台

---

### 🐛 修复问题

#### 1. JSONDecodeError

**问题**: API 返回空响应或 HTML 页面导致 JSON 解析失败

**修复**:

- 添加响应内容检查
- 检测 HTML 响应
- 提供友好的错误提示
- 指导用户修复 Cookie

#### 2. Cookie 格式错误

**问题**: Netscape 格式的 Cookie 无法被正确使用

**修复**:

- 实现自动格式转换
- 提供转换工具
- 自动检测格式
- 验证转换结果

#### 3. Cookie 缺少必需字段

**问题**: Cookie 不完整导致 API 请求失败

**修复**:

- 实现字段验证
- 列出缺失字段
- 提供获取指导
- 验证工具

#### 4. 错误提示不友好

**问题**: 错误信息不清晰，难以定位问题

**修复**:

- 详细的错误信息
- 分类错误原因
- 提供修复建议
- 相关文档链接

---

### 📊 技术细节

#### Cookie 格式转换算法

```python
def convert_netscape_to_browser_cookie(netscape_cookie: str) -> str:
    """
    Netscape 格式:
    .douyin.com	TRUE	/	TRUE	1804499051	enter_pc_once	1

    浏览器格式:
    enter_pc_once=1; ttwid=xxx; sessionid=xxx
    """
    lines = netscape_cookie.strip().split('\n')
    cookies = []

    for line in lines:
        if line.startswith('#') or not line.strip():
            continue

        parts = line.split('\t')
        if len(parts) >= 7:
            name = parts[5].strip()
            value = parts[6].strip()
            if name and value:
                cookies.append(f"{name}={value}")

    return '; '.join(cookies)
```

#### 错误处理层级

```
Level 1: 参数验证
  ├─ 视频 ID 提取失败
  └─ Cookie 未配置

Level 2: 网络错误
  ├─ 连接超时
  └─ 网络异常

Level 3: HTTP 错误
  ├─ 状态码非 200
  └─ 响应为空

Level 4: 数据格式错误
  ├─ 非 JSON 响应
  ├─ HTML 响应（反爬虫）
  └─ JSON 解析失败

Level 5: 业务逻辑错误
  ├─ 缺少必需字段
  └─ API 返回错误码
```

#### 诊断流程

```
1. 检查配置文件
   ├─ 文件是否存在
   └─ JSON 格式是否正确

2. 检查 Cookie 配置
   ├─ Cookie 是否存在
   └─ Cookie 是否为空

3. 检查 Cookie 格式
   ├─ 是否是 Netscape 格式
   └─ 是否需要转换

4. 检查必需字段
   ├─ ttwid
   ├─ sessionid
   └─ __ac_signature (推荐)

5. 测试功能
   ├─ 视频 ID 提取
   └─ API 请求

6. 生成报告
   ├─ 测试结果
   ├─ 错误信息
   └─ 修复建议
```

---

### 🎓 最佳实践

#### Cookie 管理

1. **定期更新** - Cookie 通常 7-30 天失效
2. **完整导出** - 确保导出所有字段
3. **格式验证** - 使用工具验证
4. **备份配置** - 自动备份原配置

#### 错误处理

1. **查看日志** - 首先查看详细日志
2. **运行诊断** - 使用诊断工具
3. **逐步修复** - 按照报告修复
4. **验证修复** - 重新运行测试

#### 开发调试

1. **启用详细日志** - DEBUG 级别
2. **保存响应** - 自动保存 JSON
3. **对比响应** - 与成功响应对比
4. **检查网络** - 使用 curl 测试

---

### 📈 性能优化

#### 请求优化

- 添加超时设置（30 秒）
- 使用 httpx 的重试机制（msToken 请求）
- 缓存 msToken（可选，未实现）

#### 日志优化

- 使用标准 logging 模块
- 分级日志记录
- 避免敏感信息泄露
- 日志轮转（由应用配置）

---

### 🔒 安全改进

#### Cookie 安全

- 不在日志中输出完整 Cookie
- 配置文件权限检查（建议）
- 敏感信息脱敏

#### 错误信息

- 不暴露内部实现细节
- 不输出完整的敏感数据
- 提供安全的错误提示

---

### 🚀 未来计划

#### 功能增强

- [ ] Cookie 自动刷新
- [ ] 多账号支持
- [ ] 代理配置
- [ ] 批量测试
- [ ] Web UI 界面

#### 工具改进

- [ ] 交互式配置向导
- [ ] 自动化测试脚本
- [ ] 性能监控
- [ ] 错误统计

#### 文档完善

- [ ] 视频教程
- [ ] 常见问题库
- [ ] API 文档
- [ ] 贡献指南

---

### 📝 迁移指南

#### 从旧版本迁移

如果你之前使用的是没有这些工具的版本：

1. **备份配置**:

   ```bash
   cp backend/config/downloader.json backend/config/downloader.json.backup
   ```

2. **运行修复工具**:

   ```bash
   cd backend/tools
   python fix_douyin_cookie.py
   ```

3. **验证配置**:

   ```bash
   python diagnose_douyin.py --test-url "视频URL"
   ```

4. **更新代码**:
   - 代码已自动更新，无需手动修改

---

### 🙏 致谢

感谢以下项目和资源：

- [TikTokDownloader](https://github.com/JoeanAmier/TikTokDownloader) - ABogus 实现
- [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) - API 参考
- 所有贡献者和用户的反馈

---

### 📞 支持

如果遇到问题：

1. 查看文档：`README_DOUYIN_COOKIE.md`
2. 运行诊断：`python diagnose_douyin.py --test-url "视频URL"`
3. 查看日志：`tail -f backend/logs/app.log`
4. 提交 Issue（附上诊断结果）

---

**发布日期**: 2026-02-01  
**版本**: 1.0.0  
**维护者**: BiliNote Team
