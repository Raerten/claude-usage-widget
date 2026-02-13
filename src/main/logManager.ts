import type { WebContents } from 'electron';
import type { LogEntry } from '../types/ipc';

const MAX_BUFFER_SIZE = 1000;

let logBuffer: LogEntry[] = [];
let logCounter = 0;
let logWindowWebContents: WebContents | null = null;

const originalConsole: Record<string, (...args: unknown[]) => void> = {};

function formatArgs(args: unknown[]): string {
  return args.map(arg => {
    if (typeof arg === 'string') return arg;
    try {
      return JSON.stringify(arg, null, 2);
    } catch {
      return String(arg);
    }
  }).join(' ');
}

function addLogEntry(level: LogEntry['level'], args: unknown[]): void {
  const entry: LogEntry = {
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

export function initLogManager(): void {
  originalConsole.log = console.log;
  originalConsole.warn = console.warn;
  originalConsole.error = console.error;

  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    addLogEntry('info', args);
  };

  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    addLogEntry('warn', args);
  };

  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    addLogEntry('error', args);
  };
}

export function getBufferedLogs(): LogEntry[] {
  return [...logBuffer];
}

export function clearLogs(): void {
  logBuffer = [];
}

export function setLogWindow(webContents: WebContents): void {
  logWindowWebContents = webContents;
}

export function removeLogWindow(): void {
  logWindowWebContents = null;
}
