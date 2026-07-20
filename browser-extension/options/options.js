// options.js - 设置页逻辑（含登录鉴权 + 真实 chrome.* 逻辑）

// 默认值（恢复默认时使用）
const DEFAULTS = {
  url: 'http://localhost:8483',
  model: '',
  providerId: '',
  style: '精简',
  formats: ['目录', '原片跳转', 'AI总结'],
  quality: 'fast'
};

// ─── 通过 background service worker 代理 API 请求（绕过 CORS + 注入 Bearer） ───
// 带 1 次重试，缓解 service worker 冷启动抖动
function apiCall(url, options = {}, token = null, retries = 1) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      chrome.runtime.sendMessage(
        { type: 'apiCall', url, options, token },
        (response) => {
          if (chrome.runtime.lastError && n > 0) {
            // 通道关闭（service worker 冷启动），延迟重试
            setTimeout(() => attempt(n - 1), 150);
            return;
          }
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
    };
    attempt(retries);
  });
}

// 确保对指定 URL 有访问权限（需要用户手势触发）
async function ensurePermission(url) {
  try {
    const origin = new URL(url).origin;
    const hasPermission = await chrome.permissions.contains({ origins: [origin + '/*'] });
    if (!hasPermission) {
      const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
      if (!granted) throw new Error('权限未授予');
    }
    return true;
  } catch (e) {
    throw e;
  }
}

// URL 合法性校验
function isValidUrl(s) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

// ─── 鉴权：token 存取 ─────────────────────────────────────────────
async function getAuth() {
  try {
    return await chrome.storage.local.get(['authToken', 'refreshToken', 'authUsername', 'authRole']);
  } catch (e) {
    return {};
  }
}
async function setAuth({ token, refreshToken, username, role }) {
  const patch = {};
  if (token !== undefined) patch.authToken = token;
  if (refreshToken !== undefined) patch.refreshToken = refreshToken;
  if (username !== undefined) patch.authUsername = username;
  if (role !== undefined) patch.authRole = role;
  await chrome.storage.local.set(patch);
}
async function clearAuth() {
  await chrome.storage.local.remove(['authToken', 'refreshToken', 'authUsername', 'authRole']);
}

// Toast
let toastTimer;
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (type || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast ' + (type || '');
  }, 3000);
}

// Loading 态
function setLoading(btn, text) {
  btn.disabled = true;
  btn.dataset.orig = btn.innerHTML;
  btn.innerHTML = `<span class="spin"></span>${text}`;
}
function clearLoading(btn) {
  btn.disabled = false;
  if (btn.dataset.orig) {
    btn.innerHTML = btn.dataset.orig;
    delete btn.dataset.orig;
  }
}

// 测试结果条带
function setTestResult(state, msg) {
  const el = document.getElementById('testResult');
  el.className = 'test-result show ' + state;
  const icon = state === 'success'
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  el.innerHTML = `${icon}${msg}`;
}
function clearTestResult() {
  document.getElementById('testResult').className = 'test-result';
}

// 实时校验：根据 URL 输入切换按钮可用性 + hint
function updateButtonState() {
  const url = document.getElementById('videoNoteUrl').value.trim();
  const ok = isValidUrl(url);
  document.getElementById('testBtn').disabled = !ok;
  document.getElementById('saveBtn').disabled = !ok;
  document.getElementById('urlHint').style.display = ok ? 'block' : 'none';
  document.getElementById('urlErrorHint').style.display = ok ? 'none' : 'block';
  if (!ok) clearTestResult();
}

