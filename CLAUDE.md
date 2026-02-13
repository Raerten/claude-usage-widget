# CLAUDE.md

## Project Overview

Desktop widget (Electron) that displays Claude.ai usage statistics. Uses session-based auth via claude.ai cookies and the web API to fetch real-time usage data. Shows session (5-hour), weekly (7-day all models), and weekly Sonnet-only utilization with countdown timers.

## Tech Stack

- **Electron 41** (beta) - Desktop framework
- **Vanilla JS** - No frontend frameworks
- **axios** - HTTP client for API calls
- **electron-store** - Local credential/config storage (encrypted with per-install random key)
- **electron-builder** - Packaging (Windows NSIS installer)
- **yarn 4.12.0** - Package manager

## Project Structure

```
main.js                  # App entry: single-instance lock, app lifecycle, tray handler wiring
preload.js               # IPC bridge (contextBridge), exposes electronAPI to renderer
preload-logs.js          # IPC bridge for log window, exposes logsAPI
src/main/
  constants.js           # URLs, dimensions, polling intervals
  store.js               # electron-store wrapper (credentials, orgs, window pos, opacity, collapsed state, autostart, API cookies)
  window.js              # Main BrowserWindow creation, position persistence, opacity
  logManager.js          # Console interceptor, circular buffer (1000), broadcasts to log window
  logWindow.js           # Log window factory (singleton, 700x500, frameless, resizable, always-on-top)
  auth.js                # Login (visible + silent), cookie polling, org fetching
  api.js                 # Usage API call with session cookie auth
  ipc.js                 # All ipcMain handlers (credentials, window, orgs, usage, opacity)
  tray.js                # System tray icon, context menu with org radio buttons + autostart checkbox
src/renderer/
  index.html             # Widget HTML (states: loading, login, no-usage, auto-login, main, collapsed)
  app.js                 # Frontend logic: UI state machine, countdown timers, manual drag, org switcher
  styles.css             # Dark theme (VS Code-inspired), progress bars, animations
  logs.html              # Log viewer HTML (titlebar, filter controls, search, log list)
  logs.js                # Log viewer logic (filtering, search, auto-scroll, real-time append)
  logs.css               # Log viewer styles (VS Code dark theme, monospace, color-coded levels)
assets/                  # icon.ico, tray-icon.png
```

## How It Works

### Authentication (src/main/auth.js)
1. Opens BrowserWindow to `https://claude.ai` for user login (800x700)
2. Polls cookies every 2s (visible) or 1s (silent) for `sessionKey`
3. On cookie found, fetches orgs from `/api/organizations` with sessionKey header
4. Maps orgs to `{id: uuid, name}` array, stores via electron-store
5. Preserves existing org selection if still valid on re-login
6. On 401/403: attempts silent re-login (hidden window, 15s timeout), falls back to visible login

### Multi-Organization Support
- All orgs stored on login; user can switch via dropdown (top bar) or tray radio buttons
- Org dropdown hidden when only 1 org; chevron hidden, cursor set to default
- Switching orgs: updates store, refreshes tray menu, sends `org-switched` IPC to renderer
- Renderer stops auto-update, clears cached data, re-fetches for new org, restarts timer

### Usage Data (src/main/api.js)
- Endpoint: `https://claude.ai/api/organizations/{orgId}/usage`
- Auth: `Cookie: sessionKey={key}` + stored server cookies (e.g. `cf_clearance`) + custom User-Agent
- Server `set-cookie` headers are captured from all responses (incl. errors) and persisted via electron-store
- Cookie helpers (`buildCookieHeader`, `storeResponseCookies`) shared between `api.js` and `auth.js`
- All stored API cookies are cleared on logout via `deleteCredentials()`
- Response fields used: `five_hour`, `seven_day`, `seven_day_sonnet` (each has `utilization` + `resets_at`)
- `seven_day_sonnet` row shown only when data exists (utilization > 0 or resets_at present)
- Auto-refreshes every 5 minutes; auto re-fetches 3s after a reset timer expires

### Window (src/main/window.js)
- 340px wide, frameless, no shadow, always-on-top ("floating" level), visible on all workspaces
- **Not transparent** (`transparent: false`); background is `#252526`
- Skips taskbar (`skipTaskbar: true`)
- Height auto-adjusts to content via `resize-to-content` IPC (double-rAF for accurate measurement)
- Manual drag implementation (replaces `-webkit-app-region: drag` so clicks work); 4px drag threshold
- Position persisted to electron-store on every `move` event
- Window opacity controlled via slider (30-100%), saved to store, applied via `setOpacity()`
- Single instance enforced via `requestSingleInstanceLock()`

