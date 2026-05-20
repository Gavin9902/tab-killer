[中文](README.md) · [English](README.en.md)

# Tab Killer 🪓

> Tabs stay out of your way, but never out of reach.

Tabs multiply. Memory vanishes. Your browser crawls. **Tab Killer auto-freezes idle tabs so your machine can breathe again.**

*"I swear I had that page open somewhere…"* — Just describe it in your own words; Tab Killer finds it instantly.

No manual cleanup. No folders. No thinking. Install and forget.

![Tile gallery: site cards grouped by domain, with search bar on top](screenshots/tile-gallery.png)

## ✨ What It Does

| | |
|---|---|
| 🔄 **Auto-Freeze** | Idle tabs get discarded; memory freed. One click to reload. |
| 📦 **Auto-Archive** | Tabs idle too long get saved and closed. Thresholds adjustable. |
| 🔍 **Search Like You Talk** | Describe the page in plain words. Tokenized search with keyword highlighting and time-decay ranking finds it fast. |
| 🗂 **Smart Grouping** | `api.x.com` and `chat.x.com` merge into one domain tile. Width auto-adapts. Zero manual folders. |
| 🎯 **Dupe Killer** | Duplicate URLs auto-close every 10 minutes. The most recently active one survives. |
| 📝 **Jot Notes** | Sidebar for capturing "why is this tab open?" Bidirectionally synced to the new tab page. |
| 🌙 **Dark Mode** | Follows system preference. Warm Anthropic color palette. |
| 🔒 **100% Local** | Everything in Chrome Storage Local. Nothing leaves your machine. |

## 📸 Screenshots

**Hover to expand** — spring-scale 1.28x, panel reveals all pages under that domain:

![Hover to reveal domain detail panel](screenshots/hover-panel.png)

**List view** — toggle to multi-column card grid with time filters:

![List view: multi-column card grid with time filters](screenshots/list-view.png)

**Keyword search** — type whatever you remember; tokenized matching + highlighting + time-decay ranking finds closed pages instantly:

![Keyword search: type "api" to find archived pages](screenshots/screenshot-20260520-081227.png)

**Settings** — click the gear icon, adjust timeouts, takes effect immediately:

![Settings panel: customize discard and archive timeouts](screenshots/settings-panel.png)

## ⚡ Install

1. Clone or download the source
2. Chrome → `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. "Load unpacked" → select the project folder

## 🔒 Permissions

<details>
<summary>What permissions does it need, and why?</summary>

| Permission | Why |
|------------|-----|
| `tabs` | Read tab state to detect idle ones |
| `storage` | Store archive data + settings locally |
| `alarms` | Periodic checks for inactive tabs |
| `sidePanel` | Toolbar icon opens the sidebar |

All data lives on your machine. Nothing is sent anywhere.

</details>

## ❓ FAQ

<details>
<summary>Where do archived tabs go?</summary>
Open a new tab (⌘T). Every archived page shows up as a card. Search or click to restore.
</details>

<details>
<summary>How do I change the freeze / archive timing?</summary>
Gear icon ⚙ (top-right of new tab) → Settings panel → enter minutes. Takes effect instantly.
</details>

<details>
<summary>Can it close the tab I'm currently using?</summary>
No. The active tab is always skipped during auto-cleanup.
</details>

<details>
<summary>What if I don't want a specific page archived?</summary>
Jot a note for it in the Sidebar, or pin it in Chrome. Tabs playing audio or in picture-in-picture mode are also excluded.
</details>

## 🛠 Tech Stack

Manifest V3 · Service Worker · Chrome Storage · Vanilla JS · CSS Custom Properties
