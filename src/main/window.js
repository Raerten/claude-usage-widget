const { BrowserWindow } = require('electron');
const path = require('path');
const { WIDGET_WIDTH, WIDGET_HEIGHT } = require('./constants');
const store = require('./store');

let mainWindow = null;

function createMainWindow() {
  const savedPosition = store.getWindowPosition();
  const windowOptions = {
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
    icon: path.join(__dirname, '../../assets/icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload.js'),
    },
  };

  if (savedPosition) {
    windowOptions.x = savedPosition.x;
    windowOptions.y = savedPosition.y;
  }

  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setVisibleOnAllWorkspaces(true);

  const savedOpacity = store.getOpacity() || 90;
  mainWindow.setOpacity(savedOpacity / 100);

  mainWindow.on('move', () => {
    const position = mainWindow.getBounds();
    store.saveWindowPosition(position.x, position.y);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function getMainWindow() {
  return mainWindow;
}

module.exports = { createMainWindow, getMainWindow };
