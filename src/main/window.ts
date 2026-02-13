import { BrowserWindow, app } from 'electron';
import { join } from 'path';
import { WIDGET_WIDTH, WIDGET_HEIGHT } from './constants';
import * as store from './store';

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): void {
  const savedPosition = store.getWindowPosition();
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: WIDGET_WIDTH,
    height: WIDGET_HEIGHT,
    frame: false,
    transparent: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: false,
    minHeight: 20,
    minimizable: true,
    skipTaskbar: true,
    icon: join(app.getAppPath(), 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, '../preload/index.js'),
    },
  };

  if (savedPosition) {
    windowOptions.x = savedPosition.x;
    windowOptions.y = savedPosition.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true);

  const savedOpacity = store.getOpacity() || 90;
  mainWindow.setOpacity(savedOpacity / 100);

  mainWindow.on('move', () => {
    if (mainWindow) {
      const position = mainWindow.getBounds();
      store.saveWindowPosition(position.x, position.y);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
