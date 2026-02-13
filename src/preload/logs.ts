import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('logsAPI', {
  onNewLog: (callback: (logEntry: unknown) => void) => {
    ipcRenderer.on('new-log-entry', (_event, logEntry) => callback(logEntry));
  },
  getBufferedLogs: () => ipcRenderer.invoke('get-buffered-logs'),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),
  closeWindow: () => ipcRenderer.send('close-log-window'),
});
