// popup.js - 弹窗主逻辑（设计稿视觉 + 真实 chrome.* 逻辑）

// ─── 平台元数据 ───────────────────────────────────────────────────
const PLATFORMS = [
  { id: 'bilibili',    name: '哔哩哔哩', initial: 'B',  cls: 'bilibili',    domains: ['bilibili.com', 'b23.tv'] },
  { id: 'douyin',      name: '抖音',     initial: '抖', cls: 'douyin',      domains: ['douyin.com'] },
  { id: 'kuaishou',    name: '快手',     initial: '快', cls: 'kuaishou',    domains: ['kuaishou.com', 'kuaishou.cn'] },
  { id: 'youtube',     name: 'YouTube',  initial: 'Y',  cls: 'youtube',     domains: ['youtube.com', 'youtu.be'] },
  { id: 'xiaohongshu', name: '小红书',   initial: '红', cls: 'xiaohongshu', domains: ['xiaohongshu.com', 'xhslink.com'] },
  { id: 'cctv',        name: 'CCTV',     initial: 'C',  cls: 'cctv',        domains: ['cctv.com', 'cntv.cn'] }
];
const PLATFORM_DOMAINS = Object.fromEntries(PLATFORMS.map(p => [p.id, p.domains]));
const PLATFORM_NAMES = Object.fromEntries(PLATFORMS.map(p => [p.id, p.name]));

// ─── 状态 ─────────────────────────────────────────────────────────
let selectedPlatform = null;       // 用户当前在 Cookie Tab 选中的平台
let currentPlatform = null;        // 当前页自动检测到的平台
let currentCookies = null;         // 当前获取的 Cookie 字符串
let videoNoteUrl = 'http://localhost:8483';
let savedCookieStatus = { bilibili: false, douyin: false, kuaishou: false, youtube: false, xiaohongshu: false, cctv: false };

// 笔记风格/格式选项缓存（登录后从 /api/note_options 拉取，用于预设卡显示中文 label）
let noteOptionsCache = { styles: [], formats: [] };

// value -> 中文 label，缓存没拉到时 fallback 返回 value 本身
function styleLabel(value) {
  const found = noteOptionsCache.styles.find(s => s.value === value);
  return found ? found.label : value;
}
function formatLabel(value) {
  const found = noteOptionsCache.formats.find(f => f.value === value);
  return found ? found.label : value;
}

// 拉取 /api/note_options 到缓存（已登录才调，失败静默 -- 预设卡会用 value 兜底）
async function loadNoteOptionsToCache() {
  const auth = await getAuth();
  if (!auth.authToken) return;
  try {
    const data = await apiCallWithAuth(`${videoNoteUrl}/api/note_options`, { method: 'GET' });
    if (data.code === 0 && data.data) {
      noteOptionsCache.styles = data.data.styles || [];
      noteOptionsCache.formats = data.data.formats || [];
    }
  } catch (e) { /* 静默：预设卡用 value 兜底 */ }
}

// ─── 通过 background service worker 代理 API 请求（绕过 CORS + 注入 Bearer） ───
// 带 1 次重试，缓解 service worker 冷启动抖动
function apiCall(url, options = {}, token = null, retries = 1) {
  // 总超时 20s：比 service worker 的 fetch 超时（12s）稍长，
  // 保证 service worker 能先正常返回错误；同时兜底 service worker 通道异常
  // 导致 sendMessage callback 永不触发的情况，避免 onPush 永远卡在"推送中"。
  const TIMEOUT_MS = 20000;
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('请求超时（20s）- 服务无响应'));
    }, TIMEOUT_MS);

    const attempt = (n) => {
      chrome.runtime.sendMessage(
        { type: 'apiCall', url, options, token },
        (response) => {
          if (settled) return;
          if (chrome.runtime.lastError && n > 0) {
            // 通道关闭（service worker 冷启动），延迟重试
            setTimeout(() => attempt(n - 1), 150);
            return;
          }
          if (chrome.runtime.lastError) {
            settled = true;
            clearTimeout(timer);
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (response && response.success) {
            settled = true;
            clearTimeout(timer);
            resolve(response.data);
          } else {
            settled = true;
            clearTimeout(timer);
            reject(new Error(response?.error || '请求失败'));
          }
        }
      );
    };
    attempt(retries);
  });
}

