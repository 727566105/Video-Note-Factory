// background/service_worker.js - 后台服务

// 监听扩展安装
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('videoNoteUrl', (result) => {
    if (!result.videoNoteUrl) {
      chrome.storage.local.set({
        videoNoteUrl: 'http://localhost:8483',
        defaultModel: '',
        defaultProviderId: '',
        defaultStyle: '精简',
        defaultFormat: ['目录', '原片跳转', 'AI总结'],
        defaultQuality: 'fast',
        cookieStatus: {
          bilibili: 'unsaved',
          douyin: 'unsaved',
          kuaishou: 'unsaved',
          youtube: 'unsaved',
          xiaohongshu: 'unsaved',
          cctv: 'unsaved'
        }
      });
    }
  });
});

// 代理 API 请求（绕过 CORS）+ 注入 Authorization + 12s 超时 + 错误透传 detail
// 12s 早于 popup 的 20s 总超时，保证 service worker 能先正常返回错误
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type !== 'apiCall') return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  const finalOptions = { ...request.options, signal: controller.signal };

  // 注入 Bearer Token（如果调用方提供了）
  if (request.token) {
    finalOptions.headers = {
      ...(finalOptions.headers || {}),
      'Authorization': `Bearer ${request.token}`
    };
  }

  fetch(request.url, finalOptions)
    .then(async (response) => {
      if (!response.ok) {
        // 后端 401/403 用 FastAPI 原生格式 {detail: "..."}（字符串）
        // 422 校验错误 {detail: [{type, loc, msg, input, ctx}]}（数组）
        // 都转成可读字符串透传给前端
        let detail = '';
        try {
          const errBody = await response.json();
          const rawDetail = errBody?.detail ?? errBody?.msg ?? '';
          if (Array.isArray(rawDetail)) {
            // Pydantic 校验错误：提取 loc + msg
            detail = rawDetail.map(e => {
              const loc = Array.isArray(e.loc) ? e.loc.join('.') : (e.loc || '');
              const msg = e.msg || '';
              const input = e.input !== undefined ? ` (输入: ${typeof e.input === 'object' ? JSON.stringify(e.input) : e.input})` : '';
              return loc ? `${loc}: ${msg}${input}` : msg;
            }).join('; ');
          } else if (typeof rawDetail === 'string') {
            detail = rawDetail;
          } else if (rawDetail && typeof rawDetail === 'object') {
            detail = JSON.stringify(rawDetail);
          }
        } catch (e) { /* 非 JSON 错误体 */ }
        throw new Error(`HTTP ${response.status}${detail ? ': ' + detail : ''}`);
      }
      return response.json();
    })
    .then(data => sendResponse({ success: true, data }))
    .catch(error => {
      const msg = error.name === 'AbortError'
        ? '请求超时（12s）'
        : error.message;
      sendResponse({ success: false, error: msg });
    })
    .finally(() => clearTimeout(timer));

  return true; // 保持消息通道开启以支持异步响应
});
