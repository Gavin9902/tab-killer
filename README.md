# Tab Killer

自动归档不活跃标签页，释放浏览器内存。用自然语言搜索找回你需要的页面。

A Chrome extension that automatically archives inactive tabs to free memory. Search and restore them with natural language.

---

## 中文

### 它做什么

- **30 分钟无活跃** → 自动 discard（释放该标签页占用的内存，标签页保留在标签栏，点击重新加载）
- **10 小时无活跃** → 自动归档（保存页面信息后关闭标签页，在新标签页中以卡片形式展示）
- **重复标签页检测** → 每 10 分钟检查一次，自动关闭重复的标签页（保留最近活跃的那个）
- **新标签页即传送门** → 打开新标签页，搜索任意关键词即可找回被归档的页面。支持中文分词、拼音模糊匹配、时间筛选
- **记录页面目的** → 点击工具栏图标，给当前页面写一句话备注（"这个留着，周末要看"），归档后备注会显示在卡片上，方便回忆

### 安装

1. 克隆仓库或下载源码
2. 打开 Chrome，进入 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择项目目录

### 设计理念

- **零配置**：装好即用，没有任何设置项
- **不打扰**：没有通知弹窗，没有 badges，只在后台默默工作
- **本地优先**：所有数据存储在 Chrome Storage Local，不上传任何信息
- **搜索优先**：新标签页就是搜索引擎，你不需要记住 URL，描述印象即可

### 技术栈

Manifest V3 · Service Worker · Chrome Storage · Vanilla JS

---

## English

### What It Does

- **30 min idle** → auto discard (frees the tab's memory while keeping it in the tab bar; click to reload)
- **10 hours idle** → auto archive (saves page info, closes the tab, shows it as a card on the new tab page)
- **Duplicate detection** → checks every 10 minutes, auto-closes duplicate tabs (keeps the most recently active one)
- **New tab is your portal** → open a new tab, search with any keywords to find archived pages. Supports tokenized search with relevance scoring and time-based filters
- **Note-taking** → click the toolbar icon to jot down why you kept a page ("read this weekend"). Notes appear on archive cards

### Install

1. Clone the repo or download the source
2. Open Chrome, go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

### Philosophy

- **Zero config** — install and forget
- **No interruptions** — no notifications, no badges, just silent background work
- **Local first** — all data in Chrome Storage Local, nothing leaves your machine
- **Search-first** — the new tab page is your search engine. Describe what you remember, don't memorize URLs

### Tech Stack

Manifest V3 · Service Worker · Chrome Storage · Vanilla JS
