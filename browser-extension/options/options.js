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

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await loadModels();

  document.getElementById('save-btn').addEventListener('click', saveConfig);

  // 地址变更时重新加载模型
  document.getElementById('videoNoteUrl').addEventListener('change', loadModels);
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

  // 设置已保存的模型值（加载后设置）
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

// 从 VideoNote 加载模型列表
async function loadModels() {
  const url = document.getElementById('videoNoteUrl').value.replace(/\/$/, '');
  const select = document.getElementById('defaultModel');

  try {
    // 先请求权限
    const hasPermission = await ensurePermission(url);
    if (!hasPermission) {
      select.innerHTML = '<option value="">请先授权访问该服务</option>';
      return;
    }

    const data = await apiCall(`${url}/api/model_list`);

    if (data.code === 0 && data.data) {
      select.innerHTML = '';

      const models = data.data;
      const savedModel = select.dataset.savedModel;
      const savedProviderId = select.dataset.savedProviderId;

      if (models.length === 0) {
        select.innerHTML = '<option value="">暂无可用模型</option>';
        return;
      }

      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.model_name;
        option.textContent = `${model.model_name}`;
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
      select.innerHTML = '<option value="">加载失败</option>';
    }
  } catch (e) {
    console.error('加载模型列表失败:', e);
    select.innerHTML = '<option value="">无法连接到服务</option>';
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
    // 请求域名权限
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
  } catch (e) {
    showMessage('save-message', `保存失败: ${e.message}`, 'error');
  }
}

// 显示消息
function showMessage(elementId, text, type) {
  const el = document.getElementById(elementId);
  el.textContent = text;
  el.className = `message ${type}`;

  setTimeout(() => {
    el.className = 'message';
  }, 3000);
}