// ===== 常量 =====
const DEBOUNCE_MS = 250;

// ===== DOM 元素 =====
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearSearch');
const cardGrid = document.getElementById('cardGrid');
const noResults = document.getElementById('noResults');
const emptyState = document.getElementById('emptyState');
const googleLink = document.getElementById('googleLink');
const tabCount = document.getElementById('tabCount');
const filterBtns = document.querySelectorAll('.filter-btn');
const viewBtns = document.querySelectorAll('.view-btn');
const recentScroll = document.getElementById('recentScroll');
const recentTrack = document.getElementById('recentTrack');

// ===== 状态 =====
let archivedTabs = [];
let searchQuery = '';
let timeFilter = 'all';
let viewMode = 'tile';
let debounceTimer = null;

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupEventListeners();
  await loadArchivedTabs();
  render();
}

function setupEventListeners() {
  searchInput.addEventListener('input', onSearchInput);
  clearBtn.addEventListener('click', onClearSearch);

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timeFilter = btn.dataset.filter;
      render();
    });
  });

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewMode = btn.dataset.view;
      render();
    });
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.archivedTabs) {
      archivedTabs = (changes.archivedTabs.newValue || []).sort((a, b) => b.archivedAt - a.archivedAt);
      render();
    }
  });
}

// ===== 数据加载 =====
async function loadArchivedTabs() {
  const data = await chrome.storage.local.get('archivedTabs');
  archivedTabs = (data.archivedTabs || []).sort((a, b) => b.archivedAt - a.archivedAt);
  updateTabCount();
}

async function saveArchivedTabs() {
  await chrome.storage.local.set({ archivedTabs });
  updateTabCount();
}

async function deleteArchivedTab(id) {
  archivedTabs = archivedTabs.filter(t => t.id !== id);
  await saveArchivedTabs();
  render();
}

async function deleteArchivedTabsByDomain(domain) {
  archivedTabs = archivedTabs.filter(t => getRootDomain(t.url) !== domain);
  await saveArchivedTabs();
  render();
}

// ===== 搜索 =====
function onSearchInput() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    clearBtn.classList.toggle('hidden', !searchQuery);
    render();
  }, DEBOUNCE_MS);
}

function onClearSearch() {
  searchInput.value = '';
  searchQuery = '';
  clearBtn.classList.add('hidden');
  render();
  searchInput.focus();
}

// 增强关键词搜索（带评分排序）
function search(tabs) {
  if (!searchQuery) return tabs;

  const tokens = tokenize(searchQuery);
  if (tokens.length === 0) return tabs;

  const scored = tabs.map(tab => {
    const fields = {
      title: (tab.title || '').toLowerCase(),
      note: (tab.note || '').toLowerCase(),
      domain: extractDomain(tab.url).toLowerCase(),
      urlPath: extractPath(tab.url).toLowerCase(),
    };

    let score = 0;
    for (const token of tokens) {
      // 标题匹配权重最高
      const titleCount = countMatches(fields.title, token);
      score += titleCount * 10;

      // 笔记匹配次之
      const noteCount = countMatches(fields.note, token);
      score += noteCount * 8;

      // 域名匹配
      if (fields.domain.includes(token)) {
        score += 5;
      }

      // URL 路径匹配（权重最低）
      const pathCount = countMatches(fields.urlPath, token);
      score += pathCount * 2;

      // 完全匹配 bonus
      if (fields.title === token || fields.note === token) {
        score += 20;
      }
    }

    // 时间衰减：越新的 tab 分数微调（同分时优先生效）
    const daysSinceArchive = (Date.now() - tab.archivedAt) / (24 * 60 * 60 * 1000);
    const recencyBoost = Math.max(0, 1 - daysSinceArchive / 365); // 一年内有效

    return { tab, score: score + recencyBoost * 0.5 };
  });

  // 过滤零分并排序
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.tab);
}

// ===== 渲染 =====
function render() {
  let results;

  if (archivedTabs.length === 0) {
    showEmptyState();
    return;
  }

  if (searchQuery) {
    results = search(archivedTabs);
    results = applyTimeFilter(results);
  } else {
    results = applyTimeFilter(archivedTabs);
  }

  if (searchQuery && results.length === 0) {
    showNoResults();
    return;
  }

  hideStates();
  updateTabCount(results);

  if (searchQuery) {
    renderCards(results);
    recentScroll.classList.add('hidden');
    return;
  }

  // No search: show recent scroll + chosen view
  renderRecentScroll(results);

  if (viewMode === 'tile') {
    renderGrouped(results);
  } else {
    renderListView(results);
  }

  setupNoteEditing();
}

