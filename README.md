# Claude Usage Widget

A standalone Windows desktop widget that displays your Claude.ai usage statistics in real-time.

![Claude Usage Widget](assets/claude-usage-screenshot.jpg)

## Features

- **Real-time Usage Tracking** - Session (5-hour), weekly (all models), and weekly Sonnet-only limits
- **Visual Progress Bars** - Color-coded: blue/orange default, yellow at 75%+, red at 90%+
- **Countdown Timers** - Time until each limit resets
- **Multi-Organization** - Switch between orgs via dropdown or tray menu
- **Collapsed Mode** - Single-line compact view showing session % only
- **Window Opacity** - Adjustable transparency (30-100%)
- **Log Monitor** - Built-in real-time log viewer for debugging
- **Auto-refresh** - Updates every 5 minutes; re-fetches automatically after reset
- **Always on Top** - Frameless, draggable, stays visible on all workspaces
- **System Tray** - Minimizes to tray with full context menu

## Installation

### Download Pre-built Release

1. Download `Claude-Usage-Widget-Setup.exe` from [Releases](https://github.com/raerten/claude-usage-widget/releases)
2. Run the installer
3. Launch "Claude Usage Widget" from Start Menu

### Build from Source

**Prerequisites:** Node.js 18+, Yarn 4

```bash
git clone https://github.com/raerten/claude-usage-widget.git
cd claude-usage-widget
yarn install
yarn start
```

Build Windows installer:
```bash
yarn build:win
```

Output: `dist/Claude-Usage-Widget-Setup.exe`

## Usage

1. Launch the widget
2. Click "Login to Claude" - a browser window opens to claude.ai
3. Log in with your credentials - the widget captures the session automatically
4. Usage data appears immediately

### Controls

- **Drag** anywhere on the title bar to move
- **Refresh** button to update data now
- **Collapse/Expand** click the drag handle or collapsed bar
- **Opacity slider** in the top bar (30-100%)
- **Org switcher** dropdown when multiple organizations exist
- **Log button** opens the log monitoring window
- **Minimize** to system tray (minus icon)
- **Close** to system tray (X icon)

### System Tray

Right-click the tray icon: Show Widget, Refresh, Show Logs, switch Org, Re-login, Log Out, Exit.
Left-click toggles widget visibility.

## System Requirements

- Windows 10+ (64-bit)
- Internet connection (for Claude.ai API)

## Privacy

- Credentials stored locally with per-install encryption key
- No telemetry - communicates only with claude.ai
- Open source - code available for review

## Tech Stack

- Electron 41 (beta), Vanilla JS, axios, electron-store, electron-builder
- Package manager: Yarn 4.12.0

## License

MIT

## Disclaimer

Unofficial tool, not affiliated with or endorsed by Anthropic. Use at your own discretion.
