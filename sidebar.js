document.addEventListener('DOMContentLoaded', init);

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];

  if (!tab || !isTrackable(tab)) {
    document.getElementById('title').textContent = '此页面无法记录（系统页面）';
    document.getElementById('noteInput').disabled = true;
    document.getElementById('saveBtn').disabled = true;
    return;
  }

  document.getElementById('favicon').src = tab.favIconUrl || '';
  document.getElementById('title').textContent = tab.title || tab.url;

  // 检查是否已有笔记
  const data = await chrome.storage.local.get('watchedTabs');
  const watched = data.watchedTabs || [];
  const existing = watched.find(t => normalizeUrl(t.url) === normalizeUrl(tab.url));
  if (existing && existing.note) {
    document.getElementById('noteInput').value = existing.note;
  }

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const note = document.getElementById('noteInput').value.trim();
    await chrome.runtime.sendMessage({
      type: 'saveNote',
      tab: {
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl || '',
      },
      note,
    });

    const fb = document.getElementById('feedback');
    fb.textContent = '已记录';
    fb.className = 'visible';
    setTimeout(() => {
      fb.className = '';
    }, 1500);
  });

  // Enter 保存
  document.getElementById('noteInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      document.getElementById('saveBtn').click();
    }
  });

  document.getElementById('portalLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({});
  });
}

function isTrackable(tab) {
  if (!tab.url) return false;
  return tab.url.startsWith('http://') || tab.url.startsWith('https://');
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    let normalized = u.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url;
  }
}