function renderRecentScroll(tabs) {
  const recent = tabs.slice(0, 12);
  if (recent.length === 0) {
    recentScroll.classList.add('hidden');
    return;
  }
  recentScroll.classList.remove('hidden');
  recentTrack.innerHTML = recent.map(tab => {
    const domain = extractDomain(tab.url);
    const faviconHtml = tab.favIconUrl
      ? `<img src="${escapeAttr(tab.favIconUrl)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'mini-fallback\\'>${escapeHtml(domain.charAt(0).toUpperCase())}</span>'" />`
      : `<span class="mini-fallback">${escapeHtml(domain.charAt(0).toUpperCase())}</span>`;
    return `
      <button class="recent-item" data-url="${escapeAttr(tab.url)}">
        <div class="recent-favicon">${faviconHtml}</div>
        <span class="recent-title">${escapeHtml(tab.title)}</span>
        <span class="recent-time">${formatRelativeTime(tab.archivedAt)}</span>
      </button>`;
  }).join('');

  recentTrack.querySelectorAll('.recent-item').forEach(btn => {
    btn.addEventListener('click', () => restoreTab(btn.dataset.url));
  });
}

function renderListView(tabs) {
  cardGrid.className = '';
  renderCards(tabs);
}

function getRootDomain(url) {
  try {
    let hostname = new URL(url).hostname.replace(/^www\./, '');
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts.slice(1).join('.');
    }
    return hostname;
  } catch {
    return url;
  }
}

function groupByDomain(tabs) {
  const groups = new Map();
  for (const tab of tabs) {
    const domain = getRootDomain(tab.url);
    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain).push(tab);
  }
  // 按每组最新归档时间排序
  const sorted = [...groups.entries()].sort((a, b) => {
    const aNewest = Math.max(...a[1].map(t => t.archivedAt));
    const bNewest = Math.max(...b[1].map(t => t.archivedAt));
    return bNewest - aNewest;
  });
  // 每组内部按归档时间倒序
  for (const [, tabs] of sorted) {
    tabs.sort((a, b) => b.archivedAt - a.archivedAt);
  }
  return sorted;
}

function sphereSize(count, domain) {
  const base = count >= 10 ? 130 : count >= 6 ? 114 : count >= 3 ? 100 : 90;
  const chars = domain.length;
  if (chars <= 12) return base;
  return Math.min(base + (chars - 12) * 5, 200);
}

function renderGrouped(tabs) {
  const groups = groupByDomain(tabs);
  cardGrid.className = 'grouped';

  cardGrid.innerHTML = groups.map(([domain, domainTabs]) => {
    const size = sphereSize(domainTabs.length, domain);
    const singleUrl = domainTabs.length === 1 ? escapeAttr(domainTabs[0].url) : '';
    const faviconHtml = domainTabs[0].favIconUrl
      ? `<img src="${escapeAttr(domainTabs[0].favIconUrl)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'sphere-fallback\\'>${escapeHtml(domain.charAt(0).toUpperCase())}</span>'" />`
      : `<span class="sphere-fallback">${escapeHtml(domain.charAt(0).toUpperCase())}</span>`;

    const dotCount = Math.min(domainTabs.length, 5);
    const dotsHtml = Array.from({ length: dotCount }, () => '<span class="sphere-dot"></span>').join('');
    const overflow = domainTabs.length > 5 ? `<span class="sphere-overflow">+${domainTabs.length - 5}</span>` : '';

    const cardsHtml = domainTabs.map(tab => `
        <div class="panel-card" data-url="${escapeAttr(tab.url)}" data-id="${escapeAttr(tab.id)}">
          <span class="panel-card-title" title="${escapeAttr(tab.title)}">${escapeHtml(tab.title)}</span>
          <span class="panel-card-time">${formatRelativeTime(tab.archivedAt)}</span>
          <button class="panel-card-delete" data-id="${escapeAttr(tab.id)}" title="删除">×</button>
        </div>`).join('');

    const singleClass = domainTabs.length === 1 ? ' is-single' : '';

    return `
      <div class="domain-sphere${singleClass}" style="--sphere-size: ${size}px" data-domain="${escapeAttr(domain)}" data-single-url="${singleUrl}">
        <div class="sphere-face">
          <button class="sphere-delete" data-domain="${escapeAttr(domain)}" title="删除此站点所有归档">×</button>
          <div class="sphere-dots">${dotsHtml}${overflow}</div>
          <div class="sphere-icon">${faviconHtml}</div>
          <span class="sphere-domain">${escapeHtml(domain)}</span>
        </div>
        <div class="sphere-panel">
          <div class="panel-header">
            <div class="panel-favicon">${faviconHtml}</div>
            <span class="panel-domain">${escapeHtml(domain)}</span>
            <span class="panel-count">${domainTabs.length} 个页面</span>
          </div>
          <div class="panel-cards">${cardsHtml}</div>
        </div>
      </div>`;
  }).join('');

  // 单 tab 域名：点击直接打开
  cardGrid.querySelectorAll('.domain-sphere.is-single .sphere-face').forEach(face => {
    face.addEventListener('click', (e) => {
      e.stopPropagation();
      const sphere = face.closest('.domain-sphere');
      restoreTab(sphere.dataset.singleUrl);
    });
  });

  // 面板行点击恢复
  cardGrid.querySelectorAll('.panel-card').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.panel-card-delete')) return;
      restoreTab(row.dataset.url);
    });
  });

  // 页面级删除
  cardGrid.querySelectorAll('.panel-card-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteArchivedTab(btn.dataset.id);
    });
  });

  // 域名级删除
  cardGrid.querySelectorAll('.sphere-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteArchivedTabsByDomain(btn.dataset.domain);
    });
  });
}

