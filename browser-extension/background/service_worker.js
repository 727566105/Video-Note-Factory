// background/service_worker.js - 后台服务

// 监听扩展安装
chrome.runtime.onInstalled.addListener(() => {
  // 初始化默认配置
  chrome.storage.local.get('videoNoteUrl', (result) => {
    if (!result.videoNoteUrl) {
      chrome.storage.local.set({
        videoNoteUrl: 'http://localhost:8483',
        defaultModel: '',
        defaultProviderId: '',
        defaultStyle: '精简',
        defaultFormat: ['目录', '原片跳转', 'AI总结'],
        defaultQuality: 'fast',
        cookieStatus: {}
      });
    }
  });
});

// 监听消息，代理 API 请求（绕过 CORS）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'apiCall') {
    fetch(request.url, request.options)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => sendResponse({ success: true, data }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开启以支持异步响应
  }
});
