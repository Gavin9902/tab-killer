[中文](README.md) · [English](README.en.md)

# Tab Killer

A Chrome extension that automatically archives inactive tabs to free memory. Search and restore them with natural language.

![](screenshot.png)

## Features

### Auto Archive
- **30 min idle** → auto discard (frees memory, tab stays in the tab bar; click to reload)
- **10 hours idle** → auto archive (saves page info, closes the tab, shows it as a card on the new tab page)
- **Duplicate detection** → scans every 10 minutes, auto-closes duplicate URLs (keeps the most recently active one)

### New Tab is Your Portal
- **Domain tile gallery** — grouped by root domain (`api.xxx.com` and `chat.xxx.com` merge into one tile); tile width adapts to domain name length
- **Hover to expand** — tile springs up 1.28x, panel slides out with the domain's page list; bottom buffer prevents accidental dismiss when moving the mouse
- **Dot indicators** — subtle gray dots at the bottom of each tile icon show page count, max 5 dots + overflow number (e.g. +3), no notification anxiety
- **Single-page shortcut** — if a domain has only one page, clicking the tile opens it directly
- **View toggle** — site mode (tile gallery) ↔ list mode (multi-column card grid)
- **Recent scroll bar** — horizontal pill-shaped scroll strip at the top shows the 12 most recently archived pages
- **AI-style search** — large input with tokenized search, keyword highlighting, and time-decay relevance scoring
- **Time filters** — All / Today / Yesterday / This Week / Older

### Delete Management
- **Page-level delete** — × button appears on card hover, deletes a single entry
- **Domain-level delete** — × button on tile top-right, appears on hover, turns red, deletes all pages under that domain

### Sidebar (click the toolbar icon)
- **Jot down purpose** — write a note for the current page, press Enter to save
- **Bidirectional sync** — edit notes on the new tab page ↔ see them instantly in the sidebar
- **Quick entry** — prominent button at the bottom to open the archive portal, shows ⌘T shortcut

### Design
- **Local first** — all data in Chrome Storage Local, nothing leaves your machine
- **Zero config** — install and forget. No settings, no notifications, no badges
- **Dark mode** — follows system preference automatically
- **Anthropic aesthetic** — warm tones, spring animations, quiet and restrained

## Install

1. Clone the repo or download the source
2. Open Chrome, go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select the project folder

## Tech Stack

Manifest V3 · Service Worker · Chrome Storage · Vanilla JS · CSS Custom Properties