function renderCards(tabs) {
  cardGrid.innerHTML = tabs.map(tab => {
    const domain = extractDomain(tab.url);
    const faviconHtml = tab.favIconUrl
      ? `<img src="${escapeAttr(tab.favIconUrl)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'fallback\\'>${escapeHtml(domain.charAt(0).toUpperCase())}</span>'" />`
      : `<span class="fallback">${escapeHtml(domain.charAt(0).toUpperCase())}</span>`;

    // 高亮匹配关键词
    let titleHtml = escapeHtml(tab.title);
    let noteHtml = escapeHtml(tab.note || '');
    if (searchQuery) {
      titleHtml = highlightMatches(titleHtml, searchQuery);
      noteHtml = highlightMatches(noteHtml, searchQuery);
    }

    return `
      <div class="card" data-id="${escapeAttr(tab.id)}" data-url="${escapeAttr(tab.url)}">
        <button class="card-delete" data-id="${escapeAttr(tab.id)}" title="删除">×</button>
        <div class="card-favicon">${faviconHtml}</div>
        <div class="card-title" title="${escapeAttr(tab.title)}">${titleHtml}</div>
        <div class="card-note" contenteditable="false" data-tab-id="${escapeAttr(tab.id)}">${noteHtml}</div>
        <div class="card-meta">
          <span class="card-time">${formatRelativeTime(tab.archivedAt)}</span>
          <span class="card-domain">${escapeHtml(domain)}</span>
        </div>
      </div>`;
  }).join('');

  // 卡片点击恢复
  cardGrid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-note') || e.target.closest('.card-delete')) return;
      restoreTab(card.dataset.url);
    });
  });

  // 页面卡片删除
  cardGrid.querySelectorAll('.card-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteArchivedTab(btn.dataset.id);
    });
  });
}

function setupNoteEditing() {
  cardGrid.querySelectorAll('.card-note').forEach(noteEl => {
    noteEl.addEventListener('click', (e) => {
      e.stopPropagation();
      if (noteEl.contentEditable === 'true') return;
      enterEditMode(noteEl);
    });
  });
}

function enterEditMode(noteEl) {
  // 保存原始纯文本（去掉高亮标签）
  const tabId = noteEl.dataset.tabId;
  const tab = archivedTabs.find(t => t.id === tabId);
  const originalNote = tab ? (tab.note || '') : '';

  noteEl.contentEditable = 'true';
  noteEl.classList.add('editing');
  noteEl.textContent = originalNote;
  noteEl.focus();

  const range = document.createRange();
  range.selectNodeContents(noteEl);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const save = async () => {
    noteEl.contentEditable = 'false';
    noteEl.classList.remove('editing');
    const newNote = noteEl.textContent.trim();
    if (tab && tab.note !== newNote) {
      tab.note = newNote;
      await saveArchivedTabs();
    }
    // 重新渲染以恢复高亮
    render();
  };

  const onBlur = () => { save(); cleanup(); };
  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      noteEl.textContent = originalNote;
      save();
      cleanup();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      save();
      cleanup();
    }
  };

  const cleanup = () => {
    noteEl.removeEventListener('blur', onBlur);
    noteEl.removeEventListener('keydown', onKeydown);
  };

  noteEl.addEventListener('blur', onBlur);
  noteEl.addEventListener('keydown', onKeydown);
}

