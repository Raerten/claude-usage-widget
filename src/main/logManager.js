const MAX_BUFFER_SIZE = 1000;

let logBuffer = [];
let logCounter = 0;
let logWindowWebContents = null;
const originalConsole = {};

function formatArgs(args) {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(' ');
}

function addLogEntry(level, args) {
  const entry = {
    id: logCounter++,
    timestamp: new Date().toISOString(),
    level,
    message: formatArgs(args),
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  if (logWindowWebContents && !logWindowWebContents.isDestroyed()) {
    try {
      logWindowWebContents.send('new-log-entry', entry);
    } catch {
      // Window closed mid-broadcast
    }
  }
}

function initLogManager() {
  originalConsole.log = console.log;
  originalConsole.warn = console.warn;
  originalConsole.error = console.error;

  console.log = (...args) => {
    originalConsole.log(...args);
    addLogEntry('info', args);
  };

  console.warn = (...args) => {
    originalConsole.warn(...args);
    addLogEntry('warn', args);
  };

  console.error = (...args) => {
    originalConsole.error(...args);
    addLogEntry('error', args);
  };
}

function getBufferedLogs() {
  return [...logBuffer];
}

function clearLogs() {
  logBuffer = [];
}

function setLogWindow(webContents) {
  logWindowWebContents = webContents;
}

function removeLogWindow() {
  logWindowWebContents = null;
}

module.exports = { initLogManager, getBufferedLogs, clearLogs, setLogWindow, removeLogWindow };
