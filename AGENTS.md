# AGENTS.md

## Project intent
Shaolin Clarity is a personal, local-only browser extension that pauses visits to distracting sites and shows a mindful reminder. There is no distribution or store publishing planned at this time.

## Local-only usage
Load as an unpacked extension in Chromium-based browsers (Brave/Chrome). This repo is the source of truth; no build step required.

## Architecture and tech choices
- Manifest V3 extension using plain HTML/CSS/JS.
- Uses `chrome.declarativeNetRequest` (DNR) rules for blocking/redirecting when available.
- Includes a Brave-safe fallback that uses `chrome.webNavigation` to redirect to the local interstitial if DNR rules are not applied (detected when dynamic rules count stays at 0).
- Options page writes the blocked domain list to `chrome.storage.local` and updates DNR dynamic rules.
- Reminder page (`blocked.html`) reads the original URL from a query param when using fallback, or from DNR feedback when available.

## Key files
- `manifest.json`: permissions, background service worker, options, web-accessible blocked page
- `background.js`: DNR rule feedback tracking + fallback redirect + temporary allowlist
- `options.html` / `options.js`: manage blocked domains + rules
- `blocked.html` / `blocked.js`: mindful reminder and "continue" logic

## Notes
- There is a known Brave behavior where DNR dynamic rules may not apply; fallback exists for this.
- "Continue for 5 minutes" uses a temporary allowlist in memory and storage.
