import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Credentials management
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  saveCredentials: (credentials: { sessionKey: string; organizationId: string }) => ipcRenderer.invoke('save-credentials', credentials),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openLogin: () => ipcRenderer.send('open-login'),
  resizeToContent: (height: number) => ipcRenderer.send('resize-to-content', height),

  // Window position
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (position: { x: number; y: number }) => ipcRenderer.invoke('set-window-position', position),

  // Event listeners
  onLoginSuccess: (callback: (data: unknown) => void) => {
    ipcRenderer.on('login-success', (_event, data) => callback(data));
  },
  onRefreshUsage: (callback: () => void) => {
    ipcRenderer.on('refresh-usage', () => callback());
  },
  onSessionExpired: (callback: () => void) => {
    ipcRenderer.on('session-expired', () => callback());
  },
  onSilentLoginStarted: (callback: () => void) => {
    ipcRenderer.on('silent-login-started', () => callback());
  },
  onSilentLoginFailed: (callback: () => void) => {
    ipcRenderer.on('silent-login-failed', () => callback());
  },
  onLogout: (callback: () => void) => {
    ipcRenderer.on('logout', () => callback());
  },
  onOrgSwitched: (callback: (orgId: string) => void) => {
    ipcRenderer.on('org-switched', (_event, orgId) => callback(orgId));
  },
  onFetchRetry: (callback: (data: unknown) => void) => {
    ipcRenderer.on('fetch-retry', (_event, data) => callback(data));
  },

  // Collapsed state
  getCollapsed: () => ipcRenderer.invoke('get-collapsed'),
  saveCollapsed: (value: boolean) => ipcRenderer.invoke('save-collapsed', value),

  // Opacity
  getOpacity: () => ipcRenderer.invoke('get-opacity'),
  saveOpacity: (value: number) => ipcRenderer.invoke('save-opacity', value),

  // Organizations
  getOrganizations: () => ipcRenderer.invoke('get-organizations'),
  setSelectedOrg: (orgId: string) => ipcRenderer.invoke('set-selected-org', orgId),

  // API
  fetchUsageData: () => ipcRenderer.invoke('fetch-usage-data'),
  attemptSilentLogin: () => ipcRenderer.send('attempt-silent-login'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),

  // Log window
  openLogWindow: () => ipcRenderer.send('open-log-window'),
});
