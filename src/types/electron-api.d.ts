import type { Organization, WindowPosition } from './store';
import type { UsageData } from './usage';
import type { LogEntry, LoginSuccessData, FetchRetryData } from './ipc';

export interface ElectronAPI {
  getCredentials: () => Promise<{ sessionKey: string | undefined; organizationId: string | undefined }>;
  saveCredentials: (credentials: { sessionKey: string; organizationId: string }) => Promise<boolean>;
  deleteCredentials: () => Promise<boolean>;

  minimizeWindow: () => void;
  closeWindow: () => void;
  openLogin: () => void;
  resizeToContent: (height: number) => void;

  getWindowPosition: () => Promise<WindowPosition | null>;
  setWindowPosition: (position: { x: number; y: number }) => Promise<boolean>;

  onLoginSuccess: (callback: (data: LoginSuccessData) => void) => void;
  onRefreshUsage: (callback: () => void) => void;
  onSessionExpired: (callback: () => void) => void;
  onSilentLoginStarted: (callback: () => void) => void;
  onSilentLoginFailed: (callback: () => void) => void;
  onLogout: (callback: () => void) => void;
  onOrgSwitched: (callback: (orgId: string) => void) => void;
  onFetchRetry: (callback: (data: FetchRetryData) => void) => void;

  getCollapsed: () => Promise<boolean>;
  saveCollapsed: (value: boolean) => Promise<boolean>;

  getOpacity: () => Promise<number>;
  saveOpacity: (value: number) => Promise<boolean>;

  getOrganizations: () => Promise<Organization[]>;
  setSelectedOrg: (orgId: string) => Promise<boolean>;

  fetchUsageData: () => Promise<UsageData>;
  attemptSilentLogin: () => void;
  openExternal: (url: string) => void;

  openLogWindow: () => void;
}

export interface LogsAPI {
  onNewLog: (callback: (logEntry: LogEntry) => void) => void;
  getBufferedLogs: () => Promise<LogEntry[]>;
  clearLogs: () => Promise<boolean>;
  closeWindow: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    logsAPI: LogsAPI;
  }
}