async function restoreTab(url) {
  await chrome.tabs.create({ url, active: true });
}

// ===== 时间筛选 =====
function applyTimeFilter(tabs) {
  if (timeFilter === 'all') return tabs;
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  if (timeFilter === 'today') {
    return tabs.filter(t => t.archivedAt >= now - day);
  }
  if (timeFilter === 'yesterday') {
    return tabs.filter(t => t.archivedAt >= now - 2 * day && t.archivedAt < now - day);
  }
  if (timeFilter === 'week') {
    return tabs.filter(t => t.archivedAt >= now - 7 * day && t.archivedAt < now - 2 * day);
  }
  if (timeFilter === 'older') {
    return tabs.filter(t => t.archivedAt < now - 7 * day);
  }
  return tabs;
}

// ===== 状态显示 =====
function showEmptyState() {
  cardGrid.innerHTML = '';
  cardGrid.classList.add('hidden');
  noResults.classList.add('hidden');
  emptyState.classList.remove('hidden');
}

function showNoResults() {
  cardGrid.innerHTML = '';
  cardGrid.classList.add('hidden');
  emptyState.classList.add('hidden');
  noResults.classList.remove('hidden');
  const query = encodeURIComponent(searchQuery);
  googleLink.href = `https://www.google.com/search?q=${query}`;
}

function hideStates() {
  cardGrid.classList.remove('hidden');
  emptyState.classList.add('hidden');
  noResults.classList.add('hidden');
}

function updateTabCount(tabs) {
  const count = tabs ? tabs.length : archivedTabs.length;
  tabCount.textContent = count > 0 ? `${count} 个页面` : '';
}

// ===== 搜索工具函数 =====
function tokenize(text) {
  const lower = text.toLowerCase().trim();
  if (!lower) return [];

  const tokens = new Set();

  // 英文单词
  const words = lower.split(/[^a-z0-9一-鿿]+/).filter(w => w.length >= 1);
  words.forEach(w => tokens.add(w));

  // 中文 bigram（2-gram）
  const cjkChars = lower.match(/[一-鿿]+/g);
  if (cjkChars) {
    for (const segment of cjkChars) {
      // 将连续中文拆成 bigram
      for (let i = 0; i < segment.length - 1; i++) {
        tokens.add(segment.substring(i, i + 2));
      }
      // 也保留单个汉字
      for (const c of segment) {
        tokens.add(c);
      }
    }
  }

  // 保留原始输入的整体作为 token（精确短语匹配）
  tokens.add(lower);

  return [...tokens];
}

function countMatches(text, token) {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(token, pos)) !== -1) {
    count++;
    pos += token.length;
  }
  return count;
}

function highlightMatches(text, query) {
  if (!query) return text;
  const tokens = tokenize(query).filter(t => t.length >= 1 && t !== query.toLowerCase());
  // 使用原始 query 进行整词匹配
  const patterns = [query.toLowerCase(), ...tokens];
  // 去重并按长度降序（长匹配优先）
  const unique = [...new Set(patterns)].sort((a, b) => b.length - a.length);

  let result = text;
  for (const pattern of unique) {
    if (pattern.length < 1) continue;
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  }

  // 防止嵌套 mark 标签
  result = result.replace(/<mark>/g, '\x00').replace(/<\/mark>/g, '\x01');
  // 移除非打印字符之间的嵌套
  let cleaned = result;
  // 简化处理：把所有 \x00 和 \x01 替换回标签
  cleaned = cleaned.replace(/\x00/g, '<mark>').replace(/\x01/g, '</mark>');
  return cleaned;
}

// ===== 通用工具函数 =====
function formatRelativeTime(timestamp) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function extractPath(url) {
  try {
    const pathname = new URL(url).pathname;
    return pathname.replace(/[^a-zA-Z0-9一-鿿]/g, ' ');
  } catch {
    return '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
