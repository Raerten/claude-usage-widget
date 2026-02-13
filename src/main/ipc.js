const { ipcMain, session, shell, app } = require('electron');
const store = require('./store');
const { WIDGET_WIDTH } = require('./constants');
const { fetchUsageData } = require('./api');
const { getMainWindow } = require('./window');
const { createLoginWindow, attemptSilentLogin } = require('./auth');
const { refreshTrayMenu } = require('./tray');
const { getBufferedLogs, clearLogs } = require('./logManager');
const { createLogWindow, getLogWindow } = require('./logWindow');

function registerIpcHandlers() {
  ipcMain.handle('get-credentials', () => store.getCredentials());

  ipcMain.handle('save-credentials', (event, { sessionKey, organizationId }) => {
    store.saveCredentials(sessionKey, null, organizationId);
    return true;
  });

  ipcMain.handle('delete-credentials', async () => {
    store.deleteCredentials();
    try {
      await session.defaultSession.cookies.remove('https://claude.ai', 'sessionKey');
    } catch (error) {
      console.error('Failed to clear cookies:', error);
    }
    return true;
  });

  ipcMain.on('open-login', () => createLoginWindow());

  ipcMain.on('minimize-window', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.hide();
  });

  ipcMain.on('close-window', () => {
    app.quit();
  });

  ipcMain.handle('get-window-position', () => {
    const mainWindow = getMainWindow();
    return mainWindow ? mainWindow.getBounds() : null;
  });

  ipcMain.handle('set-window-position', (event, { x, y }) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.setPosition(x, y);
      return true;
    }
    return false;
  });

  ipcMain.on('open-external', (event, url) => shell.openExternal(url));

  ipcMain.on('resize-to-content', (event, height) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      const h = Math.max(Math.round(height), 20);
      const bounds = mainWindow.getBounds();
      mainWindow.setResizable(true);
      mainWindow.setMinimumSize(0, 0);
      mainWindow.setBounds({ x: bounds.x, y: bounds.y, width: WIDGET_WIDTH, height: h });
      mainWindow.setResizable(false);
    }
  });

  ipcMain.handle('get-collapsed', () => store.getCollapsed());
  ipcMain.handle('save-collapsed', (event, value) => {
    store.saveCollapsed(value);
    return true;
  });

  ipcMain.handle('get-opacity', () => store.getOpacity());
  ipcMain.handle('save-opacity', (event, value) => {
    store.saveOpacity(value);
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.setOpacity(value / 100);
    return true;
  });

  // Organizations
  ipcMain.handle('get-organizations', () => store.getOrganizations());
  ipcMain.handle('set-selected-org', (event, orgId) => {
    store.setSelectedOrganizationId(orgId);
    refreshTrayMenu();
    return true;
  });

  ipcMain.handle('fetch-usage-data', async () => {
    console.log('[Main] fetch-usage-data handler called');
    return await fetchUsageData();
  });

  ipcMain.on('attempt-silent-login', () => {
    console.log('[Main] Renderer requested silent re-login');
    attemptSilentLogin();
  });

  // Log window
  ipcMain.on('open-log-window', () => {
    createLogWindow();
  });

  ipcMain.on('close-log-window', () => {
    const logWin = getLogWindow();
    if (logWin && !logWin.isDestroyed()) logWin.close();
  });

  ipcMain.handle('get-buffered-logs', () => {
    return getBufferedLogs();
  });

  ipcMain.handle('clear-logs', () => {
    clearLogs();
    return true;
  });
}

module.exports = { registerIpcHandlers };
