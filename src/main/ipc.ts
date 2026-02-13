import { ipcMain, session, shell, app } from 'electron';
import * as store from './store';
import { WIDGET_WIDTH } from './constants';
import { fetchUsageData } from './api';
import { getMainWindow } from './window';
import { createLoginWindow, attemptSilentLogin } from './auth';
import { refreshTrayMenu } from './tray';
import { getBufferedLogs, clearLogs } from './logManager';
import { createLogWindow, getLogWindow } from './logWindow';

export function registerIpcHandlers(): void {
  ipcMain.handle('get-credentials', () => store.getCredentials());

  ipcMain.handle('save-credentials', (_event, { sessionKey, organizationId }: { sessionKey: string; organizationId: string }) => {
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

  ipcMain.handle('set-window-position', (_event, { x, y }: { x: number; y: number }) => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      mainWindow.setPosition(x, y);
      return true;
    }
    return false;
  });

  ipcMain.on('open-external', (_event, url: string) => shell.openExternal(url));

  ipcMain.on('resize-to-content', (_event, height: number) => {
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
  ipcMain.handle('save-collapsed', (_event, value: boolean) => {
    store.saveCollapsed(value);
    return true;
  });

  ipcMain.handle('get-opacity', () => store.getOpacity());
  ipcMain.handle('save-opacity', (_event, value: number) => {
    store.saveOpacity(value);
    const mainWindow = getMainWindow();
    if (mainWindow) mainWindow.setOpacity(value / 100);
    return true;
  });

  ipcMain.handle('get-autostart', () => store.getAutostart());
  ipcMain.handle('save-autostart', (_event, value: boolean) => {
    store.saveAutostart(value);
    app.setLoginItemSettings({ openAtLogin: !!value });
    return true;
  });

  ipcMain.handle('get-organizations', () => store.getOrganizations());
  ipcMain.handle('set-selected-org', (_event, orgId: string) => {
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