// ─── 账号登录：渲染登录表单 or 已登录状态 ──────────────────────────
function renderAuthSection(auth) {
  const section = document.getElementById('authSection');
  if (auth.authToken && auth.authUsername) {
    const isAdmin = auth.authRole === 'admin';
    section.innerHTML = `
      <div class="auth-status">
        <span class="avatar">${auth.authUsername.charAt(0).toUpperCase()}</span>
        <span class="uname">${auth.authUsername}</span>
        <span class="role-tag ${isAdmin ? 'admin' : ''}">${isAdmin ? '管理员' : '普通用户'}</span>
        ${!isAdmin ? '<span style="color:var(--muted);font-size:var(--text-xs)">（推 Cookie 需管理员）</span>' : ''}
        <a href="#" class="logout" id="logoutBtn" role="button">退出登录</a>
      </div>
    `;
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      await clearAuth();
      renderAuthSection({});
      showToast('已退出登录', 'success');
      // 清空模型列表（需要重新登录才能拉）
      const modelSelect = document.getElementById('defaultModel');
      modelSelect.innerHTML = '<option value="">登录后加载模型</option>';
    });
  } else {
    section.innerHTML = `
      <section class="card">
        <h2 class="section-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          账号登录
        </h2>
        <div class="field">
          <label for="loginUsername">用户名</label>
          <input class="input" id="loginUsername" type="text" placeholder="admin" autocomplete="off">
        </div>
        <div class="field">
          <label for="loginPassword">密码</label>
          <input class="input" id="loginPassword" type="password" placeholder="输入密码" autocomplete="off">
        </div>
        <div class="save-row" style="margin-top:var(--space-4)">
          <button class="btn btn-primary" id="loginBtn">登录</button>
        </div>
        <div class="hint" style="margin-top:var(--space-3)">
          登录后才能拉取模型列表、提交笔记任务；推送 Cookie 需要管理员账号。
          token 存于本地（chrome.storage.local），24 小时后自动续期。
        </div>
      </section>
    `;
    document.getElementById('loginBtn').addEventListener('click', onLogin);
  }
}

// ─── 登录 ─────────────────────────────────────────────────────────
async function onLogin() {
  const url = document.getElementById('videoNoteUrl').value.trim().replace(/\/$/, '');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!isValidUrl(url)) {
    showToast('请先在下方填写正确的服务地址', 'error');
    return;
  }
  if (!username || !password) {
    showToast('请输入用户名和密码', 'error');
    return;
  }

  const btn = document.getElementById('loginBtn');
  setLoading(btn, '登录中…');

  try {
    if (!await ensurePermission(url)) {
      showToast('请先授权访问该服务', 'error');
      return;
    }

    // 后端 /api/auth/login 成功返回 {code:0, data:{token, refresh_token?, user}}
    // 失败返回 FastAPI 原生 {detail: "..."}（HTTP 401/429），apiCall 会在非 2xx 时抛错带 detail
    let data;
    try {
      data = await apiCall(`${url}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, remember_me: true })
      });
    } catch (e) {
      // 登录失败：错误信息形如 "HTTP 401: 用户名或密码错误"
      showToast(e.message.replace(/^HTTP \d+:?\s*/, '') || '登录失败', 'error');
      return;
    }

    if (data.code === 0 && data.data && data.data.token) {
      const d = data.data;
      await setAuth({
        token: d.token,
        refreshToken: d.refresh_token || null,
        username: d.user?.username || username,
        role: d.user?.role || ''
      });
      renderAuthSection({
        authToken: d.token,
        refreshToken: d.refresh_token || null,
        authUsername: d.user?.username || username,
        authRole: d.user?.role || ''
      });
      showToast(`已登录 ${d.user?.username || username}`, 'success');
      // 登录后自动拉模型
      await loadModels(url);
    } else {
      showToast(data.msg || '登录失败', 'error');
    }
  } finally {
    clearLoading(btn);
  }
}

// ─── Token 续期：用 refresh_token 换新的 access_token ──────────────
// 返回有效 token；若 refresh 也失效则清空登录态返回 null
async function ensureValidToken() {
  const auth = await getAuth();
  if (!auth.authToken) return null;

  // 先尝试当前 token 是否还有效（通过 /api/auth/me 验证）
  // 实现上简化：直接返回当前 token，过期由后端返回 401 时触发 refresh 流程
  return auth.authToken;
}

// 401 时尝试用 refreshToken 续期，返回 true 表示续期成功可重试
// 失败时（refresh 也过期/网络异常）会清空登录态并重渲登录区，避免残留过期 token
async function tryRefreshToken() {
  const auth = await getAuth();
  if (!auth.refreshToken) {
    // 无 refresh token 且 access token 已 401 -> 清登录态
    await clearAuth();
    renderAuthSection({});
    return false;
  }

  const url = (await chrome.storage.local.get('videoNoteUrl')).videoNoteUrl?.replace(/\/$/, '');
  if (!url) return false;

  try {
    // /api/auth/refresh body: {refresh_token: "..."}, 返回 {code:0, data:{token}}
    const data = await apiCall(`${url}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refreshToken })
    });
    if (data.code === 0 && data.data && data.data.token) {
      await setAuth({ token: data.data.token });
      return true;
    }
    // refresh 接口返回非 0（refresh token 也失效）-> 清登录态
    await clearAuth();
    renderAuthSection({});
    showToast('登录已失效，请重新登录', 'error');
    return false;
  } catch (e) {
    // 网络异常无法判断 -> 不清 auth（保留旧 token，下次再试）
    return false;
  }
}

