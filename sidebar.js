document.addEventListener('DOMContentLoaded', init);

let currentTab = null;

async function init() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tabs[0];

  if (!currentTab || !isTrackable(currentTab)) {
    document.getElementById('title').textContent = '此页面无法记录（系统页面）';
    document.getElementById('noteInput').disabled = true;
    document.getElementById('saveBtn').disabled = true;
    return;
  }

  document.getElementById('favicon').src = currentTab.favIconUrl || '';
  document.getElementById('title').textContent = currentTab.title || currentTab.url;

  await loadExistingNote();

  document.getElementById('saveBtn').addEventListener('click', doSave);

  document.getElementById('noteInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      doSave();
    }
  });

  document.getElementById('portalLink').addEventListener('click', () => {
    chrome.tabs.create({ active: true });
  });

  // 监听归档变化，同步笔记
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.archivedTabs || changes.watchedTabs) {
      loadExistingNote();
    }
  });
}

async function loadExistingNote() {
  if (!currentTab) return;
  const norm = normalizeUrl(currentTab.url);

  // 先查 watchedTabs
  const wData = await chrome.storage.local.get('watchedTabs');
  const watched = (wData.watchedTabs || []).find(t => normalizeUrl(t.url) === norm);
  if (watched && watched.note) {
    document.getElementById('noteInput').value = watched.note;
    return;
  }

  // 再查 archivedTabs
  const aData = await chrome.storage.local.get('archivedTabs');
  const archived = (aData.archivedTabs || []).find(t => normalizeUrl(t.url) === norm);
  if (archived && archived.note) {
    document.getElementById('noteInput').value = archived.note;
    return;
  }

  document.getElementById('noteInput').value = '';
}

async function doSave() {
  const note = document.getElementById('noteInput').value.trim();
  await chrome.runtime.sendMessage({
    type: 'saveNote',
    tab: {
      url: currentTab.url,
      title: currentTab.title,
      favIconUrl: currentTab.favIconUrl || '',
    },
    note,
  });

  const fb = document.getElementById('feedback');
  fb.textContent = '已记录';
  fb.className = 'visible';
  setTimeout(() => { fb.className = ''; }, 1500);
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
