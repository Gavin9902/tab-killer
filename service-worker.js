// ===== 配置 =====
const DISCARD_TIMEOUT_MS = 30 * 60 * 1000;
const ARCHIVE_TIMEOUT_MS = 5 * 60 * 1000;
const CHECK_INTERVAL_MINUTES = 1;
const DUPLICATE_CHECK_INTERVAL_MINUTES = 10;
const SESSION_SYNC_DEBOUNCE_MS = 2000;

// ===== 状态（内存缓存，session storage 持久化） =====
const tabActivity = new Map();
let syncTimer = null;
let activityLoaded = false;

// ===== 初始化 =====
async function init() {
  await loadActivityFromSession();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  chrome.alarms.create('tabCheck', { periodInMinutes: CHECK_INTERVAL_MINUTES });
  chrome.alarms.create('duplicateCheck', { periodInMinutes: DUPLICATE_CHECK_INTERVAL_MINUTES });
  chrome.alarms.create('firstRun', { delayInMinutes: 0 });
}

// 从 session storage 恢复或从当前标签页初始化
async function loadActivityFromSession() {
  if (activityLoaded) return;

  const data = await chrome.storage.session.get('tabActivity');
  if (data.tabActivity && Object.keys(data.tabActivity).length > 0) {
    for (const [tabId, info] of Object.entries(data.tabActivity)) {
      tabActivity.set(parseInt(tabId), info);
    }
  } else {
    // session storage 为空（浏览器刚启动或首次运行），从当前标签页初始化
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    for (const tab of tabs) {
      if (!isTrackable(tab)) continue;
      tabActivity.set(tab.id, {
        lastActive: now,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl || '',
        pinned: tab.pinned,
        audible: tab.audible || false,
        groupId: tab.groupId,
      });
    }
    await scheduleSessionSync();
  }
  activityLoaded = true;
}

// 延迟同步到 session storage（减少写入频率）
async function scheduleSessionSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const obj = {};
    for (const [id, info] of tabActivity) {
      obj[id] = info;
    }
    await chrome.storage.session.set({ tabActivity: obj });
    syncTimer = null;
  }, SESSION_SYNC_DEBOUNCE_MS);
}

// ===== 标签页事件 =====
chrome.tabs.onActivated.addListener(({ tabId }) => {
  const info = tabActivity.get(tabId);
  if (info) {
    info.lastActive = Date.now();
    scheduleSessionSync();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!changeInfo.url && !changeInfo.title && !changeInfo.hasOwnProperty('audible')
      && !changeInfo.hasOwnProperty('pinned')) {
    return;
  }

  let info = tabActivity.get(tabId);
  if (!info && isTrackable(tab)) {
    info = {
      lastActive: Date.now(),
      url: tab.url,
      title: tab.title,
      favIconUrl: tab.favIconUrl || '',
      pinned: tab.pinned,
      audible: tab.audible || false,
      groupId: tab.groupId,
    };
    tabActivity.set(tabId, info);
    scheduleSessionSync();
  } else if (info) {
    if (changeInfo.url) info.url = changeInfo.url;
    if (changeInfo.title) info.title = changeInfo.title;
    if (tab.favIconUrl) info.favIconUrl = tab.favIconUrl;
    if (changeInfo.hasOwnProperty('pinned')) info.pinned = changeInfo.pinned;
    if (changeInfo.hasOwnProperty('audible')) info.audible = changeInfo.audible;
    if (changeInfo.hasOwnProperty('groupId')) info.groupId = changeInfo.groupId;
    if (changeInfo.url) info.lastActive = Date.now();
    scheduleSessionSync();
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabActivity.delete(tabId)) {
    scheduleSessionSync();
  }
});

chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  if (tabActivity.delete(removedTabId)) {
    scheduleSessionSync();
  }
});

// ===== 定时任务 =====
chrome.alarms.onAlarm.addListener(async (alarm) => {
  // 确保 activity 数据已加载（SW 可能被重启过）
  await loadActivityFromSession();

  if (alarm.name === 'tabCheck') {
    await processInactiveTabs();
  } else if (alarm.name === 'duplicateCheck') {
    await handleDuplicateTabs();
  } else if (alarm.name === 'firstRun') {
    await handleDuplicateTabs();
  }
});

// ===== 核心逻辑：处理不活跃标签页 =====
async function processInactiveTabs() {
  const now = Date.now();
  const tabs = await chrome.tabs.query({});
  const currentTabIds = new Set(tabs.map(t => t.id));

  // 清理已被关闭的标签页记录
  let cleaned = false;
  for (const id of tabActivity.keys()) {
    if (!currentTabIds.has(id)) {
      tabActivity.delete(id);
      cleaned = true;
    }
  }
  if (cleaned) scheduleSessionSync();

  for (const tab of tabs) {
    if (!isTrackable(tab)) continue;

    let info = tabActivity.get(tab.id);
    // 如果是新标签页（之前未跟踪），记录下来
    if (!info) {
      info = {
        lastActive: now,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl || '',
        pinned: tab.pinned,
        audible: tab.audible || false,
        groupId: tab.groupId,
      };
      tabActivity.set(tab.id, info);
    }

    // 同步 pinned/audible 状态
    info.pinned = tab.pinned;
    info.audible = tab.audible || false;
    info.groupId = tab.groupId;

    const inactiveTime = now - info.lastActive;

    // 第一级：30 分钟无活跃 → discard
    if (inactiveTime >= DISCARD_TIMEOUT_MS && !isExemptFromDiscard(info)) {
      try {
        await chrome.tabs.discard(tab.id);
      } catch (e) {
        // 某些页面（如 chrome://）无法 discard，忽略
      }
    }

    // 第二级：10 小时无活跃 → 归档并关闭
    if (inactiveTime >= ARCHIVE_TIMEOUT_MS && !isExemptFromArchive(info)) {
      await archiveAndClose(tab.id, info);
    }
  }

  scheduleSessionSync();
}

