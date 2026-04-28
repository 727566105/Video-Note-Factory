// options.js - 设置页逻辑

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

// 确保对指定 URL 有访问权限（需要用户手势触发）
async function ensurePermission(url) {
  try {
    const origin = new URL(url).origin;
    const hasPermission = await chrome.permissions.contains({ origins: [origin + '/*'] });
    if (!hasPermission) {
      // 这里需要用户手势（如点击按钮），否则权限请求会静默失败
      const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
      if (!granted) {
        throw new Error('权限未授予');
      }
    }
    return true;
  } catch (e) {
    throw e;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  // 不在页面加载时自动加载模型，改为保存后或测试时加载

  document.getElementById('save-btn').addEventListener('click', saveConfig);
  document.getElementById('test-btn').addEventListener('click', testConnection);

  // 地址变更时显示提示
  document.getElementById('videoNoteUrl').addEventListener('change', () => {
    document.getElementById('defaultModel').innerHTML = '<option value="">保存设置后加载模型</option>';
    showMessage('save-message', '地址已更改，请点击保存后重新加载模型', '');
  });
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

  document.getElementById('videoNoteUrl').value = config.videoNoteUrl || 'http://localhost:8483';
  document.getElementById('defaultStyle').value = config.defaultStyle || '精简';
  document.getElementById('defaultQuality').value = config.defaultQuality || 'fast';

  // 设置已保存的模型值
  if (config.defaultModel) {
    document.getElementById('defaultModel').dataset.savedModel = config.defaultModel;
  }
  if (config.defaultProviderId) {
    document.getElementById('defaultModel').dataset.savedProviderId = config.defaultProviderId;
  }

  // 设置格式复选框
  const formats = config.defaultFormat || ['目录', '原片跳转', 'AI总结'];
  if (formats.includes('目录')) document.getElementById('format-toc').checked = true;
  if (formats.includes('原片跳转')) document.getElementById('format-link').checked = true;
  if (formats.includes('AI总结')) document.getElementById('format-summary').checked = true;

  // 如果已保存地址，尝试加载模型（用户已授权过）
  if (config.videoNoteUrl) {
    await loadModels(config.videoNoteUrl);
  }
}

// 从 VideoNote 加载模型列表
async function loadModels(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');
  const select = document.getElementById('defaultModel');
  const savedModel = select.dataset.savedModel;
  const savedProviderId = select.dataset.savedProviderId;

  select.innerHTML = '<option value="">加载中...</option>';

  try {
    // 检查权限
    const hasPermission = await chrome.permissions.contains({ origins: [new URL(url).origin + '/*'] });
    if (!hasPermission) {
      select.innerHTML = '<option value="">请先保存设置以授权访问</option>';
      return;
    }

    const data = await apiCall(`${url}/api/model_list`);

    if (data.code === 0 && data.data) {
      select.innerHTML = '';

      const models = data.data;

      if (models.length === 0) {
        select.innerHTML = '<option value="">暂无可用模型</option>';
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

      // 默认选中第一个
      if (!savedModel && models.length > 0) {
        select.selectedIndex = 0;
      }
    } else {
      select.innerHTML = `<option value="">错误: ${data.msg || '未知'}</option>`;
    }
  } catch (e) {
    console.error('加载模型列表失败:', e);
    // 更具体的错误提示
    let errorMsg = '连接失败';
    if (e.message.includes('权限')) {
      errorMsg = '请先授权访问该服务';
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      errorMsg = '无法连接服务器（检查地址或证书）';
    } else if (e.message.includes('TypeError')) {
      errorMsg = '地址格式错误';
    }
    select.innerHTML = `<option value="">${errorMsg}</option>`;
  }
}

// 测试连接
async function testConnection() {
  const videoNoteUrl = document.getElementById('videoNoteUrl').value.replace(/\/$/, '');
  const testMessage = document.getElementById('test-message');

  if (!videoNoteUrl) {
    showMessage('test-message', '请输入服务地址', 'error');
    return;
  }

  try {
    // 验证 URL 格式
    new URL(videoNoteUrl);
  } catch (e) {
    showMessage('test-message', '地址格式错误，请输入完整 URL（如 https://example.com:8483）', 'error');
    return;
  }

  showMessage('test-message', '正在测试连接...', '');

  try {
    // 先请求权限（用户点击按钮触发，满足用户手势要求）
    const granted = await ensurePermission(videoNoteUrl);
    if (!granted) {
      showMessage('test-message', '需要授权才能访问该服务地址', 'error');
      return;
    }

    // 测试 API 调用
    const data = await apiCall(`${videoNoteUrl}/api/model_list`);

    if (data.code === 0) {
      const modelCount = data.data?.length || 0;
      showMessage('test-message', `连接成功！发现 ${modelCount} 个可用模型`, 'success');

      // 自动加载模型列表
      await loadModels(videoNoteUrl);
    } else {
      showMessage('test-message', `服务响应错误: ${data.msg || '未知错误'}`, 'error');
    }
  } catch (e) {
    console.error('测试连接失败:', e);
    let errorMsg = '连接失败';

    if (e.message.includes('权限')) {
      errorMsg = '权限请求被拒绝';
    } else if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
      errorMsg = '无法连接服务器（请检查地址是否正确、服务是否运行、HTTPS证书是否有效）';
    } else {
      errorMsg = `连接失败: ${e.message}`;
    }

    showMessage('test-message', errorMsg, 'error');
  }
}

// 保存配置
async function saveConfig() {
  const videoNoteUrl = document.getElementById('videoNoteUrl').value.replace(/\/$/, '');
  const modelSelect = document.getElementById('defaultModel');
  const defaultModel = modelSelect.value;
  const selectedOption = modelSelect.options[modelSelect.selectedIndex];
  const defaultProviderId = selectedOption?.dataset?.providerId || '';
  const defaultStyle = document.getElementById('defaultStyle').value;
  const defaultQuality = document.getElementById('defaultQuality').value;

  // 收集格式
  const defaultFormat = [];
  if (document.getElementById('format-toc').checked) defaultFormat.push('目录');
  if (document.getElementById('format-link').checked) defaultFormat.push('原片跳转');
  if (document.getElementById('format-summary').checked) defaultFormat.push('AI总结');

  try {
    // 验证 URL 格式
    new URL(videoNoteUrl);
  } catch (e) {
    showMessage('save-message', '地址格式错误', 'error');
    return;
  }

  try {
    // 请求域名权限（用户点击按钮触发，满足用户手势要求）
    const origin = new URL(videoNoteUrl).origin;
    const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
    if (!granted) {
      showMessage('save-message', '需要授权才能访问该服务地址', 'error');
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

    showMessage('save-message', '设置已保存', 'success');

    // 保存后自动加载模型
    await loadModels(videoNoteUrl);
  } catch (e) {
    showMessage('save-message', `保存失败: ${e.message}`, 'error');
  }
}

// 显示消息
function showMessage(elementId, text, type) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = `message ${type}`;

  if (text) {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }

  // 成功消息 3 秒后消失
  if (type === 'success') {
    setTimeout(() => {
      el.className = 'message';
      el.style.display = 'none';
    }, 3000);
  }
}