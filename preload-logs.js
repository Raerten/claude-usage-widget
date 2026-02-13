const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('logsAPI', {
  onNewLog: (callback) => {
    ipcRenderer.on('new-log-entry', (event, logEntry) => callback(logEntry));
  },
  getBufferedLogs: () => ipcRenderer.invoke('get-buffered-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  closeWindow: () => ipcRenderer.send('close-log-window'),
});
