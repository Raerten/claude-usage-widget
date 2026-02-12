const { ipcMain, session, shell, app } = require('electron');
const store = require('./store');
const { fetchUsageData } = require('./api');
const { getMainWindow } = require('./window');
const { createLoginWindow, attemptSilentLogin } = require('./auth');

function registerIpcHandlers() {
  ipcMain.handle('get-credentials', () => store.getCredentials());

  ipcMain.handle('save-credentials', (event, { sessionKey, organizationId }) => {
    store.saveCredentials(sessionKey, organizationId);
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

  ipcMain.handle('fetch-usage-data', async () => {
    console.log('[Main] fetch-usage-data handler called');
    try {
      return await fetchUsageData();
    } catch (error) {
      if (error.message === 'SessionExpired') {
        console.log('[Main] Session expired, attempting silent re-login...');
        // store.deleteCredentials();
        attemptSilentLogin();
        throw new Error('SessionExpired');
      }
      throw error;
    }
  });
}

module.exports = { registerIpcHandlers };
