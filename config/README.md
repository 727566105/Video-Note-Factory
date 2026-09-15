# Cookie 配置文件示例

此目录用于存储视频平台的 Cookie 配置，Docker 部署时会持久化此目录。

## 文件说明

- `downloader.json`: 存储各视频平台的 Cookie 配置

## 使用方法

1. **浏览器插件获取 Cookie**
   - 安装 VideoNote Helper 浏览器插件
   - 在视频平台页面点击插件，一键获取 Cookie

2. **手动配置 Cookie**
   - 编辑 `downloader.json` 文件
   - 在对应平台的 `cookie` 字段填入 Cookie 值

3. **前端设置页面配置**
   - 访问 http://localhost:3016/settings/download
   - 在对应平台输入 Cookie 并保存

## 配置示例

```json
{
  "bilibili": {
    "cookie": "buvid3=xxx; SESSDATA=xxx; bili_jct=xxx; ..."
  },
  "youtube": {
    "cookie": "VISITOR_INFO1_LIVE=xxx; LOGIN_INFO=xxx; ..."
  },
  "douyin": {
    "cookie": "sessionid=xxx; sid_tt=xxx; ..."
  }
}
```

## 注意事项

- Cookie 配置在 Docker 升级时会保留（已持久化）
- 不要将真实 Cookie 提交到 Git（已在 .gitignore 中）
- Cookie 有效期通常为 1-3 个月，过期需重新获取