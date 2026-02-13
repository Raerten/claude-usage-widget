const { app } = require('electron');
const { initLogManager } = require('./src/main/logManager');
const { createMainWindow, getMainWindow } = require('./src/main/window');
const { createTray, refreshTrayMenu } = require('./src/main/tray');
const { createLoginWindow } = require('./src/main/auth');
const { createLogWindow } = require('./src/main/logWindow');
const { registerIpcHandlers } = require('./src/main/ipc');
const store = require('./src/main/store');

initLogManager();

app.setAppUserModelId('dev.raerten.app.claude-usage-widget');

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

// Refresh tray menu when orgs or selected org change
function handleOrgSwitch(orgId) {
  store.setSelectedOrganizationId(orgId);
  refreshTrayMenu();
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('org-switched', orgId);
  }
}

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
    onShowLogs: () => createLogWindow(),
    onReLogin: () => {
      store.deleteCredentials();
      createLoginWindow();
    },
    onLogout: () => {
      store.deleteCredentials();
      refreshTrayMenu();
      const mainWindow = getMainWindow();
      if (mainWindow) mainWindow.webContents.send('logout');
    },
    onToggle: () => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      }
    },
    onSwitchOrg: (orgId) => handleOrgSwitch(orgId),
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
