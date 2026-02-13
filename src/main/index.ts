import { app } from 'electron';
import { initLogManager } from './logManager';
import { createMainWindow, getMainWindow } from './window';
import { createTray, refreshTrayMenu } from './tray';
import { createLoginWindow } from './auth';
import { createLogWindow } from './logWindow';
import { registerIpcHandlers } from './ipc';
import * as store from './store';

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
function handleOrgSwitch(orgId: string): void {
  store.setSelectedOrganizationId(orgId);
  refreshTrayMenu();
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.webContents.send('org-switched', orgId);
  }
}

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: store.getAutostart() });

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
    onToggleAutostart: (enabled) => {
      store.saveAutostart(enabled);
      app.setLoginItemSettings({ openAtLogin: enabled });
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
