const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Credentials management
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  saveCredentials: (credentials) => ipcRenderer.invoke('save-credentials', credentials),
  deleteCredentials: () => ipcRenderer.invoke('delete-credentials'),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  openLogin: () => ipcRenderer.send('open-login'),
  resizeToContent: (height) => ipcRenderer.send('resize-to-content', height),

  // Window position
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  setWindowPosition: (position) => ipcRenderer.invoke('set-window-position', position),

  // Event listeners
  onLoginSuccess: (callback) => {
    ipcRenderer.on('login-success', (event, data) => callback(data));
  },
  onRefreshUsage: (callback) => {
    ipcRenderer.on('refresh-usage', () => callback());
  },
  onSessionExpired: (callback) => {
    ipcRenderer.on('session-expired', () => callback());
  },
  onSilentLoginStarted: (callback) => {
    ipcRenderer.on('silent-login-started', () => callback());
  },
  onSilentLoginFailed: (callback) => {
    ipcRenderer.on('silent-login-failed', () => callback());
  },
  onLogout: (callback) => {
    ipcRenderer.on('logout', () => callback());
  },
  onOrgSwitched: (callback) => {
    ipcRenderer.on('org-switched', (event, orgId) => callback(orgId));
  },
  onFetchRetry: (callback) => {
    ipcRenderer.on('fetch-retry', (event, data) => callback(data));
  },

  // Opacity
  getOpacity: () => ipcRenderer.invoke('get-opacity'),
  saveOpacity: (value) => ipcRenderer.invoke('save-opacity', value),

  // Organizations
  getOrganizations: () => ipcRenderer.invoke('get-organizations'),
  setSelectedOrg: (orgId) => ipcRenderer.invoke('set-selected-org', orgId),

  // API
  fetchUsageData: () => ipcRenderer.invoke('fetch-usage-data'),
  attemptSilentLogin: () => ipcRenderer.send('attempt-silent-login'),
  openExternal: (url) => ipcRenderer.send('open-external', url)
});
