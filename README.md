# MAME Drive

A browser-based MAME arcade player. Drop in any MAME romset `.zip`, and it plays — on desktop, phone, or tablet, installable as an offline-capable PWA.

## Features

- **Library** — ROMs you add are stored locally (IndexedDB) so you don't re-upload them each session. Browse a cover-art grid, tap to play.
- **Cover art & game info** — title, manufacturer, and year are pulled automatically from the [Arcade Database](https://adb.arcadeitalia.net) using the ROM's filename as the MAME short name. Falls back gracefully to the filename if a match isn't found.
- **BIOS support** — upload shared BIOS files once (e.g. `neogeo.zip`), then pick one from the toolbar dropdown before launching a game that needs it.
- **Loading screen** — a spinner and status text cover the gap between picking a game and the core actually starting.
- **Cross-device** — built on [EmulatorJS](https://emulatorjs.org), so touch controls, gamepad support, save states, and fullscreen all work out of the box on any device.
- **Installable PWA** — add to home screen for offline play; service worker caches the app shell.

## Tech

Single self-contained `index.html` (no build step, no framework) plus a manifest, service worker, and icon for PWA install. Emulation core loaded from the EmulatorJS CDN at runtime.

| File | Purpose |
|---|---|
| `index.html` | The entire app — UI, library, BIOS manager, emulator wiring |
| `manifest.json` | PWA metadata |
| `sw.js` | Offline app-shell caching |
| `icon.svg` | App icon |
| `_headers` | Cache-control rules (Cloudflare Pages / Netlify) |

## Deploy

Push all five files to a repo and connect it to Cloudflare Pages or Netlify — no build command needed, just serve the files as-is. When you change `index.html`, bump the `CACHE` constant at the top of `sw.js` so installed copies pick up the update.

## Usage

1. Open the app and tap **+ Add ROM**, pick a MAME romset `.zip`.
2. If the game needs a BIOS (e.g. Neo Geo), tap **BIOS**, upload the BIOS zip once, then select it from the dropdown before playing.
3. Tap a library card to play. Fullscreen and save states are available from the in-game top bar / EmulatorJS menu.

**Core compatibility note:** arcade ROMs are tied to the specific MAME version they were built for. MAME Drive runs the `mame2003_plus` core — romsets built for very different MAME versions may not boot, regardless of frontend.

## Credits

- Emulation powered by [EmulatorJS](https://emulatorjs.org)
- Game metadata and artwork from [Arcade Database (adb.arcadeitalia.net)](https://adb.arcadeitalia.net)

## Legal

Only load ROMs you're legally entitled to use. MAME Drive does not host, distribute, or include any copyrighted ROM or BIOS files.