### UI States (src/renderer/app.js)
Six mutually exclusive states managed by show* functions:
1. **Loading** - spinner on initial load
2. **Login Required** - login icon + button
3. **No Usage** - "Start chatting with Claude" message (when all utilizations are 0 with no reset times)
4. **Auto Login** - spinner + "Trying to auto-login..." during silent re-login
5. **Main Content** - session/weekly/sonnet progress bars with reset countdowns
6. **Collapsed** - single-line bar showing session % + reset time (click header/bar to toggle)

### Log Monitoring (src/main/logManager.js + logWindow.js)
- `initLogManager()` wraps console.log/warn/error in main process; original output preserved
- Circular buffer (1000 entries): `{ id, timestamp, level, message }`
- Broadcasts new entries to log window via `webContents.send('new-log-entry', entry)`
- Log window: singleton, 700x500, frameless, resizable, always-on-top, position persisted
- Separate preload (`preload-logs.js`) exposes `logsAPI` (not mixed into main `electronAPI`)
- Access: widget top-bar log button + tray "Show Logs" menu item
- In-memory only; cleared on app restart

### Autostart (main.js + tray.js)
- Tray checkbox "Launch on Startup" toggles `app.setLoginItemSettings({ openAtLogin })` (Windows Registry)
- Stored as `autostart` (boolean, default false) via electron-store
- Applied on app ready; toggled via tray menu `onToggleAutostart` handler

### Collapsed Mode
- Click drag handle or collapsed bar to toggle (ignores interactive elements)
- Shows session (five_hour) percentage only, with compact reset countdown
- Window resized to 39px height; border removed
- Has its own refresh button
- Collapsed/expanded preference persisted to store (`widgetCollapsed`); restored on app restart and re-login
- Non-authenticated states (login, auto-login) force full view without overwriting the saved preference

## Commands

```bash
yarn install             # Install dependencies
yarn start               # Run app (opens DevTools in dev mode)
yarn dev                 # Run with NODE_ENV=development (cross-env)
yarn build:win           # Build Windows installer to dist/
```

## Key Implementation Details

### IPC Channels
**invoke (request/response):**
- `get-credentials`, `save-credentials`, `delete-credentials`
- `get-window-position`, `set-window-position`
- `get-opacity`, `save-opacity`
- `get-collapsed`, `save-collapsed`
- `get-autostart`, `save-autostart`
- `get-organizations`, `set-selected-org`
- `fetch-usage-data`
- `get-buffered-logs`, `clear-logs`

**send (one-way to main):**
- `open-login`, `minimize-window`, `close-window`, `resize-to-content`, `open-external`, `open-log-window`, `close-log-window`

**send (one-way to renderer):**
- `login-success`, `refresh-usage`, `session-expired`, `silent-login-started`, `silent-login-failed`, `logout`, `org-switched`

### Progress Bar Colors
- Default: blue `#569cd6` (session/sonnet), muted orange `#ce9178` (weekly)
- Warning (75-89%): yellow `#cca700`
- Danger (90-100%): red `#f14c4c`

### Reset Timer Format
- `Resets {time} · {date} ({timezone})` where time = `Xd Xh` / `Xh Xm` / `Xm`
- When expired: shows "Resetting..." and auto-fetches after 3s delay

### Tray Menu
- Show Widget / Refresh / Show Logs / Launch on Startup (checkbox) / [Org radio list if >1] / Re-login / Log Out / Exit
- Left-click tray icon toggles window visibility

## Development Notes

- `index.html` default visibility: `loadingContainer` is visible, all others have `display: none`. Any new UI state function must explicitly hide it.
- `showCollapsed()` is the canonical way to enter collapsed mode (hides all state containers); `toggleCollapse()` and init/login-success both use it
- `auth.js` imports from `api.js` (cookie helpers); reverse import would create circular dependency
- Quick module syntax check: `node -e "require('./src/main/store'); require('./src/main/api');"` (works for non-Electron modules)
- Adding a secondary window: create `src/main/<name>Window.js` (singleton pattern), separate `preload-<name>.js`, renderer files in `src/renderer/`, wire IPC in `ipc.js`, add tray handler in `tray.js` + `main.js`
- New tray handlers require adding to both `buildContextMenu()` in `tray.js` AND the handler object in `main.js`'s `createTray()` call

## Build Output

- App ID: `dev.raerten.app.claude-usage-widget`
- Product: `Claude Usage Widget`
- Installer: `dist/Claude-Usage-Widget-Setup.exe` (NSIS, allows custom install dir)