// ─── 初始化 ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  try { await loadConfig(); } catch (e) { /* chrome.storage 不可用 */ }

  // 渲染登录态
  let auth = {};
  try { auth = await getAuth(); } catch (e) { /* ignore */ }
  renderAuthSection(auth);

  document.getElementById('saveBtn').addEventListener('click', saveConfig);
  document.getElementById('testBtn').addEventListener('click', testConnection);
  document.getElementById('resetBtn').addEventListener('click', resetDefaults);
  document.getElementById('videoNoteUrl').addEventListener('input', updateButtonState);

  // 已登录 + 已有保存地址时尝试加载模型
  if (auth.authToken) {
    const url = document.getElementById('videoNoteUrl').value.trim();
    if (url && isValidUrl(url)) {
      try { await loadModels(url); } catch (e) { /* ignore */ }
    }
  } else {
    document.getElementById('defaultModel').innerHTML = '<option value="">登录后加载模型</option>';
  }
  updateButtonState();
});

// 加载配置
async function loadConfig() {
  const config = await chrome.storage.local.get([
    'videoNoteUrl',
    'defaultModel',
    'defaultProviderId',
    'defaultStyle',
    'defaultFormat',
    'defaultQuality'
  ]);

  document.getElementById('videoNoteUrl').value = config.videoNoteUrl || DEFAULTS.url;
  document.getElementById('defaultStyle').value = config.defaultStyle || DEFAULTS.style;
  document.getElementById('defaultQuality').value = config.defaultQuality || DEFAULTS.quality;

  // 缓存已保存的模型/provider_id，等下拉填充后选中
  const modelSelect = document.getElementById('defaultModel');
  if (config.defaultModel) modelSelect.dataset.savedModel = config.defaultModel;
  if (config.defaultProviderId) modelSelect.dataset.savedProviderId = config.defaultProviderId;

  // 复选框
  const formats = config.defaultFormat || DEFAULTS.formats;
  document.querySelectorAll('#formatGroup input[type="checkbox"]').forEach(cb => {
    cb.checked = formats.includes(cb.value);
  });
}

// 从 VideoNote 加载模型列表（带 Bearer token）
async function loadModels(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');
  const select = document.getElementById('defaultModel');
  const savedModel = select.dataset.savedModel;
  const auth = await getAuth();

  if (!auth.authToken) {
    select.innerHTML = '<option value="">登录后加载模型</option>';
    return;
  }

  select.innerHTML = '<option value="">加载中...</option>';
  select.disabled = true;

  try {
    const hasPermission = await chrome.permissions.contains({ origins: [new URL(url).origin + '/*'] });
    if (!hasPermission) {
      select.innerHTML = '<option value="">请先保存设置以授权访问</option>';
      select.disabled = false;
      return;
    }

    let data;
    try {
      data = await apiCall(`${url}/api/model_list`, { method: 'GET' }, auth.authToken);
    } catch (e) {
      // 401 时尝试 refresh 续期一次
      if (/HTTP 401/.test(e.message) && await tryRefreshToken()) {
        const newAuth = await getAuth();
        data = await apiCall(`${url}/api/model_list`, { method: 'GET' }, newAuth.authToken);
      } else {
        throw e;
      }
    }

    if (data.code === 0 && Array.isArray(data.data)) {
      const models = data.data;
      select.innerHTML = '';

      if (models.length === 0) {
        select.innerHTML = '<option value="">暂无可用模型，请检查服务地址</option>';
        select.disabled = false;
        return;
      }

      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.model_name;
        option.textContent = model.model_name;
        option.dataset.providerId = model.provider_id;
        if (savedModel && model.model_name === savedModel) {
          option.selected = true;
        }
        select.appendChild(option);
      });

      select.disabled = false;
    } else {
      select.innerHTML = `<option value="">错误: ${data.msg || '未知'}</option>`;
      select.disabled = false;
    }
  } catch (e) {
    let errorMsg = '连接失败';
    if (e.message.includes('权限')) errorMsg = '请先授权访问该服务';
    else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) errorMsg = '无法连接服务器（检查地址或证书）';
    else if (e.message.includes('HTTP 401')) errorMsg = '登录已失效，请重新登录';
    else if (e.message.includes('HTTP 403')) errorMsg = '无权访问';
    else if (e.message.includes('TypeError')) errorMsg = '地址格式错误';
    else errorMsg = e.message;
    select.innerHTML = `<option value="">${errorMsg}</option>`;
    select.disabled = false;
  }
}

