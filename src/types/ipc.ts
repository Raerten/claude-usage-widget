import type { UsageData } from './usage';
import type { Credentials, Organization, WindowPosition } from './store';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface LoginSuccessData {
  sessionKey: string;
  organizationId: string;
  organizations: Organization[];
}

export interface FetchRetryData {
  attempt: number;
  maxAttempts: number;
}

export interface IpcInvokeChannels {
  'get-credentials': { args: void; return: Credentials };
  'save-credentials': { args: { sessionKey: string; organizationId: string }; return: boolean };
  'delete-credentials': { args: void; return: boolean };
  'get-window-position': { args: void; return: WindowPosition | null };
  'set-window-position': { args: { x: number; y: number }; return: boolean };
  'get-opacity': { args: void; return: number };
  'save-opacity': { args: number; return: boolean };
  'get-collapsed': { args: void; return: boolean };
  'save-collapsed': { args: boolean; return: boolean };
  'get-autostart': { args: void; return: boolean };
  'save-autostart': { args: boolean; return: boolean };
  'get-organizations': { args: void; return: Organization[] };
  'set-selected-org': { args: string; return: boolean };
  'fetch-usage-data': { args: void; return: UsageData };
  'get-buffered-logs': { args: void; return: LogEntry[] };
  'clear-logs': { args: void; return: boolean };
}

export interface IpcSendChannels {
  'open-login': void;
  'minimize-window': void;
  'close-window': void;
  'resize-to-content': number;
  'open-external': string;
  'open-log-window': void;
  'close-log-window': void;
  'attempt-silent-login': void;
}

export interface IpcMainToRendererChannels {
  'login-success': LoginSuccessData;
  'refresh-usage': void;
  'session-expired': void;
  'silent-login-started': void;
  'silent-login-failed': void;
  'logout': void;
  'org-switched': string;
  'fetch-retry': FetchRetryData;
  'new-log-entry': LogEntry;
}
