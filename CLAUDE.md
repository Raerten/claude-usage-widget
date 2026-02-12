# CLAUDE.md

## Project Overview

Desktop widget (Electron) that displays Claude Code usage statistics. Uses session-based auth via claude.ai and the web API to fetch real-time usage data.

## Tech Stack

- **Electron 28** - Desktop framework
- **Vanilla JS** - No frontend frameworks
- **axios** - HTTP client for API calls
- **electron-store** - Local credential/config storage
- **electron-builder** - Packaging (Windows NSIS installer)

## Project Structure

```
main.js              # Electron main process: window management, auth, API calls, tray
preload.js           # IPC bridge (contextBridge), context isolation
src/renderer/
  index.html         # Widget HTML
  app.js             # Frontend logic, UI updates, countdown timers
  styles.css         # All styling (dark theme, progress bars, animations)
assets/              # Icons, logos, screenshots
```

## How It Works

### Authentication
1. Opens BrowserWindow to `https://claude.ai` for user login
2. Monitors cookies for `sessionKey`
3. Fetches all orgs from `/api/organizations`, stores full list as `{id, name}` array
4. Stores `sessionKey` + `organizations[]` + `selectedOrganizationId` via electron-store
5. On re-login, preserves existing org selection if still valid
6. Silent re-login (hidden window) on 401/403 errors using existing browser cookies

### Multi-Organization Support
- All orgs are stored on login; user can switch between them
- Org switcher dropdown in top bar (hidden if only 1 org)
- Tray menu shows radio-button org list when multiple orgs exist
- Switching orgs updates `selectedOrganizationId` in store, re-fetches usage data
- Background sync (5min auto-refresh) only runs for the selected org

### Usage Data
- Endpoint: `https://claude.ai/api/organizations/{orgId}/usage`
- Auth: `Cookie: sessionKey={key}` header
- Returns `five_hour` and `seven_day` utilization percentages + reset timestamps
- Auto-refreshes every 5 minutes

### Window
- 480x140px frameless, transparent, always-on-top widget
- Draggable with position persistence
- System tray integration (show/hide, refresh, re-login, exit)

## Commands

```bash
npm install          # Install dependencies
npm start            # Run app (dev mode with DevTools)
npm run dev          # Run with NODE_ENV=development
npm run build:win    # Build Windows installer to dist/
```

## Key Implementation Details

- All orgs stored as `organizations[]` array; selected org tracked via `selectedOrganizationId`
- electron-store encryption key is currently commented out in main.js
- Color coding: purple (0-74%), orange (75-89%), red (90-100%)
- IPC channels: `fetch-usage-data`, `login-success`, `open-login`, `get-organizations`, `set-selected-org`, `org-switched`
- Login window is 800x700, loads claude.ai directly
- Silent login has 15-second timeout before falling back to visible login

## Build Output

- App ID: `com.claudeusage.widget`
- Product: `Claude Usage Widget`
- Installer: `dist/Claude-Usage-Widget-Setup.exe`