// 测试连接
async function testConnection() {
  const videoNoteUrl = document.getElementById('videoNoteUrl').value.trim().replace(/\/$/, '');
  if (!isValidUrl(videoNoteUrl)) {
    setTestResult('error', '地址格式不正确，请输入完整 URL');
    return;
  }

  const auth = await getAuth();
  if (!auth.authToken) {
    setTestResult('error', '请先在上方登录');
    return;
  }

  const btn = document.getElementById('testBtn');
  setLoading(btn, '测试中…');
  clearTestResult();

  try {
    const granted = await ensurePermission(videoNoteUrl);
    if (!granted) {
      setTestResult('error', '权限请求被拒绝');
      return;
    }

    let data;
    try {
      data = await apiCall(`${videoNoteUrl}/api/model_list`, { method: 'GET' }, auth.authToken);
    } catch (e) {
      if (/HTTP 401/.test(e.message) && await tryRefreshToken()) {
        const newAuth = await getAuth();
        data = await apiCall(`${videoNoteUrl}/api/model_list`, { method: 'GET' }, newAuth.authToken);
      } else {
        throw e;
      }
    }

    if (data.code === 0) {
      const modelCount = (data.data && data.data.length) || 0;
      setTestResult('success', `连接成功 · 发现 ${modelCount} 个可用模型`);
      await loadModels(videoNoteUrl);
    } else {
      setTestResult('error', `服务响应错误: ${data.msg || '未知错误'}`);
    }
  } catch (e) {
    let errorMsg;
    if (e.message.includes('权限')) errorMsg = '权限请求被拒绝';
    else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) errorMsg = '无法连接服务器（请检查地址、端口、HTTPS 证书）';
    else if (e.message.includes('HTTP 401')) errorMsg = '登录已失效，请重新登录';
    else if (e.message.includes('HTTP 403')) errorMsg = '无权访问';
    else errorMsg = e.message;
    setTestResult('error', errorMsg);
  } finally {
    clearLoading(btn);
  }
}

// 保存配置
async function saveConfig() {
  const videoNoteUrl = document.getElementById('videoNoteUrl').value.trim().replace(/\/$/, '');
  if (!isValidUrl(videoNoteUrl)) {
    showToast('服务地址格式不正确', 'error');
    return;
  }

  const modelSelect = document.getElementById('defaultModel');
  const defaultModel = modelSelect.value;
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const defaultProviderId = selectedOption?.dataset?.providerId || '';
  const defaultStyle = document.getElementById('defaultStyle').value;
  const defaultQuality = document.getElementById('defaultQuality').value;

  const defaultFormat = [];
  document.querySelectorAll('#formatGroup input[type="checkbox"]:checked').forEach(cb => {
    defaultFormat.push(cb.value);
  });

  const btn = document.getElementById('saveBtn');
  setLoading(btn, '保存中…');

  try {
    const origin = new URL(videoNoteUrl).origin;
    const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
    if (!granted) {
      showToast('需要授权才能访问该服务地址', 'error');
      return;
    }

    await chrome.storage.local.set({
      videoNoteUrl,
      defaultModel,
      defaultProviderId,
      defaultStyle,
      defaultFormat,
      defaultQuality
    });

    showToast('设置已保存', 'success');
    const auth = await getAuth();
    if (auth.authToken) await loadModels(videoNoteUrl);
  } catch (e) {
    showToast(`保存失败: ${e.message}`, 'error');
  } finally {
    clearLoading(btn);
  }
}

// 恢复默认
function resetDefaults() {
  document.getElementById('videoNoteUrl').value = DEFAULTS.url;
  document.getElementById('defaultStyle').value = DEFAULTS.style;
  document.getElementById('defaultQuality').value = DEFAULTS.quality;

  const modelSelect = document.getElementById('defaultModel');
  modelSelect.innerHTML = '<option value="">保存设置后加载模型</option>';
  delete modelSelect.dataset.savedModel;
  delete modelSelect.dataset.savedProviderId;

  document.querySelectorAll('#formatGroup input[type="checkbox"]').forEach(cb => {
    cb.checked = DEFAULTS.formats.includes(cb.value);
  });

  updateButtonState();
  clearTestResult();
  showToast('已恢复默认参数（未保存，请点击保存）', 'success');
}
