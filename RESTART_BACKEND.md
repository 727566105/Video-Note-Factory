# 🔄 重启后端服务

Cookie 已经修复，但后端服务需要重启才能加载新的配置。

---

## 🚀 快速重启

### 方法 1: 使用脚本（推荐）

如果你使用 `start-bilinote.command` 启动的应用：

```bash
# 1. 停止服务
./stop-bilinote.command

# 2. 等待 2-3 秒

# 3. 重新启动
./start-bilinote.command
```

### 方法 2: 手动重启

#### 停止后端服务

```bash
# 查找后端进程
ps aux | grep "python.*main.py" | grep -v grep

# 停止进程（替换 <PID> 为实际的进程 ID）
kill <PID>

# 或者强制停止
kill -9 <PID>
```

当前后端进程 ID: **56409**

快速停止命令：

```bash
kill 56409
```

#### 启动后端服务

```bash
cd backend
python main.py
```

或者使用虚拟环境：

```bash
cd backend
source ../.venv/bin/activate  # 如果使用虚拟环境
python main.py
```

---

## ✅ 验证服务已重启

### 1. 检查日志

```bash
tail -f backend/logs/app.log
```

你应该看到类似的输出：

```
[INFO] __main__ - Starting server on 0.0.0.0:8483
[INFO] events - 注册监听器成功
```

### 2. 测试 Cookie 加载

重启后，日志中不应该再出现 "抖音 cookie 未配置" 的警告。

### 3. 测试抖音下载

在前端界面尝试下载一个抖音视频，应该可以正常工作了。

---

## 🔍 故障排除

### 问题：服务无法启动

**检查端口占用**：

```bash
lsof -i :8483
```

如果端口被占用，停止占用端口的进程：

```bash
kill <PID>
```

### 问题：仍然报 Cookie 错误

**确认配置文件已更新**：

```bash
# 检查 Cookie 长度
python3 -c "import json; data=json.load(open('config/downloader.json')); print('Cookie length:', len(data.get('douyin',{}).get('cookie','')))"
```

应该显示：

```
Cookie length: 6407
```

如果显示 0 或其他值，运行同步脚本：

```bash
python backend/tools/sync_config.py
```

### 问题：前端无法连接后端

**检查后端是否在运行**：

```bash
curl http://localhost:8483/api/system/health
```

应该返回健康状态。

---

## 📝 重启后的验证清单

- [ ] 后端服务已启动
- [ ] 日志中没有 "cookie 未配置" 警告
- [ ] 前端可以连接到后端
- [ ] 可以访问设置页面
- [ ] 尝试下载抖音视频

---

## 🎯 预期结果

重启后，当你尝试下载抖音视频时：

**之前**：

```
❌ 请求出错 {code: 500, msg: "JSONDecodeError('Expecting value: line 1 column 1 (char 0)')"}
```

**现在**：

```
✅ 任务创建成功
✅ 正在下载视频...
✅ 正在转录音频...
✅ 正在生成笔记...
```

---

## 💡 提示

### 开发模式

如果你在开发模式下运行（使用 `npm run dev` 或类似命令），可能需要：

1. 停止前端开发服务器
2. 停止后端服务
3. 重新启动后端
4. 重新启动前端

### Docker 模式

如果使用 Docker：

```bash
# 重启容器
docker-compose restart backend

# 或者重新构建并启动
docker-compose down
docker-compose up -d
```

---

## 🆘 仍然有问题？

如果重启后仍然遇到问题：

1. **查看完整日志**：

   ```bash
   tail -100 backend/logs/app.log
   ```

2. **运行诊断**：

   ```bash
   cd backend/tools
   python diagnose_douyin.py --test-url "https://www.douyin.com/video/7579932048509488435"
   ```

3. **检查配置同步**：

   ```bash
   python backend/tools/sync_config.py
   ```

4. **查看文档**：
   - `DOUYIN_FIX_COMPLETE.md` - 修复完成报告
   - `backend/tools/QUICKSTART.md` - 快速修复指南

---

**重启后应该就可以正常使用了！** 🎉
