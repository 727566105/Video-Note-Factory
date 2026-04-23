// popup.js - 弹窗主逻辑

// 通过 background service worker 代理 API 请求（绕过 CORS）
async function apiCall(url, options = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'apiCall', url, options },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '请求失败'));
        }
      }
    );
  });
}

// 确保对指定 URL 有访问权限
async function ensurePermission(url) {
  try {
    const origin = new URL(url).origin;
    const hasPermission = await chrome.permissions.contains({ origins: [origin + '/*'] });
    if (!hasPermission) {
      await chrome.permissions.request({ origins: [origin + '/*'] });
    }
    return true;
  } catch (e) {
    return false;
  }
}

// 平台域名映射
const PLATFORM_DOMAINS = {
  bilibili: ['bilibili.com', 'b23.tv'],
  douyin: ['douyin.com'],
  kuaishou: ['kuaishou.com', 'kuaishou.cn'],
  youtube: ['youtube.com', 'youtu.be']
};

// 平台名称映射
const PLATFORM_NAMES = {
  bilibili: '哔哩哔哩',
  douyin: '抖音',
  kuaishou: '快手',
  youtube: 'YouTube'
};

// 当前选中的平台
let selectedPlatform = null;
let currentPlatform = null;
let currentCookies = null;
let videoNoteUrl = 'http://localhost:8483';

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 加载配置
  await loadConfig();

  // Tab 切换
  initTabs();

  // 检测当前页面平台
  await detectCurrentPlatform();

  // 初始化 Cookie Tab
  initCookieTab();

  // 初始化提交 Tab
  initSubmitTab();
});

// 加载配置
async function loadConfig() {
  const config = await chrome.storage.local.get([
    'videoNoteUrl',
    'defaultModel',
    'defaultProviderId',
    'defaultStyle',
    'defaultFormat',
    'cookieStatus'
  ]);

  videoNoteUrl = config.videoNoteUrl || 'http://localhost:8483';

  // 显示预设信息
  document.getElementById('preset-model').textContent = config.defaultModel || '未设置';
  document.getElementById('preset-style').textContent = config.defaultStyle || '未设置';
  document.getElementById('preset-format').textContent =
    config.defaultFormat?.join('、') || '未设置';

  // 更新平台保存状态
  if (config.cookieStatus) {
    Object.entries(config.cookieStatus).forEach(([platform, saved]) => {
      const statusEl = document.getElementById(`${platform}-status`);
      if (statusEl && saved) {
        statusEl.textContent = '✓ 已保存';
      }
    });
  }
}

// Tab 切换
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`${tabId}-tab`).classList.add('active');
    });
  });
}

// 检测当前页面平台
async function detectCurrentPlatform() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    document.getElementById('current-page-name').textContent = '未知';
    return;
  }

  const url = tab.url;
  let detectedPlatform = null;

  for (const [platform, domains] of Object.entries(PLATFORM_DOMAINS)) {
    for (const domain of domains) {
      if (url.includes(domain)) {
        detectedPlatform = platform;
        break;
      }
    }
    if (detectedPlatform) break;
  }

  currentPlatform = detectedPlatform;

  if (detectedPlatform) {
    document.getElementById('current-page-name').textContent =
      PLATFORM_NAMES[detectedPlatform];

    // 标记当前页面平台
    document.getElementById(`${detectedPlatform}-current`).classList.add('visible');

    // 选中当前平台
    const platformItem = document.querySelector(`.platform-item[data-platform="${detectedPlatform}"]`);
    if (platformItem) {
      platformItem.classList.add('selected');
      selectedPlatform = detectedPlatform;
    }
  } else {
    document.getElementById('current-page-name').textContent = '非视频平台';
  }
}

// Cookie Tab 初始化
function initCookieTab() {
  // 平台点击选择
  const platformItems = document.querySelectorAll('.platform-item');
  platformItems.forEach(item => {
    item.addEventListener('click', () => {
      platformItems.forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      selectedPlatform = item.dataset.platform;
    });
  });

  // 获取 Cookie 按钮
  document.getElementById('get-cookie-btn').addEventListener('click', async () => {
    if (!selectedPlatform) {
      showMessage('cookie-message', '请先选择平台', 'error');
      return;
    }

    currentCookies = await getCookiesForPlatform(selectedPlatform);

    if (currentCookies) {
      document.getElementById('cookie-text').value = currentCookies;
      document.getElementById('cookie-result').style.display = 'block';
      showMessage('cookie-message', 'Cookie 已获取', 'success');
    } else {
      showMessage('cookie-message', '获取 Cookie 失败', 'error');
    }
  });

  // 复制按钮
  document.getElementById('copy-browser-btn').addEventListener('click', async () => {
    await copyToClipboard(currentCookies);
    showMessage('cookie-message', '已复制到剪贴板', 'success');
  });

  // 推送按钮
  document.getElementById('push-btn').addEventListener('click', async () => {
    await pushCookieToVideoNote(selectedPlatform, currentCookies);
  });

  // 复制 Netscape 格式
  document.getElementById('copy-netscape-btn').addEventListener('click', async () => {
    const netscape = convertToNetscape(selectedPlatform, currentCookies);
    await copyToClipboard(netscape);
    showMessage('cookie-message', '已复制 Netscape 格式', 'success');
  });
}