// ===== 核心逻辑：检测重复标签页 =====
async function handleDuplicateTabs() {
  const tabs = await chrome.tabs.query({});
  const urlMap = new Map();

  for (const tab of tabs) {
    if (!isTrackable(tab)) continue;
    const info = tabActivity.get(tab.id);
    if (!info) continue;

    const key = normalizeUrl(tab.url);
    if (!urlMap.has(key)) {
      urlMap.set(key, []);
    }
    urlMap.get(key).push({
      tabId: tab.id,
      lastActive: info.lastActive,
      pinned: info.pinned,
      audible: info.audible,
    });
  }

  for (const [url, entries] of urlMap) {
    if (entries.length <= 1) continue;

    entries.sort((a, b) => b.lastActive - a.lastActive);

    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i];
      if (entry.pinned || entry.audible) continue;

      const watched = await getWatchedTab(url);
      if (watched && watched.note) continue;

      try {
        await chrome.tabs.remove(entry.tabId);
      } catch (e) {
        // 忽略关闭失败
      }
    }
  }
}

// ===== 归档逻辑 =====
async function archiveAndClose(tabId, info) {
  try {
    const existing = await findArchivedByUrl(info.url);
    const watched = await getWatchedTab(info.url);

    const archivedTab = {
      id: existing ? existing.id : crypto.randomUUID(),
      url: info.url,
      title: info.title,
      favIconUrl: info.favIconUrl || '',
      note: watched ? watched.note : (existing ? existing.note : ''),
      archivedAt: Date.now(),
      lastActiveAt: info.lastActive,
    };

    if (existing) {
      await updateArchivedTab(archivedTab);
    } else {
      await addArchivedTab(archivedTab);
    }

    await removeWatchedTab(info.url);
    await chrome.tabs.remove(tabId);
  } catch (e) {
    // 关闭失败不阻塞
  }
}

// ===== 存储操作 =====
async function getArchivedTabs() {
  const data = await chrome.storage.local.get('archivedTabs');
  return data.archivedTabs || [];
}

async function addArchivedTab(tab) {
  const tabs = await getArchivedTabs();
  tabs.push(tab);
  await chrome.storage.local.set({ archivedTabs: tabs });
}

async function updateArchivedTab(updated) {
  const tabs = await getArchivedTabs();
  const idx = tabs.findIndex(t => t.id === updated.id);
  if (idx >= 0) {
    tabs[idx] = updated;
  } else {
    tabs.push(updated);
  }
  await chrome.storage.local.set({ archivedTabs: tabs });
}

async function findArchivedByUrl(url) {
  const tabs = await getArchivedTabs();
  return tabs.find(t => normalizeUrl(t.url) === normalizeUrl(url)) || null;
}

async function getWatchedTabs() {
  const data = await chrome.storage.local.get('watchedTabs');
  return data.watchedTabs || [];
}

async function getWatchedTab(url) {
  const tabs = await getWatchedTabs();
  return tabs.find(t => normalizeUrl(t.url) === normalizeUrl(url)) || null;
}

async function removeWatchedTab(url) {
  const tabs = await getWatchedTabs();
  const filtered = tabs.filter(t => normalizeUrl(t.url) !== normalizeUrl(url));
  await chrome.storage.local.set({ watchedTabs: filtered });
}

// ===== 辅助函数 =====
function isTrackable(tab) {
  if (!tab.url) return false;
  return tab.url.startsWith('http://') || tab.url.startsWith('https://');
}

function isExemptFromDiscard(info) {
  return info.pinned || info.audible;
}

function isExemptFromArchive(info) {
  return info.pinned;
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

// ===== 消息处理 =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'saveNote') {
    saveWatchedTab(message.tab, message.note).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
  if (message.type === 'getCurrentTabInfo') {
    getCurrentTabInfo().then(sendResponse);
    return true;
  }
});

async function saveWatchedTab(tabInfo, note) {
  const tabs = await getWatchedTabs();
  const existing = tabs.findIndex(t => normalizeUrl(t.url) === normalizeUrl(tabInfo.url));
  const watched = {
    url: tabInfo.url,
    title: tabInfo.title,
    favIconUrl: tabInfo.favIconUrl || '',
    note: note,
    savedAt: Date.now(),
  };
  if (existing >= 0) {
    tabs[existing] = watched;
  } else {
    tabs.push(watched);
  }
  await chrome.storage.local.set({ watchedTabs: tabs });
}

async function getCurrentTabInfo() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs.length === 0) return null;
  const tab = tabs[0];
  return {
    url: tab.url,
    title: tab.title,
    favIconUrl: tab.favIconUrl || '',
  };
}

// ===== 启动 =====
init();
