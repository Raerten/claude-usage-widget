const { app } = require('electron');
const { createMainWindow, getMainWindow } = require('./src/main/window');
const { createTray } = require('./src/main/tray');
const { createLoginWindow } = require('./src/main/auth');
const { registerIpcHandlers } = require('./src/main/ipc');
const store = require('./src/main/store');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

registerIpcHandlers();

app.whenReady().then(() => {
  createMainWindow();

  createTray({
    onShow: () => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.show();
      } else {
        createMainWindow();
      }
    },
    onRefresh: () => {
      const mainWindow = getMainWindow();
      if (mainWindow) mainWindow.webContents.send('refresh-usage');
    },
    onReLogin: () => {
      store.deleteCredentials();
      createLoginWindow();
    },
    onLogout: () => {
      store.deleteCredentials();
      const mainWindow = getMainWindow();
      if (mainWindow) mainWindow.webContents.send('logout');
    },
    onToggle: () => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    },
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on all platforms
});

app.on('activate', () => {
  if (getMainWindow() === null) {
    createMainWindow();
  }
});