// ─── 鉴权：token 存取 ─────────────────────────────────────────────
async function getAuth() {
  try {
    return await chrome.storage.local.get(['authToken', 'refreshToken', 'authUsername', 'authRole']);
  } catch (e) {
    return {};
  }
}
async function setAuth(patch) {
  await chrome.storage.local.set(patch);
}
async function clearAuth() {
  await chrome.storage.local.remove(['authToken', 'refreshToken', 'authUsername', 'authRole']);
}

// 401 时尝试用 refresh_token 续期，返回新 token 或 null
async function tryRefreshToken() {
  const auth = await getAuth();
  if (!auth.refreshToken) return null;

  try {
    const data = await apiCall(`${videoNoteUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refreshToken })
    });
    if (data.code === 0 && data.data && data.data.token) {
      await setAuth({ authToken: data.data.token });
      return data.data.token;
    }
  } catch (e) { /* ignore */ }
  return null;
}

// 带自动续期的 apiCall：401 时自动 refresh 一次再重试
async function apiCallWithAuth(url, options = {}) {
  const auth = await getAuth();
  if (!auth.authToken) {
    const err = new Error('未登录');
    err.code = 'NO_AUTH';
    throw err;
  }

  try {
    return await apiCall(url, options, auth.authToken);
  } catch (e) {
    if (/HTTP 401/.test(e.message)) {
      const newToken = await tryRefreshToken();
      if (newToken) {
        return await apiCall(url, options, newToken);
      }
      // refresh 也失效，清空登录态
      await clearAuth();
      showAuthGate();
      const err = new Error('登录已失效，请重新登录');
      err.code = 'AUTH_EXPIRED';
      throw err;
    }
    throw e;
  }
}

// ─── 确保对指定 URL 有访问权限 ─────────────────────────────────────
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

// ─── 复制到剪贴板 ─────────────────────────────────────────────────
async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

// ─── Toast ────────────────────────────────────────────────────────
const toastTimers = {};
function toast(panelId, msg, type) {
  const el = document.getElementById(panelId);
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast show ' + (type || '');
  clearTimeout(toastTimers[panelId]);
  toastTimers[panelId] = setTimeout(() => {
    el.className = 'toast ' + (type || '');
  }, 3000);
}

// ─── Loading 态 ───────────────────────────────────────────────────
// 调用方在成功分支若想保留禁用态，应在 finally 前 `delete btn.dataset.orig`，
// 这样 clearLoading 不会还原按钮（避免覆盖防重禁用态）
function setLoading(btn, text) {
  btn.disabled = true;
  btn.dataset.orig = btn.innerHTML;
  btn.innerHTML = `<span class="spin"></span>${text}`;
}
function clearLoading(btn) {
  // 没有 orig 说明调用方已主动接管按钮状态（如成功后保持禁用），直接返回
  if (!btn.dataset.orig) return;
  btn.disabled = false;
  btn.innerHTML = btn.dataset.orig;
  delete btn.dataset.orig;
}

// ─── 初始化 ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try { await loadConfig(); } catch (e) { /* chrome.storage 不可用（非扩展上下文） */ }
  initTabs();
  renderPlatforms();

  // 登录态检查：未登录显示遮罩，已登录才进真实流程
  let auth = {};
  try { auth = await getAuth(); } catch (e) { /* ignore */ }
  if (!auth.authToken) {
    showAuthGate();
  } else {
    hideAuthGate();
    // 已登录：拉取笔记风格/格式选项到缓存，再重新渲染预设卡（用中文 label 替换英文 value）
    try {
      await loadNoteOptionsToCache();
      await loadConfig(); // 重新渲染预设卡，此时 noteOptionsCache 已就绪
    } catch (e) { /* ignore */ }
    try { await detectCurrentPlatform(); } catch (e) { /* chrome.tabs 不可用 */ }
    try { await detectVideoUrl(); } catch (e) { /* chrome.scripting 不可用 */ }
  }

  initCookieTab();
  initSubmitTab();

  // 恢复上次 Tab，默认快捷提交
  try {
    const last = localStorage.getItem('vn-helper-tab');
    if (last === 'cookie') switchTab('cookie');
  } catch (e) { /* ignore */ }
});

// ─── 登录遮罩 ─────────────────────────────────────────────────────
function showAuthGate() {
  document.getElementById('authGate').classList.add('show');
}
function hideAuthGate() {
  document.getElementById('authGate').classList.remove('show');
}

// ─── 登录遮罩按钮 ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const gateBtn = document.getElementById('gateOpenOptions');
  if (gateBtn) {
    gateBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
});

// ─── 加载配置 ─────────────────────────────────────────────────────
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

  // 预设信息显示
  const presetModel = document.getElementById('presetModel');
  const presetStyle = document.getElementById('presetStyle');
  const presetFormat = document.getElementById('presetFormat');

  if (config.defaultModel) {
    presetModel.textContent = config.defaultModel;
    presetModel.classList.remove('empty');
  } else {
    presetModel.textContent = '未设置';
    presetModel.classList.add('empty');
  }

  if (config.defaultStyle) {
    presetStyle.textContent = styleLabel(config.defaultStyle);
    presetStyle.classList.remove('empty');
  } else {
    presetStyle.textContent = '未设置';
    presetStyle.classList.add('empty');
  }

  if (config.defaultFormat && config.defaultFormat.length) {
    presetFormat.textContent = config.defaultFormat.map(formatLabel).join('、');
    presetFormat.classList.remove('empty');
  } else {
    presetFormat.textContent = '未设置';
    presetFormat.classList.add('empty');
  }

  // Cookie 保存状态（兼容历史布尔值：true->'saved'，false->'unsaved'）
  if (config.cookieStatus) {
    const migrated = {};
    Object.entries(config.cookieStatus).forEach(([k, v]) => {
      if (v === true) migrated[k] = 'saved';
      else if (v === 'valid') migrated[k] = 'valid';
      else if (v === 'saved') migrated[k] = 'saved';
      else migrated[k] = 'unsaved';
    });
    savedCookieStatus = { ...savedCookieStatus, ...migrated };
  }
}

// ─── Tab 切换 + 持久 ──────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab').forEach(t => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
}
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.tabpane').forEach(p => {
    p.classList.toggle('active', p.id === `${name}-tab`);
  });
  try { localStorage.setItem('vn-helper-tab', name); } catch (e) { /* ignore */ }
}

// ─── 平台列表渲染（三态：valid=有效 / saved=已保存未验证 / unsaved=未保存） ────
function renderPlatforms() {
  const list = document.getElementById('platformList');
  list.innerHTML = '';

  PLATFORMS.forEach(p => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'platform-row' + (p.id === selectedPlatform ? ' selected' : '');
    row.dataset.platform = p.id;

    const status = savedCookieStatus[p.id]; // 'valid' / 'saved' / 'unsaved' / undefined
    const isCurrent = p.id === currentPlatform;

    const checkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    const warnSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

    let statusHtml;
    if (status === 'valid') {
      statusHtml = `<span class="p-status">${checkSvg}有效</span>`;
    } else if (status === 'saved') {
      statusHtml = `<span class="p-status saved">${warnSvg}已保存</span>`;
    } else {
      statusHtml = `<span class="p-status unsaved">未保存</span>`;
    }
    const currentBadge = isCurrent ? `<span class="p-current">当前</span>` : '';

    row.innerHTML = `
      <span class="badge ${p.cls}" aria-hidden="true">${p.initial}</span>
      <span class="p-name">${p.name}</span>
      ${statusHtml}
      ${currentBadge}
    `;
    row.addEventListener('click', () => {
      selectedPlatform = p.id;
      renderPlatforms();
    });
    list.appendChild(row);
  });
}

// ─── 检测当前页平台 ───────────────────────────────────────────────
async function detectCurrentPlatform() {
  const nameEl = document.getElementById('currentPlatformName');
  const dotEl = document.getElementById('currentDot');

  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    // chrome.tabs 不可用（非扩展上下文）
  }

  if (!tab || !tab.url) {
    nameEl.textContent = '未知';
    return;
  }

  let detected = null;
  for (const p of PLATFORMS) {
    for (const domain of p.domains) {
      if (tab.url.includes(domain)) { detected = p.id; break; }
    }
    if (detected) break;
  }

  currentPlatform = detected;

  if (detected) {
    nameEl.textContent = PLATFORM_NAMES[detected];
    dotEl.classList.remove('nonvideo');
    selectedPlatform = detected;
  } else {
    nameEl.textContent = '非视频平台';
    dotEl.classList.add('nonvideo');
  }

  renderPlatforms();
}

// ─── Cookie Tab ───────────────────────────────────────────────────
function initCookieTab() {
  document.getElementById('getCookieBtn').addEventListener('click', onGetCookie);
  document.getElementById('copyBtn').addEventListener('click', onCopy);
  document.getElementById('pushBtn').addEventListener('click', onPush);
  document.getElementById('netscapeBtn').addEventListener('click', onCopyNetscape);
}

async function onGetCookie() {
  if (!selectedPlatform) {
    toast('cookieToast', '请先选择平台', 'error');
    return;
  }

  const btn = document.getElementById('getCookieBtn');
  setLoading(btn, '获取中…');

  try {
    currentCookies = await getCookiesForPlatform(selectedPlatform);
    if (currentCookies) {
      document.getElementById('cookieText').value = currentCookies;
      document.getElementById('cookieResult').style.display = 'block';
      toast('cookieToast', 'Cookie 已获取', 'success');
    } else {
      toast('cookieToast', '未检测到登录态，请先在该平台登录', 'error');
    }
  } catch (e) {
    toast('cookieToast', `获取失败: ${e.message}`, 'error');
  } finally {
    clearLoading(btn);
  }
}

async function onCopy() {
  if (!currentCookies) return;
  try {
    await copyToClipboard(currentCookies);
    toast('cookieToast', '已复制到剪贴板', 'success');
  } catch (e) {
    toast('cookieToast', '复制失败', 'error');
  }
}

async function onCopyNetscape() {
  if (!currentCookies) return;
  try {
    const netscape = convertToNetscape(selectedPlatform, currentCookies);
    await copyToClipboard(netscape);
    toast('cookieToast', '已复制 Netscape 格式', 'success');
  } catch (e) {
    toast('cookieToast', '复制失败', 'error');
  }
}

async function onPush() {
  console.log('[onPush] 入口', { hasCookie: !!currentCookies, platform: selectedPlatform });
  if (!currentCookies || !selectedPlatform) {
    console.warn('[onPush] 早退：无 cookie 或未选平台');
    return;
  }

  // 入口快照：后续所有写入/校验都用局部变量，避免用户切平台导致状态写错 slot
  const platform = selectedPlatform;
  const cookie = currentCookies;

  const btn = document.getElementById('pushBtn');
  setLoading(btn, '推送中…');

  try {
    console.log('[onPush] 检查权限', videoNoteUrl);
    if (!await ensurePermission(videoNoteUrl)) {
      toast('cookieToast', '请先授权访问该服务', 'error');
      return;
    }

    const auth = await getAuth();
    console.log('[onPush] 鉴权', { hasToken: !!auth.authToken, role: auth.authRole });
    if (!auth.authToken) {
      toast('cookieToast', '请先在设置页登录', 'error');
      showAuthGate();
      return;
    }
    if (auth.authRole !== 'admin') {
      toast('cookieToast', '推送 Cookie 需要管理员账号', 'error');
      return;
    }

    console.log('[onPush] 调 update_downloader_cookie', platform);
    const data = await apiCallWithAuth(`${videoNoteUrl}/api/update_downloader_cookie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, cookie })
    });
    console.log('[onPush] update_downloader_cookie 返回', data);

    if (data.code !== 0) {
      toast('cookieToast', `推送失败: ${data.msg || '未知错误'}`, 'error');
      return;
    }

    // 推送成功，持久化保存状态（先标 saved，校验通过后升为 valid）
    savedCookieStatus[platform] = 'saved';
    renderPlatforms();
    const config = await chrome.storage.local.get('cookieStatus');
    const cookieStatus = { ...(config.cookieStatus || {}), [platform]: 'saved' };
    await chrome.storage.local.set({ cookieStatus });

    // 立即调 test_downloader_cookie 在线校验有效性
    setLoading(btn, '校验中…');
    console.log('[onPush] 调 test_downloader_cookie', platform);
    let validity;
    try {
      validity = await apiCallWithAuth(`${videoNoteUrl}/api/test_downloader_cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, cookie })
      });
      console.log('[onPush] test_downloader_cookie 返回', validity);
    } catch (e) {
      // 校验接口失败（网络/超时/auth 过期）-> 保留 saved 状态，不阻塞用户
      console.warn('[onPush] test_downloader_cookie 异常', e);
      const msg = (e.code === 'AUTH_EXPIRED' || e.code === 'NO_AUTH') ? e.message : '有效性校验失败（稍后可重试）';
      toast('cookieToast', `已推送，${msg}`, 'error');
      return;
    }

    if (validity.code === 0 && validity.data) {
      if (validity.data.valid) {
        savedCookieStatus[platform] = 'valid';
        const cs = await chrome.storage.local.get('cookieStatus');
        await chrome.storage.local.set({
          cookieStatus: { ...(cs.cookieStatus || {}), [platform]: 'valid' }
        });
        renderPlatforms();
        toast('cookieToast', `已推送 · ${validity.data.message || 'Cookie 有效'}`, 'success');
      } else {
        // 在线校验未通过（如 B站 isLogin=false）-> 保留 saved 状态
        const detail = validity.data.details || validity.data.message || 'Cookie 不可用';
        toast('cookieToast', `已推送但 Cookie 无效：${detail}`, 'error');
      }
    } else {
      toast('cookieToast', `已推送，校验失败: ${validity.msg || '未知错误'}`, 'error');
    }
  } catch (e) {
    console.error('[onPush] 异常', e);
    if (e.code === 'AUTH_EXPIRED' || e.code === 'NO_AUTH') {
      toast('cookieToast', e.message, 'error');
    } else {
      toast('cookieToast', `推送失败: ${e.message}`, 'error');
    }
  } finally {
    console.log('[onPush] finally，还原按钮');
    clearLoading(btn);
  }
}

// 获取平台所有 Cookie
async function getCookiesForPlatform(platform) {
  const domains = PLATFORM_DOMAINS[platform];
  const cookies = [];

  for (const domain of domains) {
    const domainCookies = await chrome.cookies.getAll({ domain });
    domainCookies.forEach(c => cookies.push(`${c.name}=${c.value}`));

    const subdomainCookies = await chrome.cookies.getAll({ domain: `.${domain}` });
    subdomainCookies.forEach(c => cookies.push(`${c.name}=${c.value}`));
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
    const i = item.indexOf('=');
    if (i > 0) {
      const name = item.slice(0, i).trim();
      const value = item.slice(i + 1).trim();
      lines.push(`.${primaryDomain}\tTRUE\t/\tFALSE\t0\t${name}\t${value}\n`);
    }
  });

  return lines.join('');
}

// ─── 提交 Tab ─────────────────────────────────────────────────────
function initSubmitTab() {
  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('submitBtn').addEventListener('click', onSubmitNoteTask);

  document.getElementById('refreshVideoBtn').addEventListener('click', async () => {
    await detectVideoUrl();
    toast('submitToast', '已重新检测当前页视频', 'success');
  });

  document.getElementById('copyUrlBtn').addEventListener('click', async () => {
    const url = document.getElementById('videoUrl').textContent;
    if (!url || url === '-') {
      toast('submitToast', '未检测到视频链接', 'error');
      return;
    }
    try {
      await copyToClipboard(url);
      toast('submitToast', '视频链接已复制', 'success');
    } catch (e) {
      toast('submitToast', '复制失败', 'error');
    }
  });
}

// 检测视频 URL + 标题
async function detectVideoUrl() {
  const urlEl = document.getElementById('videoUrl');
  const titleEl = document.getElementById('videoTitle');
  const emptyTip = document.getElementById('videoEmptyTip');
  const copyUrlBtn = document.getElementById('copyUrlBtn');
  const refreshVideoBtn = document.getElementById('refreshVideoBtn');
  const submitBtn = document.getElementById('submitBtn');

  let tab = null;
  try {
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  } catch (e) {
    // chrome.tabs 不可用（非扩展上下文）
  }

  if (!tab || !tab.url || !currentPlatform) {
    urlEl.textContent = '-';
    urlEl.classList.add('empty');
    titleEl.textContent = '未检测到视频页面';
    titleEl.classList.add('empty');
    emptyTip.style.display = 'block';
    copyUrlBtn.disabled = true;
    refreshVideoBtn.disabled = !currentPlatform; // 没平台就没必要重新检测
    submitBtn.disabled = true;
    return;
  }

  urlEl.textContent = tab.url;
  urlEl.classList.remove('empty');
  emptyTip.style.display = 'none';
  copyUrlBtn.disabled = false;
  refreshVideoBtn.disabled = false;
  submitBtn.disabled = false;

  // 尝试获取视频标题
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
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
    const title = results && results[0]?.result;
    titleEl.textContent = title || '未能获取';
    titleEl.classList.remove('empty');
  } catch (e) {
    titleEl.textContent = '未能获取';
  }
}

// 提交笔记任务
// 防重策略：①提交期间按钮 disabled ②本次 popup 会话已提交过的 videoUrl 不允许重复提交
const submittedUrls = new Set(); // 本次 popup 会话已提交的 video_url 集合（防重）

async function onSubmitNoteTask(overrideUrl) {
  // overrideUrl 用于失败任务重试：传入失败任务的原 URL，而不是读当前页 URL
  // 注意：本函数也会被 addEventListener('click', onSubmitNoteTask) 直接调用，
  // 此时 overrideUrl 是 PointerEvent 对象，必须过滤掉，否则 video_url 会变成 [object PointerEvent]
  const videoUrl = (typeof overrideUrl === 'string' && overrideUrl)
    ? overrideUrl
    : document.getElementById('videoUrl').textContent;
  if (!videoUrl || videoUrl === '-') {
    toast('submitToast', '未检测到视频页面', 'error');
    return;
  }

  // 防重：同一 URL 本次会话已提交过（除非是重试失败任务，已在外层移除记录）
  if (submittedUrls.has(videoUrl)) {
    toast('submitToast', '该视频已提交，请查看下方任务列表', 'error');
    return;
  }

  const auth = await getAuth();
  if (!auth.authToken) {
    toast('submitToast', '请先在设置页登录', 'error');
    showAuthGate();
    return;
  }

  const config = await chrome.storage.local.get([
    'defaultModel',
    'defaultProviderId',
    'defaultStyle',
    'defaultFormat',
    'defaultQuality'
  ]);

  const requestData = {
    video_url: videoUrl,
    platform: currentPlatform || 'unknown',
    quality: config.defaultQuality || 'fast',
    model_name: config.defaultModel || '',
    provider_id: config.defaultProviderId || '',
    format: config.defaultFormat || [],
    style: config.defaultStyle || ''
  };

  const btn = document.getElementById('submitBtn');
  setLoading(btn, '提交中…');

  try {
    if (!await ensurePermission(videoNoteUrl)) {
      toast('submitToast', '请先授权访问该服务', 'error');
      return;
    }

    const data = await apiCallWithAuth(`${videoNoteUrl}/api/generate_note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    if (data.code === 0) {
      const taskId = data.data?.task_id || '';
      const videoTitle = document.getElementById('videoTitle').textContent;

      // 记录已提交 URL，防止重复
      submittedUrls.add(videoUrl);

      // 弹出成功 Message（带查看笔记/复制编号按钮，3秒自动消失）
      showMessage('success', {
        title: '提交成功！任务已创建',
        body: videoTitle || videoUrl,
        detail: taskId,
        taskId,
      });

      // 提交成功后：保留按钮禁用，显示「提交新任务」入口
      // delete orig 让 finally 的 clearLoading 不会还原按钮（避免覆盖防重禁用态）
      delete btn.dataset.orig;
      btn.disabled = true;
      btn.innerHTML = '已提交';
      showNewTaskEntry();
    } else {
      // 失败：弹出错误 Message（3秒自动消失，提交按钮保持可点允许重试）
      showMessage('error', {
        title: '提交失败',
        body: videoTitle || videoUrl,
        detail: data.msg || '未知错误',
      });
      btn.disabled = false;
      btn.innerHTML = '提交笔记任务';
    }
  } catch (e) {
    if (e.code === 'AUTH_EXPIRED' || e.code === 'NO_AUTH') {
      toast('submitToast', e.message, 'error');
    } else {
      const videoTitle = document.getElementById('videoTitle').textContent;
      showMessage('error', {
        title: '提交失败',
        body: videoTitle || videoUrl,
        detail: e.message,
      });
      btn.disabled = false;
      btn.innerHTML = '提交笔记任务';
    }
  } finally {
    clearLoading(btn);
  }
}