// 提交 Tab 初始化
function initSubmitTab() {
  // 修改设置链接
  document.getElementById('open-options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 提交按钮
  document.getElementById('submit-btn').addEventListener('click', async () => {
    const videoUrl = document.getElementById('video-url').value;

    if (!videoUrl) {
      showMessage('submit-message', '未检测到视频页面', 'error');
      return;
    }

    await submitNoteTask(videoUrl);
  });

  // 查看笔记按钮
  document.getElementById('view-note-btn').addEventListener('click', async () => {
    const taskId = document.getElementById('view-note-btn').dataset.taskId;
    chrome.tabs.create({ url: `${videoNoteUrl}/?task_id=${taskId}` });
  });

  // 切换到提交 Tab 时自动检测视频 URL
  document.querySelector('.tab-btn[data-tab="submit"]').addEventListener('click', async () => {
    await detectVideoUrl();
  });
}

// 检测视频 URL
async function detectVideoUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab || !tab.url) {
    document.getElementById('video-url').value = '';
    document.getElementById('video-title').value = '';
    return;
  }

  const url = tab.url;

  // 检查是否为视频页面
  if (!currentPlatform) {
    document.getElementById('video-url').value = '';
    document.getElementById('video-title').value = '';
    return;
  }

  // 设置视频 URL
  document.getElementById('video-url').value = url;

  // 尝试获取视频标题
  try {
    const title = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 不同平台的标题获取方式
        const selectors = [
          'h1.video-title',
          '.video-title',
          'h1.title',
          '#video-title',
          'meta[property="og:title"]',
          'title'
        ];

        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            return el.getAttribute('content') || el.textContent?.trim() || '';
          }
        }
        return document.title || '';
      }
    });

    if (title && title[0]?.result) {
      document.getElementById('video-title').value = title[0].result;
    }
  } catch (e) {
    console.error('获取标题失败:', e);
  }
}

// 获取平台所有 Cookie
async function getCookiesForPlatform(platform) {
  const domains = PLATFORM_DOMAINS[platform];
  const cookies = [];

  for (const domain of domains) {
    const domainCookies = await chrome.cookies.getAll({ domain: domain });
    domainCookies.forEach(cookie => {
      cookies.push(`${cookie.name}=${cookie.value}`);
    });

    // 也获取 .domain 格式的 cookie
    const subdomainCookies = await chrome.cookies.getAll({ domain: `.${domain}` });
    subdomainCookies.forEach(cookie => {
      cookies.push(`${cookie.name}=${cookie.value}`);
    });
  }

  return cookies.join('; ');
}

// 转换为 Netscape 格式
function convertToNetscape(platform, cookieStr) {
  const domains = PLATFORM_DOMAINS[platform];
  const primaryDomain = domains[0];

  const lines = ['# Netscape HTTP Cookie File\n'];

  cookieStr.split(';').forEach(item => {
    item = item.trim();
    if (item.includes('=')) {
      const [name, value] = item.split('=');
      lines.push(`.${primaryDomain}\tTRUE\t/\tTRUE\t0\t${name.trim()}\t${value.trim()}\n`);
    }
  });

  return lines.join('');
}

// 推送 Cookie 到 VideoNote
async function pushCookieToVideoNote(platform, cookie) {
  try {
    if (!await ensurePermission(videoNoteUrl)) {
      showMessage('cookie-message', '请先授权访问该服务', 'error');
      return;
    }

    const data = await apiCall(`${videoNoteUrl}/api/update_downloader_cookie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, cookie })
    });

    if (data.code === 0) {
      showMessage('cookie-message', '推送成功', 'success');

      // 更新保存状态
      const statusEl = document.getElementById(`${platform}-status`);
      statusEl.textContent = '✓ 已保存';

      // 保存到本地
      const config = await chrome.storage.local.get('cookieStatus');
      const cookieStatus = config.cookieStatus || {};
      cookieStatus[platform] = true;
      chrome.storage.local.set({ cookieStatus });
    } else {
      showMessage('cookie-message', `推送失败: ${data.msg || '未知错误'}`, 'error');
    }
  } catch (e) {
    showMessage('cookie-message', `推送失败: ${e.message}`, 'error');
  }
}

// 提交笔记任务
async function submitNoteTask(videoUrl) {
  // 获取预设配置
  const config = await chrome.storage.local.get([
    'defaultModel',
    'defaultProviderId',
    'defaultStyle',
    'defaultFormat',
    'defaultQuality'
  ]);

  const platform = currentPlatform || 'unknown';

  const requestData = {
    video_url: videoUrl,
    platform: platform,
    quality: config.defaultQuality || 'fast',
    model_name: config.defaultModel || '',
    provider_id: config.defaultProviderId || '',
    format: config.defaultFormat || [],
    style: config.defaultStyle || ''
  };

  try {
    if (!await ensurePermission(videoNoteUrl)) {
      showMessage('submit-message', '请先授权访问该服务', 'error');
      return;
    }

    const data = await apiCall(`${videoNoteUrl}/api/generate_note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    const resultDiv = document.getElementById('submit-result');
    const resultText = document.getElementById('result-text');
    const viewBtn = document.getElementById('view-note-btn');

    resultDiv.style.display = 'block';
    resultDiv.classList.remove('error');

    if (data.code === 0) {
      resultText.textContent = '提交成功！任务已创建';
      viewBtn.style.display = 'inline-block';
      viewBtn.dataset.taskId = data.data?.task_id;

      showMessage('submit-message', '', 'success');
    } else {
      resultDiv.classList.add('error');
      resultText.textContent = `提交失败: ${data.msg || '未知错误'}`;
      viewBtn.style.display = 'none';
    }
  } catch (e) {
    const resultDiv = document.getElementById('submit-result');
    resultDiv.style.display = 'block';
    resultDiv.classList.add('error');
    document.getElementById('result-text').textContent = `提交失败: ${e.message}`;
    document.getElementById('view-note-btn').style.display = 'none';
  }
}

// 复制到剪贴板
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// 显示消息
function showMessage(elementId, text, type) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = `message ${type}`;

  // 自动消失
  if (text) {
    setTimeout(() => {
      el.textContent = '';
      el.className = 'message';
    }, 3000);
  }
}