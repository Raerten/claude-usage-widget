import { BrowserWindow, app } from 'electron';
import { join } from 'path';
import { LOG_WINDOW_WIDTH, LOG_WINDOW_HEIGHT } from './constants';
import * as store from './store';
import { setLogWindow, removeLogWindow } from './logManager';

let logWindow: BrowserWindow | null = null;

export function createLogWindow(): void {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  const savedPosition = store.getLogWindowPosition();
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: LOG_WINDOW_WIDTH,
    height: LOG_WINDOW_HEIGHT,
    minWidth: 400,
    minHeight: 200,
    frame: false,
    transparent: false,
    backgroundColor: '#1e1e1e',
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    icon: join(app.getAppPath(), 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/logs.js'),
    },
  };

  if (savedPosition) {
    windowOptions.x = savedPosition.x;
    windowOptions.y = savedPosition.y;
  }

  logWindow = new BrowserWindow(windowOptions);

  if (process.env.ELECTRON_RENDERER_URL) {
    logWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/logs.html`);
  } else {
    logWindow.loadFile(join(__dirname, '../renderer/logs.html'));
  }

  logWindow.setAlwaysOnTop(true, 'floating');

  setLogWindow(logWindow.webContents);

  logWindow.on('move', () => {
    if (logWindow && !logWindow.isDestroyed()) {
      const { x, y } = logWindow.getBounds();
      store.saveLogWindowPosition(x, y);
    }
  });

  logWindow.on('closed', () => {
    removeLogWindow();
    logWindow = null;
  });

  if (process.env.NODE_ENV === 'development') {
    logWindow.webContents.on('before-input-event', (_event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown' && logWindow) {
        logWindow.webContents.toggleDevTools();
      }
    });
  }
}

export function getLogWindow(): BrowserWindow | null {
  return logWindow;
}
