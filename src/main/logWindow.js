const { BrowserWindow } = require('electron');
const path = require('path');
const { LOG_WINDOW_WIDTH, LOG_WINDOW_HEIGHT } = require('./constants');
const store = require('./store');
const { setLogWindow, removeLogWindow } = require('./logManager');

let logWindow = null;

function createLogWindow() {
  if (logWindow && !logWindow.isDestroyed()) {
    logWindow.focus();
    return;
  }

  const savedPosition = store.getLogWindowPosition();
  const windowOptions = {
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
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload-logs.js'),
    },
  };

  if (savedPosition) {
    windowOptions.x = savedPosition.x;
    windowOptions.y = savedPosition.y;
  }

  logWindow = new BrowserWindow(windowOptions);
  logWindow.loadFile(path.join(__dirname, '../renderer/logs.html'));
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
    logWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function getLogWindow() {
  return logWindow;
}

module.exports = { createLogWindow, getLogWindow };