// Message 全局提示（成功/失败，3秒自动消失，带操作按钮）
// opts: { title, body, detail, taskId? }
// 成功态带「查看笔记」「复制编号」按钮；失败态无按钮（靠提交按钮重试）
let messageTimer;
function showMessage(state, opts) {
  const el = document.getElementById('submitMessage');
  if (!el) return;

  const isOk = state === 'success';
  const icon = isOk
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  const tid = opts.taskId || '';
  const safeTid = escapeHtml(tid);
  const safeTitle = escapeHtml(opts.title || (isOk ? '提交成功' : '提交失败'));
  const safeBody = escapeHtml(opts.body || '');
  const safeDetail = escapeHtml(opts.detail || '');

  // 成功态且有 taskId 才显示操作按钮
  const opsHtml = (isOk && tid)
    ? `<div class="msg-ops">
         <button class="btn btn-primary" data-act="view" data-tid="${safeTid}">查看笔记</button>
         <button class="btn btn-secondary" data-act="copy" data-tid="${safeTid}">复制编号</button>
       </div>`
    : '';

  el.innerHTML = `
    <div class="msg-head">${icon}${safeTitle}</div>
    ${safeBody ? `<div class="msg-body" title="${safeBody}">${safeBody}</div>` : ''}
    ${safeDetail ? `<div class="msg-detail">${safeDetail}</div>` : ''}
    ${opsHtml}
  `;
  el.className = 'message show ' + state;

  // 绑定操作按钮
  el.querySelectorAll('button[data-act]').forEach(b => {
    b.addEventListener('click', () => {
      const act = b.dataset.act;
      const clickedTid = b.dataset.tid;
      if (act === 'view') {
        // 校验 tid 是合法 UUID（防 XSS/任意 URL 跳转）
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRe.test(clickedTid)) {
          toast('submitToast', '任务编号不合法', 'error');
          return;
        }
        chrome.tabs.create({ url: `${videoNoteUrl}/?task_id=${clickedTid}` });
      } else if (act === 'copy') {
        copyToClipboard(clickedTid).then(
          () => toast('submitToast', '任务编号已复制', 'success'),
          () => toast('submitToast', '复制失败', 'error')
        );
      }
    });
  });

  // 3 秒后自动消失
  clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    el.className = 'message ' + state;
  }, 3000);
}

// 提交成功后显示「提交新任务」入口
function showNewTaskEntry() {
  let entry = document.getElementById('newTaskEntry');
  if (!entry) {
    entry = document.createElement('div');
    entry.id = 'newTaskEntry';
    entry.className = 'new-task-row';
    entry.innerHTML = `<button class="btn btn-secondary" id="newTaskBtn" style="height:32px;font-size:var(--text-xs);padding:0 var(--space-4)">提交新任务</button>`;
    document.getElementById('submitBtn').after(entry);
    document.getElementById('newTaskBtn').addEventListener('click', resetForNewTask);
  }
  entry.style.display = 'flex';
}

// 重置为可提交新任务状态
function resetForNewTask() {
  const btn = document.getElementById('submitBtn');
  btn.disabled = false;
  btn.innerHTML = '提交笔记任务';
  const entry = document.getElementById('newTaskEntry');
  if (entry) entry.style.display = 'none';
  toast('submitToast', '请切换到其他视频页或重新打开 popup', 'success');
}

// HTML 转义（任务标题可能含特殊字符）
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
